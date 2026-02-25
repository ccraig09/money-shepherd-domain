import { Transaction } from "../models/Transaction";
import { TransactionInbox } from "../models/TransactionInbox";
import { TransactionNotFoundError } from "../errors/TransactionNotFoundError";
import { TransactionNotAssignedError } from "../errors/TransactionNotAssignedError";

type UnassignArgs = {
  inbox: TransactionInbox;
  transactions: Transaction[];
  transactionId: string;
};

/**
 * Removes the assignment for a transaction, returning it to the unassigned list.
 * Pure inbox manipulation — budget balance restoration is handled by the command layer.
 */
export function unassignTransaction(args: UnassignArgs): TransactionInbox {
  const { inbox, transactions, transactionId } = args;

  const txExists = transactions.some((t) => t.id === transactionId);
  if (!txExists) throw new TransactionNotFoundError("Transaction not found.");

  const assignment = inbox.assignmentsByTransactionId[transactionId];
  if (!assignment) {
    throw new TransactionNotAssignedError("Transaction is not assigned.");
  }

  // Remove from assignments
  const { [transactionId]: _, ...remainingAssignments } =
    inbox.assignmentsByTransactionId;

  // Add back to unassigned list if not already present
  const unassigned = inbox.unassignedTransactionIds.includes(transactionId)
    ? inbox.unassignedTransactionIds
    : [...inbox.unassignedTransactionIds, transactionId];

  return {
    unassignedTransactionIds: unassigned,
    assignmentsByTransactionId: remainingAssignments,
  };
}
