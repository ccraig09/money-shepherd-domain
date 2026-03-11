import { Transaction } from "../models/Transaction";
import { detectRecurring } from "./detectRecurring";
import { normalizePayee } from "./normalizePayee";

export type CashFlowForecast = {
  /** Projected net for the month: (income − spending). Positive = saving. */
  projectedNetCents: number;
  /** Income received so far this month. */
  monthIncomeCents: number;
  /** Spending recorded so far this month. */
  monthSpentCents: number;
  /** Recurring income still expected this month (positive). */
  remainingIncomeCents: number;
  /** Recurring bills still expected this month (positive = outflow). */
  upcomingBillsCents: number;
  /** Projected remaining discretionary spend based on 7-day rolling pace. */
  projectedDiscretionaryCents: number;
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Project month-end net (income − spending) from transaction history.
 * Uses income-based framing: positive = on pace to save, negative = spending ahead of income.
 * Uses a 7-day rolling daily pace for discretionary to avoid early-month inflation.
 * Returns null if too early in the month (day ≤ 2) for meaningful projections.
 */
export function getCashFlowForecast(
  transactions: Transaction[],
  now: string,
): CashFlowForecast | null {
  const date = new Date(now + "T00:00:00");
  const year = date.getFullYear();
  const month = date.getMonth();
  const dayOfMonth = date.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const daysRemaining = lastDay - dayOfMonth;

  if (dayOfMonth <= 2) return null;

  const monthPrefix = `${year}-${pad(month + 1)}`;
  const nowDate = now.slice(0, 10);

  // 7-day window for rolling pace
  const sevenDaysAgo = new Date(date);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoStr = `${sevenDaysAgo.getFullYear()}-${pad(sevenDaysAgo.getMonth() + 1)}-${pad(sevenDaysAgo.getDate())}`;

  // ── Build history for recurring detection (exclude pending + transfers) ─
  const history = transactions
    .filter((tx) => !tx.isPending && !tx.isTransfer)
    .map((tx) => ({
      normalizedPayee: normalizePayee(tx.description),
      envelopeId: "",
      amountCents: tx.amount.cents,
      postedAt: tx.postedAt,
    }));

  const patterns = detectRecurring(history);
  const recurringPayees = new Set(patterns.map((p) => p.normalizedPayee));

  // ── Payee → average amount map ─────────────────────────────
  const payeeAmounts = new Map<string, number[]>();
  for (const h of history) {
    const list = payeeAmounts.get(h.normalizedPayee);
    if (list) list.push(h.amountCents);
    else payeeAmounts.set(h.normalizedPayee, [h.amountCents]);
  }

  // ── Which recurring payees already posted this month ───────
  const postedThisMonth = new Set<string>();
  for (const h of history) {
    const txDate = h.postedAt.slice(0, 10);
    if (txDate >= monthPrefix + "-01" && txDate <= nowDate) {
      postedThisMonth.add(h.normalizedPayee);
    }
  }

  // ── Month-to-date income & spending ───────────────────────
  let monthIncomeCents = 0;
  let monthSpentCents = 0;
  let rollingDiscretionaryCents = 0;
  const rollingDays = Math.min(dayOfMonth, 7);

  for (const tx of transactions) {
    if (tx.isPending) continue; // exclude pending — not yet settled
    if (tx.isTransfer) continue; // exclude inter-account transfers
    const txDate = tx.postedAt.slice(0, 10);
    if (txDate < monthPrefix + "-01" || txDate > nowDate) continue;

    if (tx.amount.cents > 0) {
      monthIncomeCents += tx.amount.cents;
    } else {
      monthSpentCents += Math.abs(tx.amount.cents);
      // Rolling 7-day discretionary (exclude recurring)
      const payee = normalizePayee(tx.description);
      if (!recurringPayees.has(payee) && txDate >= sevenDaysAgoStr) {
        rollingDiscretionaryCents += Math.abs(tx.amount.cents);
      }
    }
  }

  // ── Remaining recurring income & bills ───────────────────
  let remainingIncomeCents = 0;
  let upcomingBillsCents = 0;

  for (const pattern of patterns) {
    const payee = pattern.normalizedPayee;
    if (postedThisMonth.has(payee)) continue;

    const amounts = payeeAmounts.get(payee) ?? [];
    if (amounts.length === 0) continue;
    const avg = Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length);

    if (avg > 0) remainingIncomeCents += avg;
    else upcomingBillsCents += Math.abs(avg);
  }

  // ── Project remaining discretionary (7-day rolling pace) ──
  const dailyRollingPace = rollingDays > 0 ? rollingDiscretionaryCents / rollingDays : 0;
  const projectedDiscretionaryCents = Math.round(dailyRollingPace * daysRemaining);

  // ── Projected month-end net ────────────────────────────────
  const projectedNetCents =
    (monthIncomeCents + remainingIncomeCents) -
    (monthSpentCents + upcomingBillsCents + projectedDiscretionaryCents);

  return {
    projectedNetCents,
    monthIncomeCents,
    monthSpentCents,
    remainingIncomeCents,
    upcomingBillsCents,
    projectedDiscretionaryCents,
  };
}
