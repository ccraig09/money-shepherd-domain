import { onCall, HttpsError } from "firebase-functions/v2/https";
import { makeAnthropicClient, AI_MODEL, estimateCostCents } from "./anthropicClient";
import { CHAT_SYSTEM_PROMPT } from "./systemPrompts";
import { checkAiLimits } from "./rateLimiter";
import { logAiUsage } from "./usageTracker";
import type { ChatMessageRequest, ChatMessageResponse, ChatMessageEntry, AiContextPayload } from "./types";
import { ANTHROPIC_API_KEY } from "./secrets";

/** Max tokens for a chat reply — conversational, not lengthy */
const CHAT_MAX_TOKENS = 1024;

/** Max conversation turns the client can send (to bound input size) */
const MAX_CONVERSATION_TURNS = 40;

/**
 * Multi-turn conversational chat with budget-aware context.
 * Accepts the conversation history + current budget snapshot,
 * returns a natural-language response from Claude.
 */
export const chatMessage = onCall<
  ChatMessageRequest,
  Promise<ChatMessageResponse>
>(
  { secrets: [ANTHROPIC_API_KEY], invoker: "public" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { householdId, messages, context } = request.data;
    if (!householdId || typeof householdId !== "string") {
      throw new HttpsError("invalid-argument", "householdId is required.");
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpsError("invalid-argument", "messages are required.");
    }
    if (messages.length > MAX_CONVERSATION_TURNS) {
      throw new HttpsError(
        "invalid-argument",
        `Too many messages (max ${MAX_CONVERSATION_TURNS}).`,
      );
    }
    if (!context || typeof context !== "object") {
      throw new HttpsError("invalid-argument", "context is required.");
    }

    // Validate message structure
    for (const msg of messages) {
      if (msg.role !== "user" && msg.role !== "assistant") {
        throw new HttpsError("invalid-argument", "Invalid message role.");
      }
      if (typeof msg.content !== "string" || !msg.content.trim()) {
        throw new HttpsError("invalid-argument", "Message content must be non-empty.");
      }
    }

    // Check rate limits
    const limits = await checkAiLimits(householdId);
    if (!limits.allowed) {
      throw new HttpsError("resource-exhausted", limits.reason ?? "AI limit reached.");
    }

    const anthropic = makeAnthropicClient(ANTHROPIC_API_KEY.value());

    // Build system prompt with budget context injected
    const systemPrompt = buildSystemPrompt(context);

    // Map conversation history to Anthropic message format
    const anthropicMessages = messages.map((m: ChatMessageEntry) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: CHAT_MAX_TOKENS,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    // Extract text response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new HttpsError("internal", "AI returned no text response.");
    }

    // Log usage
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    await logAiUsage(householdId, {
      functionName: "chatMessage",
      model: AI_MODEL,
      inputTokens,
      outputTokens,
      estimatedCostCents: estimateCostCents(inputTokens, outputTokens),
      calledAt: new Date().toISOString(),
    });

    return {
      reply: textBlock.text,
      ...(limits.warning === "budget_warning" && { warning: "budget_warning" as const }),
    };
  },
);

/**
 * Inject the user's current budget snapshot into the system prompt.
 * Formats cents as dollars for natural readability.
 */
function buildSystemPrompt(ctx: AiContextPayload): string {
  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const envelopeLines = ctx.envelopes
    .map((e) => {
      const goal = e.goalCents ? ` (goal: ${fmt(e.goalCents)})` : "";
      const type = e.type ? ` [${e.type}]` : "";
      return `  - ${e.name}${type}: ${fmt(e.balanceCents)}${goal}`;
    })
    .join("\n");

  const merchantLines = ctx.topMerchants
    .slice(0, 10)
    .map((m) => `  - ${m.normalizedName}: ${fmt(m.totalCents)} (${m.count} txns)`)
    .join("\n");

  const accountLines = ctx.accountSummary
    .map((a) => `  - ${a.type}: ${fmt(a.balanceCents)} (${a.count} account${a.count !== 1 ? "s" : ""})`)
    .join("\n");

  const budgetSnapshot = [
    `Budget period: ${ctx.periodStartDate} to ${ctx.periodEndDate}`,
    `Total income: ${fmt(ctx.totalIncomeCents)}`,
    `Total expenses: ${fmt(ctx.totalExpensesCents)}`,
    `Available to assign: ${fmt(ctx.availableToAssignCents)}`,
    `Transaction count: ${ctx.transactionCount}`,
    "",
    "Envelopes:",
    envelopeLines || "  (none)",
    "",
    "Top merchants this period:",
    merchantLines || "  (none)",
    "",
    "Account summary:",
    accountLines || "  (none)",
  ].join("\n");

  return `${CHAT_SYSTEM_PROMPT}\n\n--- BUDGET SNAPSHOT ---\n${budgetSnapshot}`;
}
