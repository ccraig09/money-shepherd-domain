import { onCall, HttpsError } from "firebase-functions/v2/https";
import { makeAnthropicClient, AI_MODEL, MAX_TOKENS, estimateCostCents } from "./anthropicClient";
import { CATEGORIZE_TRANSACTIONS_PROMPT } from "./systemPrompts";
import { checkAiLimits } from "./rateLimiter";
import { logAiUsage } from "./usageTracker";
import type { CategorizeTransactionsRequest, CategorizeTransactionsResponse, MerchantCategorization } from "./types";
import { ANTHROPIC_API_KEY } from "./secrets";

const MAX_MERCHANTS_PER_CALL = 20;

/**
 * Categorizes a batch of merchant names into budget envelope IDs.
 * Uses Claude Sonnet 4.6 via the Anthropic SDK.
 * Only returns high/medium confidence results — low confidence is filtered out.
 * Enforces rate limits and logs usage for cost monitoring.
 */
export const categorizeTransactions = onCall<
  CategorizeTransactionsRequest,
  Promise<CategorizeTransactionsResponse>
>(
  { secrets: [ANTHROPIC_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { householdId, merchants, envelopes } = request.data;
    if (!householdId || typeof householdId !== "string") {
      throw new HttpsError("invalid-argument", "householdId is required.");
    }
    if (!Array.isArray(merchants) || merchants.length === 0) {
      throw new HttpsError("invalid-argument", "merchants array is required.");
    }
    if (!Array.isArray(envelopes) || envelopes.length === 0) {
      throw new HttpsError("invalid-argument", "envelopes array is required.");
    }

    // Enforce batch limit
    const batch = merchants.slice(0, MAX_MERCHANTS_PER_CALL);

    // Check rate limits before calling the API
    const limits = await checkAiLimits(householdId);
    if (!limits.allowed) {
      throw new HttpsError("resource-exhausted", limits.reason ?? "AI limit reached.");
    }

    const anthropic = makeAnthropicClient(ANTHROPIC_API_KEY.value());

    const userMessage = buildCategorizationMessage(batch, envelopes);

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: CATEGORIZE_TRANSACTIONS_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // Extract text response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new HttpsError("internal", "AI returned no text response.");
    }

    // Parse and validate JSON — strip markdown code fences if present
    let categorizations: MerchantCategorization[];
    try {
      const raw = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      const parsed = JSON.parse(raw) as { categorizations: MerchantCategorization[] };

      // Build a set of valid envelope IDs for validation
      const validEnvelopeIds = new Set(envelopes.map((e) => e.id));

      // Filter to high/medium confidence only, and verify the envelope ID exists
      categorizations = (parsed.categorizations ?? []).filter(
        (c): c is MerchantCategorization =>
          isValidCategorization(c) &&
          (c.confidence === "high" || c.confidence === "medium") &&
          validEnvelopeIds.has(c.envelopeId),
      );
    } catch {
      throw new HttpsError("internal", "AI returned invalid JSON.");
    }

    // Log usage for cost tracking
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    await logAiUsage(householdId, {
      functionName: "categorizeTransactions",
      model: AI_MODEL,
      inputTokens,
      outputTokens,
      estimatedCostCents: estimateCostCents(inputTokens, outputTokens),
      calledAt: new Date().toISOString(),
    });

    return { categorizations };
  },
);

function isValidCategorization(c: unknown): c is MerchantCategorization {
  if (typeof c !== "object" || c === null) return false;
  const obj = c as Record<string, unknown>;
  return (
    typeof obj.merchant === "string" &&
    obj.merchant.length > 0 &&
    typeof obj.envelopeId === "string" &&
    obj.envelopeId.length > 0 &&
    (obj.confidence === "high" || obj.confidence === "medium" || obj.confidence === "low")
  );
}

function buildCategorizationMessage(
  merchants: string[],
  envelopes: CategorizeTransactionsRequest["envelopes"],
): string {
  const merchantList = merchants.map((m, i) => `  ${i + 1}. ${m}`).join("\n");

  const envelopeList = envelopes
    .map((e) => {
      const type = e.type ? ` [${e.type}]` : "";
      return `  - id:${e.id} | ${e.name}${type}`;
    })
    .join("\n");

  return [
    "Merchants to categorize:",
    merchantList,
    "",
    "Available envelopes:",
    envelopeList,
  ].join("\n");
}
