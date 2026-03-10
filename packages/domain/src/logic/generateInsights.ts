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
  /** Optional AI-generated tip to blend into the insight list */
  aiTip?: string;
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

function unusualCharge(transactions: Transaction[], now: string): Insight[] {
  const date = new Date(now + "T00:00:00");
  const year = date.getFullYear();
  const month = date.getMonth();

  // Group expenses by normalized merchant name
  const byMerchant: Record<string, { cents: number; isThisMonth: boolean }[]> = {};
  for (const tx of transactions) {
    if (tx.amount.cents >= 0) continue; // skip income
    const key = tx.description.toLowerCase().trim();
    if (!key) continue;
    const txDate = new Date(tx.postedAt);
    const isThisMonth = txDate.getFullYear() === year && txDate.getMonth() === month;
    if (!byMerchant[key]) byMerchant[key] = [];
    byMerchant[key].push({ cents: Math.abs(tx.amount.cents), isThisMonth });
  }

  let worstRatio = 0;
  let worstInsight: Insight | null = null;

  for (const [merchant, charges] of Object.entries(byMerchant)) {
    // Need at least 2 historical charges to establish a baseline
    const historical = charges.filter((c) => !c.isThisMonth);
    if (historical.length < 2) continue;

    const avgCents = Math.round(historical.reduce((s, c) => s + c.cents, 0) / historical.length);
    if (avgCents <= 0) continue;

    // Find the largest this-month charge
    const thisMonthCharges = charges.filter((c) => c.isThisMonth);
    if (thisMonthCharges.length === 0) continue;

    const maxCharge = Math.max(...thisMonthCharges.map((c) => c.cents));
    const ratio = maxCharge / avgCents;

    // Threshold: > 2× average AND > $50 absolute
    if (ratio > 2 && maxCharge > 5000 && ratio > worstRatio) {
      worstRatio = ratio;
      // Capitalize first letter of merchant
      const name = merchant.charAt(0).toUpperCase() + merchant.slice(1);
      worstInsight = {
        type: "unusual-charge",
        severity: "warning",
        message: `${name} charge of ${formatDollars(maxCharge)} is ${Math.round(ratio)}× your usual ${formatDollars(avgCents)}`,
      };
    }
  }

  return worstInsight ? [worstInsight] : [];
}

function spendingSpike(transactions: Transaction[], now: string): Insight[] {
  const date = new Date(now + "T00:00:00");
  const year = date.getFullYear();
  const month = date.getMonth();
  const dayOfMonth = date.getDate();

  if (dayOfMonth < 5) return []; // too early to detect a spike

  // Last month total spending
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonthDays = new Date(prevYear, prevMonth + 1, 0).getDate();

  let lastMonthSpending = 0;
  let thisMonthSpending = 0;

  for (const tx of transactions) {
    if (tx.amount.cents >= 0) continue;
    const txDate = new Date(tx.postedAt);
    const txYear = txDate.getFullYear();
    const txMonth = txDate.getMonth();

    if (txYear === year && txMonth === month) {
      thisMonthSpending += Math.abs(tx.amount.cents);
    } else if (txYear === prevYear && txMonth === prevMonth) {
      lastMonthSpending += Math.abs(tx.amount.cents);
    }
  }

  if (lastMonthSpending === 0) return []; // no baseline

  // Daily pace comparison
  const thisMonthPace = thisMonthSpending / dayOfMonth;
  const lastMonthPace = lastMonthSpending / prevMonthDays;

  if (lastMonthPace <= 0) return [];
  const ratio = thisMonthPace / lastMonthPace;

  if (ratio < 1.5) return [];

  const pctAbove = Math.round((ratio - 1) * 100);
  return [
    {
      type: "spending-spike",
      severity: "warning",
      message: `Spending pace is ${pctAbove}% above last month — ${formatDollars(thisMonthSpending)} so far`,
    },
  ];
}

function aiTipInsight(aiTip: string | undefined): Insight[] {
  if (!aiTip) return [];
  return [{ type: "ai-tip", severity: "info", message: aiTip }];
}

export function generateInsights(context: InsightContext): Insight[] {
  return [
    // Warnings first (most urgent)
    ...overspentEnvelope(context.envelopes),
    ...nearlyDepleted(context.envelopes, context.now),
    ...unusualCharge(context.transactions, context.now),
    ...spendingSpike(context.transactions, context.now),
    // AI tip — personalized, above generic info
    ...aiTipInsight(context.aiTip),
    // Info & success
    ...unassignedTransactions(context.transactions, context.assignedTransactionIds),
    ...idleFunds(context.availableToAssignCents),
    ...debtMilestone(context.envelopes),
    ...positiveNet(context.transactions, context.now),
  ];
}
