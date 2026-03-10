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

export type MonthTrendPoint = {
  /** Short month label, e.g. "Feb" */
  label: string;
  incomeCents: number;
  spendingCents: number;
  netCents: number;
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
    if (tx.isPending) continue; // exclude pending — not yet settled
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

/**
 * Returns income/spending/net for the last N months (oldest first).
 * Months with zero activity are included so the chart has consistent spacing.
 */
export function getMonthlyTrend(
  transactions: Transaction[],
  now: string,
  months: number = 6,
): MonthTrendPoint[] {
  const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const results: MonthTrendPoint[] = [];

  let year = parseInt(now.slice(0, 4), 10);
  let month = parseInt(now.slice(5, 7), 10) - 1; // 0-based

  for (let i = 0; i < months; i++) {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const dateStr = `${year}-${pad(month + 1)}-15`;
    const period = getCurrentPeriod(dateStr);

    let incomeCents = 0;
    let spendingCents = 0;

    for (const tx of transactions) {
      if (tx.isPending) continue; // exclude pending
      const date = tx.postedAt.slice(0, 10);
      if (date < period.startDate || date > period.endDate) continue;
      if (tx.amount.cents > 0) incomeCents += tx.amount.cents;
      else spendingCents += Math.abs(tx.amount.cents);
    }

    results.unshift({
      label: SHORT_MONTHS[month],
      incomeCents,
      spendingCents,
      netCents: incomeCents - spendingCents,
    });

    month--;
    if (month < 0) { month = 11; year--; }
  }

  return results;
}
