import {
  Money,
  buildInbox,
  applyTransactionsToBudget,
} from "@money-shepherd/domain";
import { ensureAnonAuth } from "../infra/firebase/firebaseClient";
import { HouseholdStateRepo } from "../infra/remote/householdStateRepo";
import { loadSyncMeta, saveSyncMeta } from "../infra/local/syncMeta";
import { createEnvelope, assignTransaction } from "./commands";
import { allocateToEnvelope } from "./allocate";
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

  createEnvelope(args: { name: string }): Promise<AppStateV1>;
  assignTransaction(args: {
    transactionId: string;
    envelopeId: string;
    assignedByUserId: string;
  }): Promise<AppStateV1>;
  allocateToEnvelope(args: {
    envelopeId: string;
    amountCents: number;
  }): Promise<AppStateV1>;
};

export function createEngine(): Engine {
  async function getState(): Promise<AppStateV1> {
    const syncMeta = await loadSyncMeta();

    // If setup was completed, we must bootstrap (auth + remote load)
    if (syncMeta) {
      const existing = await loadAppState();
      if (existing) return existing;

      // bootstrap will ensure anon auth, pull remote, seed+push if needed
      return bootstrap();
    }

    // No sync configured yet: local-only
    const existing = await loadAppState();
    if (existing) return existing;
    return seed();
  }

  async function createEnvelopeAction(args: {
    name: string;
  }): Promise<AppStateV1> {
    const state = await getState();
    const next = createEnvelope(state, args);
    return recompute(next);
  }

  async function assignTransactionAction(args: {
    transactionId: string;
    envelopeId: string;
    assignedByUserId: string;
  }): Promise<AppStateV1> {
    const state = await getState();
    const next = assignTransaction(state, args);
    return recompute(next);
  }

  async function allocateToEnvelopeAction(args: {
    envelopeId: string;
    amountCents: number;
  }): Promise<AppStateV1> {
    const state = await getState();
    const next = allocateToEnvelope(state, args);
    return recompute(next);
  }

  async function seed(): Promise<AppStateV1> {
    const syncMeta = await loadSyncMeta();
    const householdId = syncMeta?.householdId ?? "household-local";

    const userLos = { id: "user-los", displayName: "Los" };
    const userJackia = { id: "user-jackia", displayName: "Jackia" };

    const accountLos = {
      id: "acc-los",
      name: "Los Checking",
      balance: Money.fromCents(0),
      institution: "Manual",
    };

    const accountJackia = {
      id: "acc-jackia",
      name: "Jackia Checking",
      balance: Money.fromCents(0),
      institution: "Manual",
    };

    const budget = {
      id: householdId,
      availableToAssign: Money.fromCents(0),
      envelopes: [],
    };

    const emptyInbox = {
      unassignedTransactionIds: [],
      assignmentsByTransactionId: {},
    };

    const state: AppStateV1 = {
      version: APP_STATE_VERSION,
      householdId: householdId,
      users: [userLos, userJackia],
      budget,
      accounts: [accountLos, accountJackia],
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

  async function bootstrap(): Promise<AppStateV1> {
    const user = await ensureAnonAuth();
    console.log("Anon UID:", user.uid);

    const syncMeta = await loadSyncMeta();
    if (!syncMeta) {
      throw new Error("Sync meta missing. Setup required.");
    }

    const repo = new HouseholdStateRepo(syncMeta.householdId);

    const remote = await repo.pull();

    // If remote exists → use it
    if (remote) {
      await saveAppState(remote.state);

      await saveSyncMeta({
        ...syncMeta,
        rev: remote.rev,
      });

      return remote.state;
    }

    // If no remote → seed local then push
    const local = await loadAppState();

    if (!local) {
      const seeded = await seed();
      await saveAppState(seeded);

      const pushed = await repo.push({
        expectedRev: 0,
        nextState: seeded,
        updatedBy: syncMeta.userId,
      });

      await saveSyncMeta({
        ...syncMeta,
        rev: pushed.rev,
      });

      return seeded;
    }

    // local exists but remote doesn't
    const pushed = await repo.push({
      expectedRev: 0,
      nextState: local,
      updatedBy: syncMeta.userId,
    });

    await saveSyncMeta({
      ...syncMeta,
      rev: pushed.rev,
    });

    return local;
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
    const syncMeta = await loadSyncMeta();
    if (syncMeta) {
      const repo = new HouseholdStateRepo(syncMeta.householdId);

      try {
        await ensureAnonAuth();
        const pushed = await repo.push({
          expectedRev: syncMeta.rev,
          nextState: next,
          updatedBy: syncMeta.userId,
        });

        await saveSyncMeta({
          ...syncMeta,
          rev: pushed.rev,
        });
      } catch (err: any) {
        if (err?.code === "SYNC_CONFLICT") {
          // MVP strategy: pull remote and overwrite local
          const remote = await repo.pull();
          if (remote) {
            await saveAppState(remote.state);
            await saveSyncMeta({
              ...syncMeta,
              rev: remote.rev,
            });
            return remote.state;
          }
        } else {
          console.warn("Sync push failed", err);
        }
      }
    }
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

  return {
    getState,
    seed,
    reset,
    recompute,
    addManualTransaction,
    createEnvelope: createEnvelopeAction,
    assignTransaction: assignTransactionAction,
    allocateToEnvelope: allocateToEnvelopeAction,
  };
}
