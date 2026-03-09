import { getFirestore } from "firebase-admin/firestore";

/** Hard monthly budget cap in cents ($7.00) */
const MONTHLY_BUDGET_CAP_CENTS = 700;

/** 75% warning threshold in cents (~$5.25) */
const BUDGET_WARNING_THRESHOLD_CENTS = 525;

/** Max AI calls per household per day */
const DAILY_CALL_LIMIT = 20;

export type AiLimitCheck = {
  allowed: boolean;
  warning?: "budget_warning";
  reason?: string;
  /** Current month cost in cents */
  currentCostCents: number;
  /** Calls made today */
  callsToday: number;
};

/**
 * Check whether an AI call is allowed for a household.
 * Enforces:
 * - 20 calls/day per household
 * - $7/mo hard cap
 * - Returns warning flag at 75% ($5.25)
 */
export async function checkAiLimits(
  householdId: string,
): Promise<AiLimitCheck> {
  const db = getFirestore();
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dayKey = now.toISOString().slice(0, 10);

  const ref = db
    .collection("households")
    .doc(householdId)
    .collection("aiUsage")
    .doc(monthKey);

  const snap = await ref.get();
  const data = snap.data() ?? {};

  const currentCostCents: number = (data.estimatedCostCents as number) ?? 0;
  const dailyCalls: Record<string, number> = (data.dailyCalls as Record<string, number>) ?? {};
  const callsToday = dailyCalls[dayKey] ?? 0;

  // Check hard monthly cap
  if (currentCostCents >= MONTHLY_BUDGET_CAP_CENTS) {
    return {
      allowed: false,
      reason: "Monthly AI budget reached ($7.00). Resets next month.",
      currentCostCents,
      callsToday,
    };
  }

  // Check daily limit
  if (callsToday >= DAILY_CALL_LIMIT) {
    return {
      allowed: false,
      reason: `Daily AI limit reached (${DAILY_CALL_LIMIT} calls). Try again tomorrow.`,
      currentCostCents,
      callsToday,
    };
  }

  // Check 75% warning
  const warning =
    currentCostCents >= BUDGET_WARNING_THRESHOLD_CENTS
      ? ("budget_warning" as const)
      : undefined;

  return {
    allowed: true,
    warning,
    currentCostCents,
    callsToday,
  };
}
