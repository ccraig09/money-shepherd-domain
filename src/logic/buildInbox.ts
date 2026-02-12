import { Transaction } from "../models/Transaction";
import { TransactionInbox } from "../models/TransactionInbox";
import { TransactionAssignment } from "../models/TransactionAssignment";

export function buildInbox(
  transactions: Transaction[],
  existingAssignments: Record<string, TransactionAssignment> = {},
): TransactionInbox {
  const unassigned: string[] = [];

  for (const tx of transactions) {
    const alreadyAssigned =
      Boolean(tx.envelopeId) || Boolean(existingAssignments[tx.id]);
    if (!alreadyAssigned) unassigned.push(tx.id);
  }

  return {
    unassignedTransactionIds: unassigned,
    assignmentsByTransactionId: { ...existingAssignments },
  };
}
