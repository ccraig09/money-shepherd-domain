import {
  Money,
  buildInbox,
  applyTransactionsToBudget,
} from "@money-shepherd/domain";

import type { AppStateV1 } from "./appState";
import { APP_STATE_VERSION } from "./appState";
import { loadAppState, saveAppState, clearAppState } from "./storage";
import { nowIso, makeId } from "../lib/id";

// NOTE: applyTransactionsToAccounts might be in your domain already.
// If it exists, import and use it. If not, we’ll add it next.
import { applyTransactionsToAccounts } from "@money-shepherd/domain";

export type Engine = {
  getState(): Promise<AppStateV1>;
  seed(): Promise<AppStateV1>;
  reset(): Promise<void>;
  recompute(state: AppStateV1): Promise<AppStateV1>;

  // Simple commands for Phase 10 UI
  addManualTransaction(args: {
    accountId: string;
    amountCents: number; // positive income, negative expense
    description: string;
    postedAt?: string;
  }): Promise<AppStateV1>;
};

export function createEngine(): Engine {
  async function getState(): Promise<AppStateV1> {
    const existing = await loadAppState();
    if (existing) return existing;
    return seed();
  }

  async function seed(): Promise<AppStateV1> {
    const userLos = { id: "user-los", displayName: "Los" };
    const userWife = { id: "user-wife", displayName: "Wife" };

    const accountLos = {
      id: "acc-los",
      name: "Los Checking",
      balance: Money.fromCents(0),
      institution: "Manual",
    };

    const accountWife = {
      id: "acc-wife",
      name: "Wife Checking",
      balance: Money.fromCents(0),
      institution: "Manual",
    };

    const budget = {
      id: "household-1",
      availableToAssign: Money.fromCents(0),
      envelopes: [],
    };

    const emptyInbox = {
      unassignedTransactionIds: [],
      assignmentsByTransactionId: {},
    };

    const state: AppStateV1 = {
      version: APP_STATE_VERSION,
      householdId: "household-1",
      users: [userLos, userWife],
      budget,
      accounts: [accountLos, accountWife],
      transactions: [],
      inbox: emptyInbox,
      appliedAccountTransactionIds: [],
      appliedBudgetTransactionIds: [],
      updatedAt: nowIso(),
    };

    const computed = await recompute(state);
    await saveAppState(computed);
    return computed;
  }

  async function reset(): Promise<void> {
    await clearAppState();
  }

  async function recompute(state: AppStateV1): Promise<AppStateV1> {
    // 1) Apply transactions to accounts (ledger balances)
    const accountAppliedSet = new Set(state.appliedAccountTransactionIds);
    const accountsResult = applyTransactionsToAccounts(
      state.accounts,
      state.transactions,
      accountAppliedSet,
    );

    // 2) Inbox: derive unassigned based on tx + existing assignments
    const inbox = buildInbox(
      state.transactions,
      state.inbox.assignmentsByTransactionId,
    );

    // 3) Apply transactions to budget using assignments as truth
    const budgetAppliedSet = new Set(state.appliedBudgetTransactionIds);
    const budgetResult = applyTransactionsToBudget(
      state.budget,
      state.transactions,
      budgetAppliedSet,
      { assignmentsByTransactionId: inbox.assignmentsByTransactionId },
    );

    const next: AppStateV1 = {
      ...state,
      accounts: accountsResult.accounts,
      inbox,
      budget: budgetResult.budget,
      appliedAccountTransactionIds: Array.from(
        accountsResult.appliedTransactionIds,
      ),
      appliedBudgetTransactionIds: Array.from(
        budgetResult.appliedTransactionIds,
      ),
      updatedAt: nowIso(),
    };

    await saveAppState(next);
    return next;
  }

  async function addManualTransaction(args: {
    accountId: string;
    amountCents: number;
    description: string;
    postedAt?: string;
  }): Promise<AppStateV1> {
    const state = await getState();

    const tx = {
      id: makeId("tx"),
      accountId: args.accountId,
      amount: Money.fromCents(args.amountCents),
      description: args.description,
      postedAt: args.postedAt ?? nowIso(),
      // envelopeId intentionally omitted (Inbox flow will assign)
    };

    const next: AppStateV1 = {
      ...state,
      transactions: [tx, ...state.transactions],
    };

    return recompute(next);
  }

  return { getState, seed, reset, recompute, addManualTransaction };
}
