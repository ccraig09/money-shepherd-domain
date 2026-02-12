import { Budget } from "../models/Budget";
import { Transaction } from "../models/Transaction";
import { TransactionAssignment } from "../models/TransactionAssignment";
import { Money } from "../models/Money";
import { spendFromEnvelope } from "./spendFromEnvelope";

export type ApplyBudgetTxResult = {
  budget: Budget;
  appliedTransactionIds: Set<string>;
};

export type ApplyBudgetTxOptions = {
  assignmentsByTransactionId?: Record<string, TransactionAssignment>;
};

export function applyTransactionsToBudget(
  budget: Budget,
  transactions: Transaction[],
  appliedTransactionIds: Set<string> = new Set(),
  options: ApplyBudgetTxOptions = {},
): ApplyBudgetTxResult {
  const nextAppliedIds = new Set(appliedTransactionIds);
  let nextBudget = budget;

  const assignments = options.assignmentsByTransactionId ?? {};

  for (const tx of transactions) {
    if (nextAppliedIds.has(tx.id)) continue;

    // INCOME: increase availableToAssign
    if (tx.amount.cents > 0) {
      nextBudget = {
        ...nextBudget,
        availableToAssign: nextBudget.availableToAssign.add(tx.amount),
      };
      nextAppliedIds.add(tx.id);
      continue;
    }

    // EXPENSE: must be assigned to an envelope
    const envelopeId = assignments[tx.id]?.envelopeId ?? tx.envelopeId;
    if (!envelopeId) continue;

    const spendAmount = Money.fromCents(Math.abs(tx.amount.cents));
    nextBudget = spendFromEnvelope(nextBudget, envelopeId, spendAmount);

    nextAppliedIds.add(tx.id);
  }

  return { budget: nextBudget, appliedTransactionIds: nextAppliedIds };
}
