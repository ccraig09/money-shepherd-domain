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
} as const;
