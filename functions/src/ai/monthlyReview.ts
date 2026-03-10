import { onCall, HttpsError } from "firebase-functions/v2/https";
import { makeAnthropicClient, AI_MODEL, MAX_TOKENS, estimateCostCents } from "./anthropicClient";
import { MONTHLY_REVIEW_PROMPT } from "./systemPrompts";
import { checkAiLimits } from "./rateLimiter";
import { logAiUsage } from "./usageTracker";
import type {
  MonthlyReviewRequest,
  MonthlyReviewResponse,
  AiContextPayload,
  EnvelopeHighlight,
  BudgetAdjustment,
} from "./types";
import { ANTHROPIC_API_KEY } from "./secrets";

/**
 * Generates a monthly spending review comparing current vs previous month.
 * Returns a summary, per-envelope highlights with deltas, and budget adjustment suggestions.
 */
export const monthlyReview = onCall<
  MonthlyReviewRequest,
  Promise<MonthlyReviewResponse>
>(
  { secrets: [ANTHROPIC_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { householdId, currentMonth, previousMonth } = request.data;
    if (!householdId || typeof householdId !== "string") {
      throw new HttpsError("invalid-argument", "householdId is required.");
    }
    if (!currentMonth || typeof currentMonth !== "object") {
      throw new HttpsError("invalid-argument", "currentMonth context is required.");
    }
    if (!previousMonth || typeof previousMonth !== "object") {
      throw new HttpsError("invalid-argument", "previousMonth context is required.");
    }

    // Check rate limits before calling the API
    const limits = await checkAiLimits(householdId);
    if (!limits.allowed) {
      throw new HttpsError("resource-exhausted", limits.reason ?? "AI limit reached.");
    }

    const anthropic = makeAnthropicClient(ANTHROPIC_API_KEY.value());

    const userMessage = buildReviewMessage(currentMonth, previousMonth);

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: MONTHLY_REVIEW_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // Extract text response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new HttpsError("internal", "AI returned no text response.");
    }

    // Parse and validate JSON
    let summary: string;
    let envelopeHighlights: EnvelopeHighlight[];
    let adjustments: BudgetAdjustment[];
    try {
      const raw = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      const parsed = JSON.parse(raw) as {
        summary: string;
        envelopeHighlights: EnvelopeHighlight[];
        adjustments: BudgetAdjustment[];
      };
      summary = typeof parsed.summary === "string" ? parsed.summary : "Review unavailable.";
      envelopeHighlights = (parsed.envelopeHighlights ?? []).filter(isValidHighlight);
      adjustments = (parsed.adjustments ?? []).filter(isValidAdjustment).slice(0, 3);
    } catch {
      throw new HttpsError("internal", "AI returned invalid JSON.");
    }

    // Log usage for cost tracking
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    await logAiUsage(householdId, {
      functionName: "monthlyReview",
      model: AI_MODEL,
      inputTokens,
      outputTokens,
      estimatedCostCents: estimateCostCents(inputTokens, outputTokens),
      calledAt: new Date().toISOString(),
    });

    return {
      summary,
      envelopeHighlights,
      adjustments,
      ...(limits.warning === "budget_warning" && { warning: "budget_warning" as const }),
    };
  },
);

function isValidHighlight(h: unknown): h is EnvelopeHighlight {
  if (typeof h !== "object" || h === null) return false;
  const obj = h as Record<string, unknown>;
  return (
    typeof obj.envelopeName === "string" &&
    typeof obj.currentMonthCents === "number" &&
    typeof obj.previousMonthCents === "number" &&
    typeof obj.deltaPercent === "number" &&
    ["over_budget", "under_budget", "on_track"].includes(obj.status as string)
  );
}

function isValidAdjustment(a: unknown): a is BudgetAdjustment {
  if (typeof a !== "object" || a === null) return false;
  const obj = a as Record<string, unknown>;
  return (
    typeof obj.envelopeName === "string" &&
    typeof obj.currentGoalCents === "number" &&
    typeof obj.suggestedGoalCents === "number" &&
    typeof obj.reason === "string"
  );
}

function formatCtx(ctx: AiContextPayload, label: string): string {
  const income = (ctx.totalIncomeCents / 100).toFixed(2);
  const expenses = (ctx.totalExpensesCents / 100).toFixed(2);

  const merchantList = ctx.topMerchants
    .slice(0, 10)
    .map((m) => `  - ${m.normalizedName}: $${(m.totalCents / 100).toFixed(2)} (${m.count} txns)`)
    .join("\n");

  const envelopeList = ctx.envelopes.length > 0
    ? ctx.envelopes
        .map((e) => `  - ${e.name}: balance $${(e.balanceCents / 100).toFixed(2)}${e.goalCents ? `, goal $${(e.goalCents / 100).toFixed(2)}` : ""}${e.type ? ` [${e.type}]` : ""}`)
        .join("\n")
    : "  (none)";

  return [
    `=== ${label} (${ctx.periodStartDate} to ${ctx.periodEndDate}) ===`,
    `Income: $${income}`,
    `Expenses: $${expenses}`,
    `Transactions: ${ctx.transactionCount}`,
    "",
    "Top merchants:",
    merchantList || "  (no data)",
    "",
    "Envelopes:",
    envelopeList,
  ].join("\n");
}

function buildReviewMessage(current: AiContextPayload, previous: AiContextPayload): string {
  return [
    formatCtx(previous, "LAST MONTH"),
    "",
    formatCtx(current, "THIS MONTH"),
    "",
    "Please compare these two months and provide a review with highlights and adjustment suggestions.",
  ].join("\n");
}
