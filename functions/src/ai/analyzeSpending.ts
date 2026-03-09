import { onCall, HttpsError } from "firebase-functions/v2/https";
import { makeAnthropicClient, AI_MODEL, MAX_TOKENS, MAX_AI_ENVELOPE_SUGGESTIONS, estimateCostCents } from "./anthropicClient";
import { SPENDING_ANALYSIS_PROMPT } from "./systemPrompts";
import { checkAiLimits } from "./rateLimiter";
import { logAiUsage } from "./usageTracker";
import type { AnalyzeSpendingRequest, AnalyzeSpendingResponse, EnvelopeSuggestion } from "./types";
import { ANTHROPIC_API_KEY } from "./secrets";

/**
 * Analyzes spending patterns and suggests up to 7 budget envelopes.
 * Uses Claude Sonnet 4.6 via the Anthropic SDK.
 * Enforces rate limits and logs usage for cost monitoring.
 */
export const analyzeSpending = onCall<
  AnalyzeSpendingRequest,
  Promise<AnalyzeSpendingResponse>
>(
  { secrets: [ANTHROPIC_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { householdId, context } = request.data;
    if (!householdId || typeof householdId !== "string") {
      throw new HttpsError("invalid-argument", "householdId is required.");
    }
    if (!context || typeof context !== "object") {
      throw new HttpsError("invalid-argument", "context is required.");
    }

    // Check rate limits before calling the API
    const limits = await checkAiLimits(householdId);
    if (!limits.allowed) {
      throw new HttpsError("resource-exhausted", limits.reason ?? "AI limit reached.");
    }

    const anthropic = makeAnthropicClient(ANTHROPIC_API_KEY.value());

    // Build the user message with the spending context
    const userMessage = buildContextMessage(context);

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: SPENDING_ANALYSIS_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // Extract text response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new HttpsError("internal", "AI returned no text response.");
    }

    // Parse and validate JSON — strip markdown code fences if present
    let suggestions: EnvelopeSuggestion[];
    try {
      const raw = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      const parsed = JSON.parse(raw) as { suggestions: EnvelopeSuggestion[] };
      suggestions = (parsed.suggestions ?? [])
        .filter(isValidSuggestion)
        .slice(0, MAX_AI_ENVELOPE_SUGGESTIONS);
    } catch {
      throw new HttpsError("internal", "AI returned invalid JSON.");
    }

    // Log usage for cost tracking
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    await logAiUsage(householdId, {
      functionName: "analyzeSpending",
      model: AI_MODEL,
      inputTokens,
      outputTokens,
      estimatedCostCents: estimateCostCents(inputTokens, outputTokens),
      calledAt: new Date().toISOString(),
    });

    return {
      suggestions,
      ...(limits.warning === "budget_warning" && { warning: "budget_warning" as const }),
    } as AnalyzeSpendingResponse & { warning?: "budget_warning" };
  },
);

function isValidSuggestion(s: unknown): s is EnvelopeSuggestion {
  if (typeof s !== "object" || s === null) return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj.name === "string" &&
    typeof obj.goalCents === "number" &&
    ["giving", "spending", "savings", "debt"].includes(obj.type as string) &&
    typeof obj.reason === "string"
  );
}

function buildContextMessage(context: AnalyzeSpendingRequest["context"]): string {
  const income = (context.totalIncomeCents / 100).toFixed(2);
  const expenses = (context.totalExpensesCents / 100).toFixed(2);
  const available = (context.availableToAssignCents / 100).toFixed(2);

  const merchantList = context.topMerchants
    .slice(0, 10)
    .map((m) => `  - ${m.normalizedName}: $${(m.totalCents / 100).toFixed(2)} (${m.count} transactions)`)
    .join("\n");

  const accountList = context.accountSummary
    .map((a) => `  - ${a.type}: $${(a.balanceCents / 100).toFixed(2)} (${a.count} accounts)`)
    .join("\n");

  const envelopeList = context.envelopes.length > 0
    ? context.envelopes
        .map((e) => `  - ${e.name} (balance: $${(e.balanceCents / 100).toFixed(2)}${e.goalCents ? `, goal: $${(e.goalCents / 100).toFixed(2)}` : ""})`)
        .join("\n")
    : "  (none yet)";

  return [
    `Budget period: ${context.periodStartDate} to ${context.periodEndDate}`,
    `Income this month: $${income}`,
    `Expenses this month: $${expenses}`,
    `Available to assign: $${available}`,
    `Transactions: ${context.transactionCount}`,
    "",
    "Top spending merchants:",
    merchantList || "  (no merchant data yet)",
    "",
    "Account summary:",
    accountList || "  (no accounts)",
    "",
    "Existing envelopes:",
    envelopeList,
    "",
    `Please suggest up to ${MAX_AI_ENVELOPE_SUGGESTIONS} envelopes based on this spending data.`,
  ].join("\n");
}
