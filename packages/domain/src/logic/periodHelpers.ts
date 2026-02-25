import type { BudgetPeriod, Allocation } from "../models/BudgetPeriod";
import type { Transaction } from "../models/Transaction";
import type { TransactionAssignment } from "../models/TransactionAssignment";
import { Money } from "../models/Money";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function lastDayOfMonth(year: number, month: number): number {
  // month is 0-based; Date(year, month+1, 0) gives last day of month
  return new Date(year, month + 1, 0).getDate();
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function isWithinPeriod(dateStr: string, period: BudgetPeriod): boolean {
  const date = dateStr.slice(0, 10); // extract YYYY-MM-DD
  return date >= period.startDate && date <= period.endDate;
}

/**
 * Returns the budget period (monthly bounds) for the given ISO date.
 */
export function getCurrentPeriod(now: string): BudgetPeriod {
  const year = parseInt(now.slice(0, 4), 10);
  const month = parseInt(now.slice(5, 7), 10) - 1; // 0-based
  const lastDay = lastDayOfMonth(year, month);

  const startDate = `${year}-${pad(month + 1)}-01`;
  const endDate = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
  const label = `${MONTH_NAMES[month]} ${year}`;

  return { startDate, endDate, label };
}

/**
 * Returns the human-readable label for a budget period.
 */
export function getPeriodLabel(period: BudgetPeriod): string {
  return period.label;
}

/**
 * Sums the absolute value of expenses assigned to an envelope within a period.
 * Only counts negative (expense) transactions. Returns a positive Money value.
 */
export function getSpendingInPeriod(
  transactions: Transaction[],
  assignments: TransactionAssignment[],
  envelopeId: string,
  period: BudgetPeriod,
): Money {
  const assignedTxIds = new Set(
    assignments
      .filter((a) => a.envelopeId === envelopeId)
      .map((a) => a.transactionId),
  );

  let totalCents = 0;

  for (const tx of transactions) {
    if (!assignedTxIds.has(tx.id)) continue;
    if (tx.amount.cents >= 0) continue;
    if (!isWithinPeriod(tx.postedAt, period)) continue;

    totalCents += Math.abs(tx.amount.cents);
  }

  return Money.fromCents(totalCents);
}

/**
 * Sums allocations to an envelope within a period.
 */
export function getFundingInPeriod(
  allocations: Allocation[],
  envelopeId: string,
  period: BudgetPeriod,
): Money {
  let totalCents = 0;

  for (const alloc of allocations) {
    if (alloc.envelopeId !== envelopeId) continue;
    if (!isWithinPeriod(alloc.allocatedAt, period)) continue;

    totalCents += alloc.amount.cents;
  }

  return Money.fromCents(totalCents);
}
