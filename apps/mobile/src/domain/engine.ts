import {
  Money,
  buildInbox,
  applyTransactionsToBudget,
} from "@money-shepherd/domain";
import { ensureAnonAuth } from "../infra/firebase/firebaseClient";
import { HouseholdStateRepo } from "../infra/remote/householdStateRepo";
import { loadSyncMeta, saveSyncMeta } from "../infra/local/syncMeta";
import { createEnvelope, renameEnvelope, deleteEnvelope, setTransactionNote, assignTransaction } from "./commands";
import { allocateToEnvelope } from "./allocate";
import type { AppStateV1 } from "./appState";
import { APP_STATE_VERSION } from "./appState";
import { loadAppState, saveAppState, clearAppState } from "./storage";
import { nowIso, makeId } from "../lib/id";
import { withTimeout } from "../lib/timeout";
import { withRetry } from "../lib/retry";
import { mergeTransactions } from "./mergeTransactions";
import type { SyncOutcome } from "./syncStatus";
import { classifySyncError } from "../infra/remote/syncErrors";

const SYNC_PUSH_TIMEOUT_MS = 10_000;

// NOTE: applyTransactionsToAccounts might be in your domain already.
// If it exists, import and use it. If not, we’ll add it next.
import { applyTransactionsToAccounts } from "@money-shepherd/domain";

import type { Account } from "@money-shepherd/domain";

export type RecomputeResult = {
  state: AppStateV1;
  syncOutcome: SyncOutcome;
  syncError?: string;
};

export type Engine = {
  getState(): Promise<AppStateV1>;
  seed(): Promise<AppStateV1>;
  reset(): Promise<void>;
  recompute(state: AppStateV1): Promise<RecomputeResult>;

  // Mutation commands — all return RecomputeResult with sync outcome
  addManualTransaction(args: {
    accountId: string;
    amountCents: number; // positive income, negative expense
    description: string;
    postedAt?: string;
  }): Promise<RecomputeResult>;

  createEnvelope(args: { name: string }): Promise<RecomputeResult>;
  renameEnvelope(args: { envelopeId: string; name: string }): Promise<RecomputeResult>;
  deleteEnvelope(args: { envelopeId: string }): Promise<RecomputeResult>;
  setTransactionNote(args: { transactionId: string; note: string }): Promise<RecomputeResult>;
  assignTransaction(args: {
    transactionId: string;
    envelopeId: string;
    assignedByUserId: string;
  }): Promise<RecomputeResult>;
  allocateToEnvelope(args: {
    envelopeId: string;
    amountCents: number;
  }): Promise<RecomputeResult>;

  importPlaidAccounts(args: {
    newAccounts: Account[];
  }): Promise<RecomputeResult>;

  importPlaidTransactions(args: {
    transactions: import("@money-shepherd/domain").Transaction[];
  }): Promise<RecomputeResult>;
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
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = createEnvelope(state, args);
    return recompute(next);
  }

  async function renameEnvelopeAction(args: {
    envelopeId: string;
    name: string;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = renameEnvelope(state, args);
    return recompute(next);
  }

  async function deleteEnvelopeAction(args: {
    envelopeId: string;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = deleteEnvelope(state, args);
    return recompute(next);
  }

  async function setTransactionNoteAction(args: {
    transactionId: string;
    note: string;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = setTransactionNote(state, args);
    return recompute(next);
  }

  async function assignTransactionAction(args: {
    transactionId: string;
    envelopeId: string;
    assignedByUserId: string;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = assignTransaction(state, args);
    return recompute(next);
  }

  async function allocateToEnvelopeAction(args: {
    envelopeId: string;
    amountCents: number;
  }): Promise<RecomputeResult> {
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

    const result = await recompute(state);
    await saveAppState(result.state);
    return result.state;
  }

  async function reset(): Promise<void> {
    // Clear remote (Firestore) first — syncMeta still available at this point
    const syncMeta = await loadSyncMeta();
    if (syncMeta) {
      try {
        const repo = new HouseholdStateRepo(syncMeta.householdId);
        await ensureAnonAuth();
        await repo.clear();
      } catch (err) {
        console.warn("Failed to clear remote state (continuing local reset):", err);
      }
    }
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

    // No remote state — seed or push local.
    // seed() → recompute() already handles saving + pushing to Firestore,
    // so we don't push again here (that would cause SYNC_CONFLICT).
    const local = await loadAppState();

    if (!local) {
      return seed();
    }

    // local exists but remote doesn't — push it up
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

  async function recompute(state: AppStateV1): Promise<RecomputeResult> {
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
        await withTimeout(ensureAnonAuth(), SYNC_PUSH_TIMEOUT_MS, "Auth");
        const pushed = await withRetry(
          () => withTimeout(
            repo.push({
              expectedRev: syncMeta.rev,
              nextState: next,
              updatedBy: syncMeta.userId,
            }),
            SYNC_PUSH_TIMEOUT_MS,
            "Sync push",
          ),
          {
            maxRetries: 3,
            baseDelayMs: 500,
            shouldRetry: (err) => (err as any)?.code !== "SYNC_CONFLICT",
          },
        );

        await saveSyncMeta({
          ...syncMeta,
          rev: pushed.rev,
        });

        return { state: next, syncOutcome: "pushed" };
      } catch (err: any) {
        if (err?.code === "SYNC_CONFLICT") {
          // MVP strategy: pull remote and overwrite local
          try {
            const remote = await withTimeout(repo.pull(), SYNC_PUSH_TIMEOUT_MS, "Sync pull");
            if (remote) {
              await saveAppState(remote.state);
              await saveSyncMeta({
                ...syncMeta,
                rev: remote.rev,
              });
              return { state: remote.state, syncOutcome: "conflict-resolved" };
            }
          } catch (pullErr) {
            console.warn("Sync pull after conflict failed", pullErr);
          }
        } else {
          console.warn("Sync push failed", err);
        }
        const friendly = classifySyncError(err);
        return { state: next, syncOutcome: "error", syncError: friendly.message };
      }
    }
    return { state: next, syncOutcome: syncMeta ? "error" : "local-only" };
  }

  async function addManualTransaction(args: {
    accountId: string;
    amountCents: number;
    description: string;
    postedAt?: string;
  }): Promise<RecomputeResult> {
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

  async function importPlaidAccounts(args: {
    newAccounts: Account[];
  }): Promise<RecomputeResult> {
    const state = await getState();
    const existingIds = new Set(state.accounts.map((a) => a.id));
    const toAdd = args.newAccounts.filter((a) => !existingIds.has(a.id));

    if (toAdd.length === 0) return { state, syncOutcome: "local-only" };

    const next: AppStateV1 = {
      ...state,
      accounts: [...state.accounts, ...toAdd],
    };

    return recompute(next);
  }

  async function importPlaidTransactions(args: {
    transactions: import("@money-shepherd/domain").Transaction[];
  }): Promise<RecomputeResult> {
    const state = await getState();
    const merged = mergeTransactions(state.transactions, args.transactions);

    if (merged.length === state.transactions.length) return { state, syncOutcome: "local-only" };

    const next: AppStateV1 = { ...state, transactions: merged };
    return recompute(next);
  }

  return {
    getState,
    seed,
    reset,
    recompute,
    addManualTransaction,
    createEnvelope: createEnvelopeAction,
    renameEnvelope: renameEnvelopeAction,
    deleteEnvelope: deleteEnvelopeAction,
    setTransactionNote: setTransactionNoteAction,
    assignTransaction: assignTransactionAction,
    allocateToEnvelope: allocateToEnvelopeAction,
    importPlaidAccounts,
    importPlaidTransactions,
  };
}
