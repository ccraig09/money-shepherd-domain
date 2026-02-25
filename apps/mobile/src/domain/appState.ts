import type { Budget } from "@money-shepherd/domain";
import type { Account } from "@money-shepherd/domain";
import type { Transaction } from "@money-shepherd/domain";
import type { TransactionInbox } from "@money-shepherd/domain";
import type { Allocation } from "@money-shepherd/domain";

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

  // User notes on transactions (transactionId → note text)
  transactionNotes?: Record<string, string>;

  // Allocation log — records every paycheck fill for period-aware funding
  allocations?: Allocation[];

  // Set true after user seeds Available to Assign from bank balances (prevents re-prompting)
  budgetSeeded?: boolean;

  // Account IDs that have been included in a seed (prevents re-counting on re-seed)
  seededAccountIds?: string[];

  // Idempotency guards
  appliedAccountTransactionIds: string[];
  appliedBudgetTransactionIds: string[];

  // Audit meta
  updatedAt: string; // ISO
};

export const APP_STATE_VERSION = 1 as const;
