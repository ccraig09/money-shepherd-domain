import { Envelope } from "../models/Envelope";
import { Transaction } from "../models/Transaction";
import { Insight } from "../models/Insight";

export type InsightContext = {
  envelopes: Envelope[];
  transactions: Transaction[];
  assignedTransactionIds: Set<string>;
  availableToAssignCents: number;
  /** ISO date string, e.g. "2026-02-15" */
  now: string;
};

function formatDollars(cents: number): string {
  const abs = Math.abs(cents);
  return "$" + (abs / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function daysLeftInMonth(now: string): number {
  const date = new Date(now + "T00:00:00");
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return lastDay - date.getDate();
}

function overspentEnvelope(envelopes: Envelope[]): Insight[] {
  const results: Insight[] = [];
  for (const env of envelopes) {
    if (env.balance.cents < 0) {
      results.push({
        type: "overspent-envelope",
        severity: "warning",
        message: `${env.name} is overspent by ${formatDollars(env.balance.cents)}`,
        envelopeId: env.id,
      });
    }
  }
  return results;
}

function nearlyDepleted(envelopes: Envelope[], now: string): Insight[] {
  const results: Insight[] = [];
  const remaining = daysLeftInMonth(now);
  for (const env of envelopes) {
    if (!env.goal || env.goal.cents <= 0) continue;
    const pctRemaining = env.balance.cents / env.goal.cents;
    if (pctRemaining < 0.10) {
      results.push({
        type: "nearly-depleted",
        severity: "warning",
        message: `${env.name} is almost gone — ${remaining} days left this month`,
        envelopeId: env.id,
      });
    }
  }
  return results;
}

function unassignedTransactions(
  transactions: Transaction[],
  assignedIds: Set<string>,
): Insight[] {
  const unassigned = transactions.filter(
    (tx) => tx.amount.cents < 0 && !assignedIds.has(tx.id),
  );
  if (unassigned.length === 0) return [];
  return [
    {
      type: "unassigned-transactions",
      severity: "info",
      message: `You have ${unassigned.length} unassigned expense${unassigned.length === 1 ? "" : "s"}`,
    },
  ];
}

function idleFunds(availableToAssignCents: number): Insight[] {
  if (availableToAssignCents <= 0) return [];
  return [
    {
      type: "idle-funds",
      severity: "info",
      message: `${formatDollars(availableToAssignCents)} is sitting unassigned — give every dollar a job`,
    },
  ];
}

function debtMilestone(envelopes: Envelope[]): Insight[] {
  const results: Insight[] = [];
  for (const env of envelopes) {
    if (env.type !== "debt") continue;
    if (!env.target || env.target.cents <= 0) continue;
    const pct = Math.round((env.balance.cents / env.target.cents) * 100);
    if (pct >= 25) {
      results.push({
        type: "debt-milestone",
        severity: "success",
        message: `${env.name} is ${pct}% paid off — keep going!`,
        envelopeId: env.id,
      });
    }
  }
  return results;
}

function positiveNet(transactions: Transaction[], now: string): Insight[] {
  const date = new Date(now + "T00:00:00");
  const year = date.getFullYear();
  const month = date.getMonth();

  const thisMonth = transactions.filter((tx) => {
    const txDate = new Date(tx.postedAt);
    return txDate.getFullYear() === year && txDate.getMonth() === month;
  });

  let incomeCents = 0;
  let expenseCents = 0;
  for (const tx of thisMonth) {
    if (tx.amount.cents > 0) incomeCents += tx.amount.cents;
    else expenseCents += Math.abs(tx.amount.cents);
  }

  const net = incomeCents - expenseCents;
  if (net <= 0) return [];

  return [
    {
      type: "positive-net",
      severity: "success",
      message: `You're ${formatDollars(net)} ahead this month — nice work!`,
    },
  ];
}

export function generateInsights(context: InsightContext): Insight[] {
  return [
    ...overspentEnvelope(context.envelopes),
    ...nearlyDepleted(context.envelopes, context.now),
    ...unassignedTransactions(context.transactions, context.assignedTransactionIds),
    ...idleFunds(context.availableToAssignCents),
    ...debtMilestone(context.envelopes),
    ...positiveNet(context.transactions, context.now),
  ];
}
