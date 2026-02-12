import { TransactionAssignment } from "./TransactionAssignment";

export type TransactionInbox = {
  unassignedTransactionIds: string[];
  assignmentsByTransactionId: Record<string, TransactionAssignment>;
};
