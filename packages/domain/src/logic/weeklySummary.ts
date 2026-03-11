import { Transaction } from "../models/Transaction";
import { TransactionAssignment } from "../models/TransactionAssignment";
import { Envelope } from "../models/Envelope";

export type WeeklyEnvelopeSpend = {
  envelopeId: string;
  name: string;
  spentCents: number;
};

export type WeeklySummary = {
  totalSpentCents: number;
  topEnvelopes: WeeklyEnvelopeSpend[];
  unassignedSpentCents: number;
  /** Ratio of weekly spend to weekly budget pace (monthlyGoals ÷ weeksInMonth). >1 = overspending. null if no goals. */
  paceRatio: number | null;
  weekStartDate: string;
  weekEndDate: string;
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function weeksInMonth(now: string): number {
  const date = new Date(now + "T00:00:00");
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return lastDay / 7;
}

export function getWeeklySummary(
  transactions: Transaction[],
  assignmentsByTxId: Record<string, TransactionAssignment>,
  envelopes: Envelope[],
  now: string,
): WeeklySummary {
  const endDate = new Date(now + "T00:00:00");
  const startDate = new Date(now + "T00:00:00");
  startDate.setDate(startDate.getDate() - 6); // 7-day window inclusive

  const weekStartDate = toISODate(startDate);
  const weekEndDate = toISODate(endDate);

  const envMap = new Map(envelopes.map((e) => [e.id, e]));
  const spendByEnvelope = new Map<string, number>();
  let totalSpentCents = 0;
  let unassignedSpentCents = 0;

  for (const tx of transactions) {
    if (tx.amount.cents >= 0) continue; // skip income
    if (tx.isTransfer) continue; // exclude inter-account transfers
    const txDate = tx.postedAt.slice(0, 10);
    if (txDate < weekStartDate || txDate > weekEndDate) continue;

    const spent = Math.abs(tx.amount.cents);
    totalSpentCents += spent;

    const assignment = assignmentsByTxId[tx.id];
    if (!assignment) {
      unassignedSpentCents += spent;
      continue;
    }

    const envId = assignment.envelopeId;
    spendByEnvelope.set(envId, (spendByEnvelope.get(envId) ?? 0) + spent);
  }

  // Build sorted top envelopes (descending by spend, then alphabetical)
  const topEnvelopes: WeeklyEnvelopeSpend[] = Array.from(spendByEnvelope.entries())
    .map(([envId, cents]) => ({
      envelopeId: envId,
      name: envMap.get(envId)?.name ?? envId,
      spentCents: cents,
    }))
    .sort((a, b) => b.spentCents - a.spentCents || a.name.localeCompare(b.name))
    .slice(0, 5);

  // Pace ratio: weekly spend vs weekly budget pace
  let paceRatio: number | null = null;
  const totalMonthlyGoalCents = envelopes.reduce(
    (sum, e) => sum + (e.goal?.cents ?? 0),
    0,
  );
  if (totalMonthlyGoalCents > 0) {
    const weeklyBudget = totalMonthlyGoalCents / weeksInMonth(now);
    paceRatio = totalSpentCents / weeklyBudget;
  }

  return {
    totalSpentCents,
    topEnvelopes,
    unassignedSpentCents,
    paceRatio,
    weekStartDate,
    weekEndDate,
  };
}
