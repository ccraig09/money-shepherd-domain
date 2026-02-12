import { Budget } from "../models/Budget";
import { Transaction } from "../models/Transaction";
import { TransactionInbox } from "../models/TransactionInbox";
import { TransactionAssignment } from "../models/TransactionAssignment";
import { TransactionNotFoundError } from "../errors/TransactionNotFoundError";
import { EnvelopeNotFoundError } from "../errors/EnvelopeNotFoundError";

type AssignArgs = {
  inbox: TransactionInbox;
  transactions: Transaction[];
  budget: Budget;

  transactionId: string;
  envelopeId: string;

  assignedByUserId: string;
  assignedAt: string; // ISO string (pass in from app)
};

export function assignTransactionToEnvelope(
  args: AssignArgs,
): TransactionInbox {
  const {
    inbox,
    transactions,
    budget,
    transactionId,
    envelopeId,
    assignedByUserId,
    assignedAt,
  } = args;

  const txExists = transactions.some((t) => t.id === transactionId);
  if (!txExists) throw new TransactionNotFoundError("Transaction not found.");

  const envExists = budget.envelopes.some((e) => e.id === envelopeId);
  if (!envExists) throw new EnvelopeNotFoundError("Envelope not found.");

  const assignment: TransactionAssignment = {
    transactionId,
    envelopeId,
    assignedByUserId,
    assignedAt,
  };

  // Remove from unassigned list if present
  const nextUnassigned = inbox.unassignedTransactionIds.filter(
    (id) => id !== transactionId,
  );

  return {
    unassignedTransactionIds: nextUnassigned,
    assignmentsByTransactionId: {
      ...inbox.assignmentsByTransactionId,
      [transactionId]: assignment,
    },
  };
}
