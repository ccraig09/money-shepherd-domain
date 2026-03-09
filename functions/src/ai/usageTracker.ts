import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { AiUsageRecord } from "./types";

/**
 * Log an AI API call to Firestore for usage tracking and cost monitoring.
 * Path: households/{householdId}/aiUsage/{YYYY-MM}
 *
 * Each monthly doc contains:
 * - totalCalls, totalInputTokens, totalOutputTokens, estimatedCostCents
 * - dailyCalls: { [YYYY-MM-DD]: count }
 * - calls: array of individual call records (for debugging)
 */
export async function logAiUsage(
  householdId: string,
  record: AiUsageRecord,
): Promise<void> {
  const db = getFirestore();
  const now = new Date(record.calledAt);
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dayKey = record.calledAt.slice(0, 10); // YYYY-MM-DD

  const ref = db
    .collection("households")
    .doc(householdId)
    .collection("aiUsage")
    .doc(monthKey);

  await ref.set(
    {
      totalCalls: FieldValue.increment(1),
      totalInputTokens: FieldValue.increment(record.inputTokens),
      totalOutputTokens: FieldValue.increment(record.outputTokens),
      estimatedCostCents: FieldValue.increment(record.estimatedCostCents),
      [`dailyCalls.${dayKey}`]: FieldValue.increment(1),
      lastCalledAt: record.calledAt,
    },
    { merge: true },
  );
}
