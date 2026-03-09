import { doc, getDoc } from "firebase/firestore";
import { getFirebase, ensureAnonAuth } from "./firebaseClient";

export type AiUsageStats = {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostCents: number;
  callsToday: number;
  lastCalledAt?: string;
};

/**
 * Read AI usage stats for the current month from Firestore.
 * Returns zeroed stats if no usage doc exists yet.
 */
export async function readAiUsage(householdId: string): Promise<AiUsageStats> {
  await ensureAnonAuth();
  const { db } = getFirebase();

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dayKey = now.toISOString().slice(0, 10);

  const ref = doc(db, "households", householdId, "aiUsage", monthKey);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return {
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      estimatedCostCents: 0,
      callsToday: 0,
    };
  }

  const data = snap.data();
  const dailyCalls: Record<string, number> = (data.dailyCalls as Record<string, number>) ?? {};

  return {
    totalCalls: (data.totalCalls as number) ?? 0,
    totalInputTokens: (data.totalInputTokens as number) ?? 0,
    totalOutputTokens: (data.totalOutputTokens as number) ?? 0,
    estimatedCostCents: (data.estimatedCostCents as number) ?? 0,
    callsToday: dailyCalls[dayKey] ?? 0,
    lastCalledAt: (data.lastCalledAt as string) ?? undefined,
  };
}
