import type { Budget } from "@money-shepherd/domain";
import type { Account } from "@money-shepherd/domain";
import type { Transaction } from "@money-shepherd/domain";
import type { TransactionInbox } from "@money-shepherd/domain";

// Keep this stable. It becomes your “single source of truth” snapshot.
export type AppStateV1 = {
  version: 1;

  // Household identity (simple for now)
  householdId: string;

  // Minimal users (used for assignment audit)
  users: Array<{ id: string; displayName: string }>;

  // Domain state
  budget: Budget;
  accounts: Account[];
  transactions: Transaction[];
  inbox: TransactionInbox;

  // Idempotency guards
  appliedAccountTransactionIds: string[];
  appliedBudgetTransactionIds: string[];

  // Audit meta
  updatedAt: string; // ISO
};

export const APP_STATE_VERSION = 1 as const;
