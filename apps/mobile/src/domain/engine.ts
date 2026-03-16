import {
  Money,
  buildInbox,
  applyTransactionsToBudget,
} from "@money-shepherd/domain";
import { ensureAnonAuth } from "../infra/firebase/firebaseClient";
import { HouseholdStateRepo } from "../infra/remote/householdStateRepo";
import { loadSyncMeta, saveSyncMeta } from "../infra/local/syncMeta";
import { createEnvelope, renameEnvelope, deleteEnvelope, setTransactionNote, assignTransaction, unassignTransaction, editTransaction, deleteTransaction, transferBetweenEnvelopes, seedBudgetFromBalances, setEnvelopeGoal, clearEnvelopeGoal, setEnvelopeTarget, clearEnvelopeTarget, setEnvelopeType, addAssignmentRule, removeAssignmentRule, reorderAssignmentRules, createEnvelopeGroup, renameEnvelopeGroup, deleteEnvelopeGroup, reorderEnvelopeGroups, moveEnvelopeToGroup, deduplicateAccounts, removePlaidTransactions, removeAccounts, mergeAiPayeeMappings, dismissFirstRun } from "./commands";
import { allocateToEnvelope } from "./allocate";
import type { AppStateV1 } from "./appState";
import { APP_STATE_VERSION } from "./appState";
import { loadAppState, saveAppState, clearAppState } from "./storage";
import { nowIso, makeId } from "../lib/id";
import { withTimeout } from "../lib/timeout";
import { withRetry } from "../lib/retry";
import { debouncedAsync } from "../lib/debounce";
import { mergeTransactions } from "./mergeTransactions";
import type { SyncOutcome } from "./syncStatus";
import { classifySyncError } from "../infra/remote/syncErrors";
import type { SyncMeta } from "../infra/local/syncMeta";
import type { RemoteSnapshot } from "../infra/remote/householdStateRepo";
import { Features } from "../config/features";

const SYNC_PUSH_TIMEOUT_MS = 10_000;
const SYNC_PULL_ON_OPEN_TIMEOUT_MS = 5_000;
const SYNC_DEBOUNCE_MS = 500;

// NOTE: applyTransactionsToAccounts might be in your domain already.
// If it exists, import and use it. If not, we’ll add it next.
import { applyTransactionsToAccounts } from "@money-shepherd/domain";

import type { Account } from "@money-shepherd/domain";

export type RecomputeResult = {
  state: AppStateV1;
  syncOutcome: SyncOutcome;
  syncError?: string;
};

export type SyncNowResult = { pulledRemote: boolean; state?: AppStateV1 };

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
    createdByUserId?: string;
  }): Promise<RecomputeResult>;

  createEnvelope(args: { name: string; type?: import("@money-shepherd/domain").EnvelopeType; groupId?: string }): Promise<RecomputeResult>;
  renameEnvelope(args: { envelopeId: string; name: string }): Promise<RecomputeResult>;
  deleteEnvelope(args: { envelopeId: string }): Promise<RecomputeResult>;
  setTransactionNote(args: { transactionId: string; note: string }): Promise<RecomputeResult>;
  assignTransaction(args: {
    transactionId: string;
    envelopeId: string;
    assignedByUserId: string;
  }): Promise<RecomputeResult>;
  unassignTransaction(args: {
    transactionId: string;
  }): Promise<RecomputeResult>;
  editTransaction(args: {
    transactionId: string;
    description?: string;
    amountCents?: number;
  }): Promise<RecomputeResult>;
  deleteTransaction(args: {
    transactionId: string;
  }): Promise<RecomputeResult>;
  transferBetweenEnvelopes(args: {
    fromEnvelopeId: string;
    toEnvelopeId: string;
    amountCents: number;
  }): Promise<RecomputeResult>;
  setEnvelopeGoal(args: { envelopeId: string; goalCents: number }): Promise<RecomputeResult>;
  clearEnvelopeGoal(args: { envelopeId: string }): Promise<RecomputeResult>;
  setEnvelopeTarget(args: { envelopeId: string; targetCents: number }): Promise<RecomputeResult>;
  clearEnvelopeTarget(args: { envelopeId: string }): Promise<RecomputeResult>;
  setEnvelopeType(args: { envelopeId: string; envelopeType: import("@money-shepherd/domain").EnvelopeType }): Promise<RecomputeResult>;
  allocateToEnvelope(args: {
    envelopeId: string;
    amountCents: number;
  }): Promise<RecomputeResult>;
  seedBudgetFromBalances(args: { totalCents: number; accountIds?: string[] }): Promise<RecomputeResult>;
  addAssignmentRule(args: { pattern: string; matchType: "contains" | "exact"; envelopeId: string; priority: number }): Promise<RecomputeResult>;
  removeAssignmentRule(args: { ruleId: string }): Promise<RecomputeResult>;
  reorderAssignmentRules(args: { ruleIds: string[] }): Promise<RecomputeResult>;
  createEnvelopeGroup(args: { name: string }): Promise<RecomputeResult>;
  renameEnvelopeGroup(args: { groupId: string; name: string }): Promise<RecomputeResult>;
  deleteEnvelopeGroup(args: { groupId: string }): Promise<RecomputeResult>;
  reorderEnvelopeGroups(args: { orderedIds: string[] }): Promise<RecomputeResult>;
  moveEnvelopeToGroup(args: { envelopeId: string; groupId: string | null }): Promise<RecomputeResult>;
  confirmAllSuggestions(args: {
    assignments: { transactionId: string; envelopeId: string; assignedByUserId: string }[];
  }): Promise<RecomputeResult>;
  mergeAiPayeeMappings(mappings: Record<string, string>): Promise<RecomputeResult>;
  dismissFirstRun(): Promise<RecomputeResult>;

  importPlaidAccounts(args: {
    newAccounts: Account[];
  }): Promise<RecomputeResult>;

  /** Update Plaid account balances from fresh API data (Plaid balance is truth). */
  updatePlaidBalances(args: {
    updatedAccounts: Account[];
  }): Promise<RecomputeResult>;

  importPlaidTransactions(args: {
    transactions: import("@money-shepherd/domain").Transaction[];
  }): Promise<RecomputeResult>;

  /** Remove transactions reported as removed by Plaid (pending → posted or deleted). */
  removePlaidTransactions(args: {
    transactionIds: string[];
  }): Promise<RecomputeResult>;

  /** Remove accounts by ID (e.g. when disconnecting a stale bank). */
  removeAccounts(args: { accountIds: string[] }): Promise<RecomputeResult>;

  /** Import a validated state (from export), overwriting local, then recompute + sync. */
  importState(state: AppStateV1): Promise<RecomputeResult>;

  /** Deduplicate Plaid accounts by (name, ownerUserId). Returns count of removed duplicates. */
  deduplicateAccounts(): Promise<{ state: AppStateV1; removedCount: number }>;

  /** Pull remote then push local state to remote (bypasses debounce). */
  syncNow(): Promise<SyncNowResult>;

  /** Called when a debounced push settles — store wires this to update syncState. */
  onSyncResult: ((result: { syncOutcome: SyncOutcome; syncError?: string }) => void) | null;
};

export function createEngine(): Engine {
  async function getState(): Promise<AppStateV1> {
    const syncMeta = await loadSyncMeta();

    // If setup was completed, we must bootstrap (auth + remote load)
    if (syncMeta) {
      const existing = await loadAppState();
      if (existing) {
        // Pull-on-open: check if remote has newer data
        const remote = await pullFromRemote(syncMeta);
        if (remote && remote.rev > syncMeta.rev) {
          await saveAppState(remote.state);
          await saveSyncMeta({ ...syncMeta, rev: remote.rev });
          return remote.state;
        }
        return existing;
      }

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

  async function unassignTransactionAction(args: {
    transactionId: string;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = unassignTransaction(state, args);
    return recompute(next);
  }

  async function editTransactionAction(args: {
    transactionId: string;
    description?: string;
    amountCents?: number;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = editTransaction(state, args);
    return recompute(next);
  }

  async function deleteTransactionAction(args: {
    transactionId: string;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = deleteTransaction(state, args);
    return recompute(next);
  }

  async function transferBetweenEnvelopesAction(args: {
    fromEnvelopeId: string;
    toEnvelopeId: string;
    amountCents: number;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = transferBetweenEnvelopes(state, args);
    return recompute(next);
  }

  async function setEnvelopeGoalAction(args: {
    envelopeId: string;
    goalCents: number;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = setEnvelopeGoal(state, args);
    return recompute(next);
  }

  async function clearEnvelopeGoalAction(args: {
    envelopeId: string;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = clearEnvelopeGoal(state, args);
    return recompute(next);
  }

  async function setEnvelopeTargetAction(args: {
    envelopeId: string;
    targetCents: number;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = setEnvelopeTarget(state, args);
    return recompute(next);
  }

  async function clearEnvelopeTargetAction(args: {
    envelopeId: string;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = clearEnvelopeTarget(state, args);
    return recompute(next);
  }

  async function setEnvelopeTypeAction(args: {
    envelopeId: string;
    envelopeType: import("@money-shepherd/domain").EnvelopeType;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = setEnvelopeType(state, args);
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

  async function addAssignmentRuleAction(args: {
    pattern: string;
    matchType: "contains" | "exact";
    envelopeId: string;
    priority: number;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = addAssignmentRule(state, args);
    return recompute(next);
  }

  async function removeAssignmentRuleAction(args: {
    ruleId: string;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = removeAssignmentRule(state, args);
    return recompute(next);
  }

  async function reorderAssignmentRulesAction(args: {
    ruleIds: string[];
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = reorderAssignmentRules(state, args);
    return recompute(next);
  }

  async function createEnvelopeGroupAction(args: {
    name: string;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = createEnvelopeGroup(state, args);
    return recompute(next);
  }

  async function renameEnvelopeGroupAction(args: {
    groupId: string;
    name: string;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = renameEnvelopeGroup(state, args);
    return recompute(next);
  }

  async function deleteEnvelopeGroupAction(args: {
    groupId: string;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = deleteEnvelopeGroup(state, args);
    return recompute(next);
  }

  async function reorderEnvelopeGroupsAction(args: {
    orderedIds: string[];
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = reorderEnvelopeGroups(state, args);
    return recompute(next);
  }

  async function moveEnvelopeToGroupAction(args: {
    envelopeId: string;
    groupId: string | null;
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = moveEnvelopeToGroup(state, args);
    return recompute(next);
  }

  async function confirmAllSuggestionsAction(args: {
    assignments: { transactionId: string; envelopeId: string; assignedByUserId: string }[];
  }): Promise<RecomputeResult> {
    let state = await getState();
    for (const assignment of args.assignments) {
      state = assignTransaction(state, assignment);
    }
    return recompute(state);
  }

  async function mergeAiPayeeMappingsAction(mappings: Record<string, string>): Promise<RecomputeResult> {
    const state = await getState();
    const next = mergeAiPayeeMappings(state, mappings);
    return recompute(next);
  }

  async function dismissFirstRunAction(): Promise<RecomputeResult> {
    const state = await getState();
    const next = dismissFirstRun(state);
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

  /** Pull remote snapshot, returning null on any failure (graceful degradation). */
  async function pullFromRemote(syncMeta: SyncMeta): Promise<RemoteSnapshot | null> {
    if (!Features.REMOTE_SYNC) return null;
    try {
      await withTimeout(ensureAnonAuth(), SYNC_PULL_ON_OPEN_TIMEOUT_MS, "Auth");
      const repo = new HouseholdStateRepo(syncMeta.householdId);
      return await withTimeout(repo.pull(), SYNC_PULL_ON_OPEN_TIMEOUT_MS, "Pull on open");
    } catch (err) {
      console.warn("Pull on open failed (using local cache):", err);
      return null;
    }
  }

  /** Push state to Firestore (called by the debounced scheduler). */
  async function pushToRemote(next: AppStateV1): Promise<void> {
    if (!Features.REMOTE_SYNC) return;
    const syncMeta = await loadSyncMeta();
    if (!syncMeta) return;

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

      await saveSyncMeta({ ...syncMeta, rev: pushed.rev });
      engineApi.onSyncResult?.({ syncOutcome: "pushed" });
    } catch (err: any) {
      if (err?.code === "SYNC_CONFLICT") {
        try {
          const remote = await withTimeout(repo.pull(), SYNC_PUSH_TIMEOUT_MS, "Sync pull");
          if (remote) {
            await saveAppState(remote.state);
            await saveSyncMeta({ ...syncMeta, rev: remote.rev });
            engineApi.onSyncResult?.({ syncOutcome: "conflict-resolved" });
            return;
          }
        } catch (pullErr) {
          console.warn("Sync pull after conflict failed", pullErr);
        }
      } else {
        console.warn("Sync push failed", err);
      }
      const friendly = classifySyncError(err);
      engineApi.onSyncResult?.({ syncOutcome: "error", syncError: friendly.message });
    }
  }

  const schedulePush = debouncedAsync(pushToRemote, SYNC_DEBOUNCE_MS);

  async function importState(state: AppStateV1): Promise<RecomputeResult> {
    return recompute(state);
  }

  async function deduplicateAccountsAction(): Promise<{ state: AppStateV1; removedCount: number }> {
    const state = await getState();
    const result = deduplicateAccounts(state);
    if (result.removedCount === 0) return result;
    const recomputed = await recompute(result.state);
    return { state: recomputed.state, removedCount: result.removedCount };
  }

  async function syncNow(): Promise<SyncNowResult> {
    const syncMeta = await loadSyncMeta();
    if (!syncMeta) return { pulledRemote: false };

    // Pull first — adopt remote if newer
    const remote = await pullFromRemote(syncMeta);
    if (remote && remote.rev > syncMeta.rev) {
      await saveAppState(remote.state);
      await saveSyncMeta({ ...syncMeta, rev: remote.rev });
      engineApi.onSyncResult?.({ syncOutcome: "conflict-resolved" });
      return { pulledRemote: true, state: remote.state };
    }

    // Then push local
    const state = await loadAppState();
    if (!state) return { pulledRemote: false };
    await pushToRemote(state);
    return { pulledRemote: false };
  }

  async function recompute(state: AppStateV1): Promise<RecomputeResult> {
    // 1) Apply transactions to accounts (ledger balances)
    //    Plaid accounts use "Plaid balance is truth" — their balances come
    //    from the API, not from ledger computation. Only manual accounts
    //    need transaction-based balance updates.
    const plaidAccounts = state.accounts.filter((a) => a.id.startsWith("plaid-"));
    const manualAccounts = state.accounts.filter((a) => !a.id.startsWith("plaid-"));
    const accountAppliedSet = new Set(state.appliedAccountTransactionIds);
    const accountsResult = applyTransactionsToAccounts(
      manualAccounts,
      state.transactions,
      accountAppliedSet,
    );
    // Merge Plaid accounts back (unchanged — their balances are API-driven)
    accountsResult.accounts = [...accountsResult.accounts, ...plaidAccounts];

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
      schedulePush(next);
    }
    return { state: next, syncOutcome: "local-only" };
  }

  async function addManualTransaction(args: {
    accountId: string;
    amountCents: number;
    description: string;
    postedAt?: string;
    createdByUserId?: string;
  }): Promise<RecomputeResult> {
    if (args.amountCents === 0) {
      throw new Error("Amount must be nonzero.");
    }

    const state = await getState();

    const accountExists = state.accounts.some((a) => a.id === args.accountId);
    if (!accountExists) {
      throw new Error(`Account "${args.accountId}" not found.`);
    }

    const tx = {
      id: makeId("tx"),
      accountId: args.accountId,
      amount: Money.fromCents(args.amountCents),
      description: args.description,
      postedAt: args.postedAt ?? nowIso(),
      // envelopeId intentionally omitted (Inbox flow will assign)
      ...(args.createdByUserId ? { createdByUserId: args.createdByUserId } : {}),
    };

    const next: AppStateV1 = {
      ...state,
      transactions: [tx, ...state.transactions],
    };

    return recompute(next);
  }

  async function seedBudget(args: { totalCents: number; accountIds?: string[] }): Promise<RecomputeResult> {
    const state = await getState();
    const next = seedBudgetFromBalances(state, args);
    return recompute(next);
  }

  async function importPlaidAccounts(args: {
    newAccounts: Account[];
  }): Promise<RecomputeResult> {
    // Always pull the latest cloud state before merging Plaid accounts.
    // getState() only pulls if remote.rev > local.rev, which can miss updates
    // when both household members connect banks on separate devices at around
    // the same time. A fresh pull ensures we merge against the true shared
    // state, so neither user's accounts get overwritten.
    const syncMeta = await loadSyncMeta();
    let state: AppStateV1;
    if (syncMeta && Features.REMOTE_SYNC) {
      const remote = await pullFromRemote(syncMeta);
      if (remote) {
        state = remote.state;
        await saveAppState(remote.state);
        await saveSyncMeta({ ...syncMeta, rev: remote.rev });
      } else {
        state = await getState();
      }
    } else {
      state = await getState();
    }

    const existingIds = new Set(state.accounts.map((a) => a.id));
    const toAdd = args.newAccounts.filter((a) => !existingIds.has(a.id));

    if (toAdd.length === 0) return { state, syncOutcome: "local-only" };

    const next: AppStateV1 = {
      ...state,
      accounts: [...state.accounts, ...toAdd],
    };

    return recompute(next);
  }

  async function updatePlaidBalances(args: {
    updatedAccounts: Account[];
  }): Promise<RecomputeResult> {
    // Pull latest remote state before applying — same pattern as importPlaidAccounts.
    // Without this, Device A can push stale partner balances because its local
    // cache hasn't received Device B's recent push yet.
    const syncMeta = await loadSyncMeta();
    let state: AppStateV1;
    if (syncMeta && Features.REMOTE_SYNC) {
      const remote = await pullFromRemote(syncMeta);
      if (remote) {
        state = remote.state;
        await saveAppState(remote.state);
        await saveSyncMeta({ ...syncMeta, rev: remote.rev });
      } else {
        state = await getState();
      }
    } else {
      state = await getState();
    }

    // Build a lookup of fresh data keyed by account ID.
    // Only accounts whose IDs appear here will have their balance updated.
    const updatedById = new Map(args.updatedAccounts.map((a) => [a.id, a]));

    const existingIds = new Set(state.accounts.map((a) => a.id));

    const accounts = state.accounts.map((existing) => {
      const fresh = updatedById.get(existing.id);
      if (!fresh) return existing;
      // Copy balance, accountType, and name from fresh Plaid data.
      // Also carry over ownerUserId and institutionName if provided (backfill).
      return {
        ...existing,
        name: fresh.name,
        balance: fresh.balance,
        accountType: fresh.accountType,
        ...(fresh.ownerUserId && { ownerUserId: fresh.ownerUserId }),
        ...(fresh.institutionName && { institutionName: fresh.institutionName }),
      };
    });

    // Add any new accounts not yet in state (e.g. partner connected on another device)
    const newAccounts = args.updatedAccounts.filter((a) => !existingIds.has(a.id));

    const next: AppStateV1 = { ...state, accounts: [...accounts, ...newAccounts] };
    return recompute(next);
  }

  async function removePlaidTransactionsAction(args: {
    transactionIds: string[];
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = removePlaidTransactions(state, args);
    if (next === state) return { state, syncOutcome: "local-only" };
    return recompute(next);
  }

  async function removeAccountsAction(args: {
    accountIds: string[];
  }): Promise<RecomputeResult> {
    const state = await getState();
    const next = removeAccounts(state, args);
    if (next === state) return { state, syncOutcome: "local-only" };
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

  const engineApi: Engine = {
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
    unassignTransaction: unassignTransactionAction,
    editTransaction: editTransactionAction,
    deleteTransaction: deleteTransactionAction,
    transferBetweenEnvelopes: transferBetweenEnvelopesAction,
    setEnvelopeGoal: setEnvelopeGoalAction,
    clearEnvelopeGoal: clearEnvelopeGoalAction,
    setEnvelopeTarget: setEnvelopeTargetAction,
    clearEnvelopeTarget: clearEnvelopeTargetAction,
    setEnvelopeType: setEnvelopeTypeAction,
    allocateToEnvelope: allocateToEnvelopeAction,
    seedBudgetFromBalances: seedBudget,
    addAssignmentRule: addAssignmentRuleAction,
    removeAssignmentRule: removeAssignmentRuleAction,
    reorderAssignmentRules: reorderAssignmentRulesAction,
    createEnvelopeGroup: createEnvelopeGroupAction,
    renameEnvelopeGroup: renameEnvelopeGroupAction,
    deleteEnvelopeGroup: deleteEnvelopeGroupAction,
    reorderEnvelopeGroups: reorderEnvelopeGroupsAction,
    moveEnvelopeToGroup: moveEnvelopeToGroupAction,
    confirmAllSuggestions: confirmAllSuggestionsAction,
    mergeAiPayeeMappings: mergeAiPayeeMappingsAction,
    dismissFirstRun: dismissFirstRunAction,
    importPlaidAccounts,
    updatePlaidBalances,
    importPlaidTransactions,
    removePlaidTransactions: removePlaidTransactionsAction,
    importState,
    removeAccounts: removeAccountsAction,
    deduplicateAccounts: deduplicateAccountsAction,
    syncNow,
    onSyncResult: null,
  };
  return engineApi;
}
