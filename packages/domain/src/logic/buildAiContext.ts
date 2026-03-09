import type { Account } from "../models/Account";
import type { Budget } from "../models/Budget";
import type { Transaction } from "../models/Transaction";
import { normalizePayee } from "./normalizePayee";
import { getCurrentPeriod } from "./periodHelpers";

/**
 * Sanitized, token-efficient summary of app state for AI consumption.
 * Contains NO PII: no account names, no user names, no IDs, no institution names.
 */
export type AiContext = {
  totalIncomeCents: number;
  totalExpensesCents: number; // absolute value
  availableToAssignCents: number;
  envelopes: AiEnvelopeSummary[];
  topMerchants: AiMerchantSummary[];
  accountSummary: AiAccountSummary[];
  transactionCount: number;
  periodStartDate: string; // YYYY-MM-DD
  periodEndDate: string; // YYYY-MM-DD
};

export type AiEnvelopeSummary = {
  name: string;
  balanceCents: number;
  goalCents?: number;
  type?: string;
};

export type AiMerchantSummary = {
  normalizedName: string;
  totalCents: number; // absolute value of spend
  count: number;
};

export type AiAccountSummary = {
  type: string;
  balanceCents: number;
  count: number;
};

const MAX_TOP_MERCHANTS = 15;

type MinimalState = {
  budget: Budget;
  accounts: Account[];
  transactions: Transaction[];
};

/**
 * Build a sanitized AI context from app state.
 * Strips all PII — only aggregate amounts, envelope names, and normalized merchants.
 */
export function buildAiContext(state: MinimalState): AiContext {
  const now = new Date().toISOString();
  const period = getCurrentPeriod(now);

  // Filter to current period, non-pending transactions
  const periodTxs = state.transactions.filter((tx) => {
    if (tx.isPending) return false;
    const date = tx.postedAt.slice(0, 10);
    return date >= period.startDate && date <= period.endDate;
  });

  // Aggregate income / expenses
  let totalIncomeCents = 0;
  let totalExpensesCents = 0;
  for (const tx of periodTxs) {
    if (tx.amount.cents > 0) {
      totalIncomeCents += tx.amount.cents;
    } else {
      totalExpensesCents += Math.abs(tx.amount.cents);
    }
  }

  // Envelopes — names are user-created categories, safe to send
  const envelopes: AiEnvelopeSummary[] = state.budget.envelopes.map((e) => {
    const summary: AiEnvelopeSummary = {
      name: e.name,
      balanceCents: e.balance.cents,
    };
    if (e.goal) summary.goalCents = e.goal.cents;
    if (e.type) summary.type = e.type;
    return summary;
  });

  // Top merchants — expenses only, aggregated by normalized payee
  const merchantMap = new Map<string, { totalCents: number; count: number }>();
  for (const tx of periodTxs) {
    if (tx.amount.cents >= 0) continue; // skip income
    const name = normalizePayee(tx.description);
    if (!name) continue;
    const entry = merchantMap.get(name) ?? { totalCents: 0, count: 0 };
    entry.totalCents += Math.abs(tx.amount.cents);
    entry.count += 1;
    merchantMap.set(name, entry);
  }

  const topMerchants: AiMerchantSummary[] = Array.from(merchantMap.entries())
    .map(([normalizedName, data]) => ({
      normalizedName,
      totalCents: data.totalCents,
      count: data.count,
    }))
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, MAX_TOP_MERCHANTS);

  // Account summary — grouped by type, no names or IDs
  const typeMap = new Map<string, { balanceCents: number; count: number }>();
  for (const acct of state.accounts) {
    const type = acct.accountType ?? "depository";
    const entry = typeMap.get(type) ?? { balanceCents: 0, count: 0 };
    entry.balanceCents += acct.balance.cents;
    entry.count += 1;
    typeMap.set(type, entry);
  }

  const accountSummary: AiAccountSummary[] = Array.from(typeMap.entries()).map(
    ([type, data]) => ({
      type,
      balanceCents: data.balanceCents,
      count: data.count,
    }),
  );

  return {
    totalIncomeCents,
    totalExpensesCents,
    availableToAssignCents: state.budget.availableToAssign.cents,
    envelopes,
    topMerchants,
    accountSummary,
    transactionCount: periodTxs.length,
    periodStartDate: period.startDate,
    periodEndDate: period.endDate,
  };
}
