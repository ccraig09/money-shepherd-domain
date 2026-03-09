/**
 * Feature flags for risky or optional features.
 * Controlled via EXPO_PUBLIC_* env vars — defaults to enabled.
 *
 * To disable: set EXPO_PUBLIC_ENABLE_PLAID=false or EXPO_PUBLIC_ENABLE_REMOTE_SYNC=false
 * in your .env file before building.
 */
export const Features = {
  /** Plaid bank connection and transaction sync. */
  PLAID:
    process.env.EXPO_PUBLIC_ENABLE_PLAID !== "false" &&
    process.env.EXPO_PUBLIC_ENABLE_PLAID !== "0",

  /** Firebase Firestore remote sync. */
  REMOTE_SYNC:
    process.env.EXPO_PUBLIC_ENABLE_REMOTE_SYNC !== "false" &&
    process.env.EXPO_PUBLIC_ENABLE_REMOTE_SYNC !== "0",

  /** AI Advisor — Claude-powered budgeting assistance. */
  AI_ADVISOR:
    process.env.EXPO_PUBLIC_ENABLE_AI_ADVISOR !== "false" &&
    process.env.EXPO_PUBLIC_ENABLE_AI_ADVISOR !== "0",

  /** AI Text-to-Speech — read AI responses aloud. */
  AI_TTS:
    process.env.EXPO_PUBLIC_ENABLE_AI_TTS !== "false" &&
    process.env.EXPO_PUBLIC_ENABLE_AI_TTS !== "0",
} as const;
