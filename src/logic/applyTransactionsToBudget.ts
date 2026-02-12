import { Budget } from "../models/Budget";
import { Transaction } from "../models/Transaction";
import { Money } from "../models/Money";
import { spendFromEnvelope } from "./spendFromEnvelope";

export type ApplyBudgetTxResult = {
  budget: Budget;
  appliedTransactionIds: Set<string>;
};

export function applyTransactionsToBudget(
  budget: Budget,
  transactions: Transaction[],
  appliedTransactionIds: Set<string> = new Set(),
): ApplyBudgetTxResult {
  // IMPORTANT: create a local set so we can safely return it
  // (and so callers can pass the returned set back next time)
  const nextAppliedIds = new Set(appliedTransactionIds);

  let nextBudget = budget;

  for (const tx of transactions) {
    // idempotency
    if (nextAppliedIds.has(tx.id)) continue;

    // only apply if this transaction is assigned to an envelope
    if (!tx.envelopeId) continue;

    // only expenses reduce envelopes
    if (tx.amount.cents >= 0) continue;

    // spendFromEnvelope expects a positive amount
    const spendAmount = Money.fromCents(Math.abs(tx.amount.cents));

    // Apply once, then mark applied
    nextBudget = spendFromEnvelope(nextBudget, tx.envelopeId, spendAmount);
    nextAppliedIds.add(tx.id);
  }

  return { budget: nextBudget, appliedTransactionIds: nextAppliedIds };
}
