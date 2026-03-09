import Anthropic from "@anthropic-ai/sdk";

/** Single model for all AI tasks — Sonnet 4.6 */
export const AI_MODEL = "claude-sonnet-4-6-20250514";

/** Max tokens per AI response */
export const MAX_TOKENS = 4096;

/** Max envelope suggestions the AI can return */
export const MAX_AI_ENVELOPE_SUGGESTIONS = 7;

/**
 * Create an Anthropic client instance.
 * Called inside each Cloud Function with the secret value.
 */
export function makeAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

/**
 * Estimate cost in cents for a given token usage.
 * Sonnet 4.6 pricing: $3/MTok input, $15/MTok output.
 */
export function estimateCostCents(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * 300; // $3 = 300 cents
  const outputCost = (outputTokens / 1_000_000) * 1500; // $15 = 1500 cents
  return Math.ceil(inputCost + outputCost);
}
