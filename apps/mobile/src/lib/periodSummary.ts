import {
  getCurrentPeriod,
  getSpendingInPeriod,
} from "@money-shepherd/domain";
import type {
  Transaction,
  TransactionAssignment,
  Envelope,
} from "@money-shepherd/domain";

export type MonthSummary = {
  incomeCents: number;
  spendingCents: number;
  netCents: number;
  /** envelopeId → cents spent this month (positive value) */
  spentByEnvelope: Record<string, number>;
};

/**
 * Computes income, spending, net, and per-envelope spending for the current month.
 * Uses the domain period helpers under the hood.
 */
export function getThisMonthSummary(
  transactions: Transaction[],
  assignmentsByTxId: Record<string, TransactionAssignment>,
  envelopes: Envelope[],
  now: string,
): MonthSummary {
  const period = getCurrentPeriod(now);
  const datePrefix = (tx: Transaction) => tx.postedAt.slice(0, 10);

  let incomeCents = 0;
  let spendingCents = 0;

  for (const tx of transactions) {
    const date = datePrefix(tx);
    if (date < period.startDate || date > period.endDate) continue;

    if (tx.amount.cents > 0) {
      incomeCents += tx.amount.cents;
    } else {
      spendingCents += Math.abs(tx.amount.cents);
    }
  }

  const assignments = Object.values(assignmentsByTxId);

  const spentByEnvelope: Record<string, number> = {};
  for (const env of envelopes) {
    spentByEnvelope[env.id] = getSpendingInPeriod(
      transactions,
      assignments,
      env.id,
      period,
    ).cents;
  }

  return {
    incomeCents,
    spendingCents,
    netCents: incomeCents - spendingCents,
    spentByEnvelope,
  };
}
