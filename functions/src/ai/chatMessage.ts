import { onCall, HttpsError } from "firebase-functions/v2/https";
import { makeAnthropicClient, AI_MODEL, estimateCostCents } from "./anthropicClient";
import { CHAT_SYSTEM_PROMPT } from "./systemPrompts";
import { checkAiLimits } from "./rateLimiter";
import { logAiUsage } from "./usageTracker";
import type { ChatMessageRequest, ChatMessageResponse, ChatMessageEntry, ChatAction, AiContextPayload } from "./types";
import { ANTHROPIC_API_KEY } from "./secrets";
import type Anthropic from "@anthropic-ai/sdk";

/** Max tokens for a chat reply — conversational, not lengthy */
const CHAT_MAX_TOKENS = 1024;

/** Max conversation turns the client can send (to bound input size) */
const MAX_CONVERSATION_TURNS = 40;

/**
 * Tool definitions for Anthropic tool_use.
 * These map to engine actions the client can execute on confirm.
 */
const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "create_envelope",
    description: "Create a new budget envelope for tracking spending in a category.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Name of the envelope (e.g. 'Dining Out', 'Vacation')" },
        type: {
          type: "string",
          enum: ["spending", "savings", "debt", "giving"],
          description: "Envelope type. Use 'spending' for everyday categories, 'savings' for goals, 'debt' for payments, 'giving' for generosity tracking.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "rename_envelope",
    description: "Rename an existing budget envelope.",
    input_schema: {
      type: "object" as const,
      properties: {
        envelopeId: { type: "string", description: "ID of the envelope to rename" },
        name: { type: "string", description: "New name for the envelope" },
      },
      required: ["envelopeId", "name"],
    },
  },
  {
    name: "delete_envelope",
    description: "Delete a budget envelope. Only use when the user explicitly asks to remove one.",
    input_schema: {
      type: "object" as const,
      properties: {
        envelopeId: { type: "string", description: "ID of the envelope to delete" },
      },
      required: ["envelopeId"],
    },
  },
  {
    name: "set_envelope_goal",
    description: "Set or update the monthly goal amount for an envelope.",
    input_schema: {
      type: "object" as const,
      properties: {
        envelopeId: { type: "string", description: "ID of the envelope" },
        goalCents: { type: "number", description: "Goal amount in cents (e.g. 50000 for $500.00)" },
      },
      required: ["envelopeId", "goalCents"],
    },
  },
  {
    name: "transfer_funds",
    description: "Move money from one envelope to another.",
    input_schema: {
      type: "object" as const,
      properties: {
        fromEnvelopeId: { type: "string", description: "ID of the source envelope" },
        toEnvelopeId: { type: "string", description: "ID of the destination envelope" },
        amountCents: { type: "number", description: "Amount to transfer in cents (e.g. 5000 for $50.00)" },
      },
      required: ["fromEnvelopeId", "toEnvelopeId", "amountCents"],
    },
  },
  {
    name: "allocate_to_envelope",
    description: "Allocate unassigned funds to an envelope from the available-to-assign pool.",
    input_schema: {
      type: "object" as const,
      properties: {
        envelopeId: { type: "string", description: "ID of the envelope to fund" },
        amountCents: { type: "number", description: "Amount to allocate in cents" },
      },
      required: ["envelopeId", "amountCents"],
    },
  },
  {
    name: "set_envelope_type",
    description: "Change the type/category of an envelope.",
    input_schema: {
      type: "object" as const,
      properties: {
        envelopeId: { type: "string", description: "ID of the envelope" },
        envelopeType: {
          type: "string",
          enum: ["spending", "savings", "debt", "giving"],
          description: "New type for the envelope",
        },
      },
      required: ["envelopeId", "envelopeType"],
    },
  },
];

/**
 * Multi-turn conversational chat with budget-aware context and tool use.
 * Accepts the conversation history + current budget snapshot,
 * returns a natural-language response and optionally a suggested action.
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
      tools: CHAT_TOOLS,
    });

    // Extract text and tool_use blocks
    const textBlocks = response.content.filter((b) => b.type === "text");
    const toolBlock = response.content.find((b) => b.type === "tool_use");

    const reply = textBlocks.map((b) => b.type === "text" ? b.text : "").join("\n").trim();

    // If no text AND no tool use, something went wrong
    if (!reply && !toolBlock) {
      throw new HttpsError("internal", "AI returned no response.");
    }

    // Extract action from tool_use block (take first only)
    let action: ChatAction | undefined;
    if (toolBlock && toolBlock.type === "tool_use") {
      action = {
        toolName: toolBlock.name,
        toolInput: toolBlock.input as Record<string, unknown>,
      };
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
      reply: reply || "I'll take care of that for you.",
      ...(action && { action }),
      ...(limits.warning === "budget_warning" && { warning: "budget_warning" as const }),
    };
  },
);

/**
 * Inject the user's current budget snapshot into the system prompt.
 * Formats cents as dollars for natural readability.
 * Includes envelope IDs so Claude can reference them in tool calls.
 */
function buildSystemPrompt(ctx: AiContextPayload): string {
  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const envelopeLines = ctx.envelopes
    .map((e) => {
      const goal = e.goalCents ? ` (goal: ${fmt(e.goalCents)})` : "";
      const type = e.type ? ` [${e.type}]` : "";
      return `  - id:${e.id} | ${e.name}${type}: ${fmt(e.balanceCents)}${goal}`;
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
    "Envelopes (use the id field when calling tools):",
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
