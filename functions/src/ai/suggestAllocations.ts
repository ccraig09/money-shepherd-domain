import { onCall, HttpsError } from "firebase-functions/v2/https";
import { makeAnthropicClient, AI_MODEL, MAX_TOKENS, estimateCostCents } from "./anthropicClient";
import { SUGGEST_ALLOCATIONS_PROMPT } from "./systemPrompts";
import { checkAiLimits } from "./rateLimiter";
import { logAiUsage } from "./usageTracker";
import type { SuggestAllocationsRequest, SuggestAllocationsResponse, AllocationSuggestion } from "./types";
import { ANTHROPIC_API_KEY } from "./secrets";

/**
 * Suggests how to distribute available funds across budget envelopes.
 * Uses Claude Sonnet 4.6 via the Anthropic SDK.
 * Enforces rate limits and logs usage for cost monitoring.
 */
export const suggestAllocations = onCall<
  SuggestAllocationsRequest,
  Promise<SuggestAllocationsResponse>
>(
  { secrets: [ANTHROPIC_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { householdId, availableCents, envelopes } = request.data;
    if (!householdId || typeof householdId !== "string") {
      throw new HttpsError("invalid-argument", "householdId is required.");
    }
    if (typeof availableCents !== "number" || availableCents < 0) {
      throw new HttpsError("invalid-argument", "availableCents is required.");
    }
    if (!Array.isArray(envelopes) || envelopes.length === 0) {
      throw new HttpsError("invalid-argument", "envelopes are required.");
    }

    // Check rate limits before calling the API
    const limits = await checkAiLimits(householdId);
    if (!limits.allowed) {
      throw new HttpsError("resource-exhausted", limits.reason ?? "AI limit reached.");
    }

    const anthropic = makeAnthropicClient(ANTHROPIC_API_KEY.value());

    const userMessage = buildAllocationMessage(availableCents, envelopes);

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: SUGGEST_ALLOCATIONS_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // Extract text response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new HttpsError("internal", "AI returned no text response.");
    }

    // Parse and validate JSON — strip markdown code fences if present
    let allocations: AllocationSuggestion[];
    try {
      const raw = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      const parsed = JSON.parse(raw) as { allocations: AllocationSuggestion[] };
      allocations = (parsed.allocations ?? []).filter(isValidAllocation);

      // Guard: total must not exceed available
      const total = allocations.reduce((sum, a) => sum + a.amountCents, 0);
      if (total > availableCents) {
        // Scale down proportionally
        const scale = availableCents / total;
        allocations = allocations.map((a) => ({
          ...a,
          amountCents: Math.floor(a.amountCents * scale),
        }));
      }
    } catch {
      throw new HttpsError("internal", "AI returned invalid JSON.");
    }

    // Log usage for cost tracking
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    await logAiUsage(householdId, {
      functionName: "suggestAllocations",
      model: AI_MODEL,
      inputTokens,
      outputTokens,
      estimatedCostCents: estimateCostCents(inputTokens, outputTokens),
      calledAt: new Date().toISOString(),
    });

    return {
      allocations,
      ...(limits.warning === "budget_warning" && { warning: "budget_warning" as const }),
    } as SuggestAllocationsResponse & { warning?: "budget_warning" };
  },
);

function isValidAllocation(a: unknown): a is AllocationSuggestion {
  if (typeof a !== "object" || a === null) return false;
  const obj = a as Record<string, unknown>;
  return (
    typeof obj.envelopeId === "string" &&
    typeof obj.amountCents === "number" &&
    obj.amountCents > 0 &&
    typeof obj.reason === "string"
  );
}

function buildAllocationMessage(
  availableCents: number,
  envelopes: SuggestAllocationsRequest["envelopes"],
): string {
  const available = (availableCents / 100).toFixed(2);

  const envelopeList = envelopes
    .map((e) => {
      const balance = (e.balanceCents / 100).toFixed(2);
      const goal = e.goalCents ? ` (goal: $${(e.goalCents / 100).toFixed(2)})` : "";
      const type = e.type ? ` [${e.type}]` : "";
      return `  - id:${e.id} | ${e.name}${type} | balance: $${balance}${goal}`;
    })
    .join("\n");

  return [
    `Available to distribute: $${available}`,
    "",
    "Envelopes:",
    envelopeList,
    "",
    "Please suggest how to distribute the available funds across these envelopes.",
  ].join("\n");
}
