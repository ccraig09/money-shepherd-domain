import { create } from "zustand";
import { createEngine } from "../domain/engine";
import type { AppStateV1 } from "../domain/appState";
import { initialSyncState, syncTransition, type SyncState } from "../domain/syncStatus";
import { classifySyncError } from "../infra/remote/syncErrors";
import { clearSyncMeta, loadSyncMeta, saveSyncMeta } from "../infra/local/syncMeta";
import { clearPin } from "../infra/local/pin";
import { loadPlaidTokens, clearAllPlaidTokens, updateTokenCursor } from "../infra/local/secureTokens";
import { savePlaidRefreshAt, loadPlaidRefreshAt, clearPlaidRefreshAt } from "../infra/local/plaidMeta";
import { saveAiTip, loadAiTip, clearAiTip } from "../infra/local/aiTip";
import { syncTransactions, fetchAccounts } from "../infra/plaid/plaidClient";
import { mapPlaidTransactions } from "../infra/plaid/mapTransaction";
import { mapPlaidAccounts } from "../infra/plaid/mapAccounts";
import { classifyPlaidError, makePlaidError, type PlaidErrorInfo } from "../infra/plaid/errors";
import { hasDuplicateAccounts } from "../domain/commands";
import { withTimeout } from "../lib/timeout";
import { formatMoney } from "../lib/moneyFormat";
import { Features } from "../config/features";

const REFRESH_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
const PLAID_SYNC_TIMEOUT_MS = 15_000;

type LoadState = "idle" | "loading" | "ready" | "error";
type GuardState = "checking" | "needs-setup" | "needs-pin-setup" | "needs-pin" | "ready";

type ToastMessage = {
  text: string;
  variant: "success" | "error" | "info";
  action?: { label: string; onPress: () => void };
  durationMs?: number;
};

type AppStore = {
  // state
  status: LoadState;
  errorMessage: string | null;
  state: AppStateV1 | null;
  guardState: GuardState;
  syncState: SyncState;
  lastSyncAt: string | null;
  lastPlaidRefreshAt: string | null;
  plaidSyncError: PlaidErrorInfo | null;
  toast: ToastMessage | null;
  lastAiTip: string | null;

  // actions
  showToast: (text: string, variant?: ToastMessage["variant"]) => void;
  bootstrap: () => Promise<void>;
  setGuardReady: () => void;
  clearPlaidSyncError: () => void;
  resetAll: () => Promise<void>;
  switchUser: () => Promise<void>;
  resetAndSeed: () => Promise<void>;
  createEnvelope: (name: string, type?: import("@money-shepherd/domain").EnvelopeType, groupId?: string) => Promise<void>;
  renameEnvelope: (envelopeId: string, name: string) => Promise<void>;
  deleteEnvelope: (envelopeId: string) => Promise<void>;
  undoDelete: () => Promise<void>;
  setTransactionNote: (transactionId: string, note: string) => Promise<void>;
  assignTransaction: (args: {
    transactionId: string;
    envelopeId: string;
    assignedByUserId: string;
  }) => Promise<void>;
  unassignTransaction: (transactionId: string) => Promise<void>;
  editTransaction: (args: {
    transactionId: string;
    description?: string;
    amountCents?: number;
  }) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  transferBetweenEnvelopes: (args: {
    fromEnvelopeId: string;
    toEnvelopeId: string;
    amountCents: number;
  }) => Promise<void>;
  setEnvelopeGoal: (envelopeId: string, goalCents: number) => Promise<void>;
  clearEnvelopeGoal: (envelopeId: string) => Promise<void>;
  setEnvelopeTarget: (envelopeId: string, targetCents: number) => Promise<void>;
  clearEnvelopeTarget: (envelopeId: string) => Promise<void>;
  setEnvelopeType: (envelopeId: string, envelopeType: import("@money-shepherd/domain").EnvelopeType) => Promise<void>;
  addAssignmentRule: (args: { pattern: string; matchType: "contains" | "exact"; envelopeId: string; priority: number }) => Promise<void>;
  removeAssignmentRule: (ruleId: string) => Promise<void>;
  reorderAssignmentRules: (ruleIds: string[]) => Promise<void>;
  createEnvelopeGroup: (name: string) => Promise<void>;
  renameEnvelopeGroup: (groupId: string, name: string) => Promise<void>;
  deleteEnvelopeGroup: (groupId: string) => Promise<void>;
  reorderEnvelopeGroups: (orderedIds: string[]) => Promise<void>;
  moveEnvelopeToGroup: (envelopeId: string, groupId: string | null) => Promise<void>;
  confirmAllSuggestions: (assignments: { transactionId: string; envelopeId: string }[]) => Promise<void>;
  allocateToEnvelope: (args: {
    envelopeId: string;
    amountCents: number;
  }) => Promise<void>;
  fillEnvelopes: (items: { envelopeId: string; amountCents: number }[]) => Promise<void>;
  addManualTransaction: (args: {
    accountId: string;
    amountCents: number;
    description: string;
    postedAt?: string;
    createdByUserId?: string;
  }) => Promise<void>;
  seedBudgetFromBalances: (args: { totalCents: number; accountIds?: string[] }) => Promise<void>;
  markBudgetSeeded: () => Promise<void>;
  refreshFromPlaid: (opts?: { force?: boolean; silent?: boolean }) => Promise<{ imported: number; shouldSeedBudget?: boolean }>;
  deduplicateAccounts: () => Promise<void>;
  dismissFirstRun: () => Promise<void>;
  importState: (state: AppStateV1) => Promise<void>;
  syncNow: () => Promise<void>;
  analyzeSpending: () => Promise<{ suggestions: { name: string; goalCents: number; type: string; reason: string }[]; warning?: "budget_warning" }>;
  suggestAllocations: () => Promise<{ allocations: { envelopeId: string; amountCents: number; reason: string }[]; warning?: "budget_warning" }>;
  categorizeInbox: () => Promise<{ mapped: number }>;
  fetchMonthlyReview: () => Promise<import("../infra/firebase/aiTypes").MonthlyReviewResponse>;
  sendChatMessage: (messages: import("../infra/firebase/aiTypes").ChatMessageEntry[]) => Promise<import("../infra/firebase/aiTypes").ChatMessageResponse>;
  executeChatAction: (action: import("../infra/firebase/aiTypes").ChatAction | import("../infra/firebase/aiTypes").ChatAction[]) => Promise<void>;
};

const engine = createEngine();

/** Execute a single chat action against the store. Used by executeChatAction. */
async function executeSingleAction(store: AppStore, action: import("../infra/firebase/aiTypes").ChatAction) {
  const { toolName, toolInput } = action;
  const input = toolInput as Record<string, string | number>;

  switch (toolName) {
    case "create_envelope":
      await store.createEnvelope(
        input.name as string,
        (input.type as "spending" | "savings" | "debt" | "giving") ?? undefined,
      );
      break;
    case "rename_envelope":
      await store.renameEnvelope(input.envelopeId as string, input.name as string);
      break;
    case "delete_envelope":
      await store.deleteEnvelope(input.envelopeId as string);
      break;
    case "set_envelope_goal":
      await store.setEnvelopeGoal(input.envelopeId as string, input.goalCents as number);
      break;
    case "transfer_funds":
      await store.transferBetweenEnvelopes({
        fromEnvelopeId: input.fromEnvelopeId as string,
        toEnvelopeId: input.toEnvelopeId as string,
        amountCents: input.amountCents as number,
      });
      break;
    case "allocate_to_envelope":
      await store.allocateToEnvelope({
        envelopeId: input.envelopeId as string,
        amountCents: input.amountCents as number,
      });
      break;
    case "set_envelope_type":
      await store.setEnvelopeType(
        input.envelopeId as string,
        input.envelopeType as "spending" | "savings" | "debt" | "giving",
      );
      break;
    default:
      throw new Error(`Unknown chat action: ${toolName}`);
  }
}

// Undo-delete transient state (not persisted)
let _undoSnapshot: AppStateV1 | null = null;
let _undoTimer: ReturnType<typeof setTimeout> | null = null;
const UNDO_WINDOW_MS = 8_000;

// Wire debounced push callback — updates syncState when the push settles.
engine.onSyncResult = ({ syncOutcome, syncError }) => {
  const { syncState } = useAppStore.getState();
  useAppStore.setState({
    syncState: applyOutcome(syncState, syncOutcome, syncError),
    ...(syncOutcome !== "error" ? { lastSyncAt: new Date().toISOString() } : {}),
    ...(syncOutcome === "error"
      ? { toast: { text: "Sync failed, saved locally", variant: "error" } }
      : {}),
  });
};

/** Map engine sync outcome to one or two SyncEvents for the state machine. */
function syncEventsForOutcome(
  outcome: import("../domain/syncStatus").SyncOutcome,
  errorMsg?: string,
): import("../domain/syncStatus").SyncEvent[] {
  const now = new Date().toISOString();
  switch (outcome) {
    case "pushed":
      return [{ type: "sync-success", at: now }];
    case "conflict-resolved":
      return [{ type: "sync-conflict-resolved", at: now }];
    case "error":
      // Increment pending first (saved locally), then mark as error
      return [
        { type: "local-save" },
        { type: "sync-error", error: errorMsg ?? "Sync failed. Changes saved locally." },
      ];
    case "local-only":
      return [{ type: "local-save" }];
  }
}

function applyOutcome(
  current: import("../domain/syncStatus").SyncState,
  outcome: import("../domain/syncStatus").SyncOutcome,
  errorMsg?: string,
): import("../domain/syncStatus").SyncState {
  return syncEventsForOutcome(outcome, errorMsg).reduce(
    (s, e) => syncTransition(s, e),
    current,
  );
}

/**
 * Mental model:
 * - Engine owns persistence + domain recompute.
 * - Store holds the latest snapshot for the UI.
 * - UI never mutates the domain directly.
 */
export const useAppStore = create<AppStore>((set, get) => ({
  status: "idle",
  errorMessage: null,
  state: null,
  guardState: "checking",
  syncState: initialSyncState(),
  lastSyncAt: null,
  lastPlaidRefreshAt: null,
  plaidSyncError: null,
  toast: null,
  lastAiTip: null,

  showToast: (text, variant = "success") => set({ toast: { text, variant } }),
  setGuardReady: () => set({ guardState: "ready" }),
  clearPlaidSyncError: () => set({ plaidSyncError: null }),

  bootstrap: async () => {
    set({
      status: "loading",
      errorMessage: null,
      syncState: syncTransition(get().syncState, { type: "sync-start" }),
    });
    try {
      let state = await engine.getState();
      const syncMeta = await loadSyncMeta();
      const lastRefresh = syncMeta
        ? await loadPlaidRefreshAt(syncMeta.userId)
        : null;
      const savedAiTip = await loadAiTip();

      // Auto-dedup on boot if duplicates exist
      if (hasDuplicateAccounts(state)) {
        try {
          const dedupResult = await engine.deduplicateAccounts();
          if (dedupResult.removedCount > 0) {
            state = dedupResult.state;
            set({
              toast: {
                text: `Cleaned up ${dedupResult.removedCount} duplicate account${dedupResult.removedCount === 1 ? "" : "s"}`,
                variant: "info",
              },
            });
          }
        } catch {
          // Dedup is best-effort — don't block boot
        }
      }

      const now = new Date().toISOString();
      set({
        state,
        status: "ready",
        lastSyncAt: now,
        lastPlaidRefreshAt: lastRefresh,
        lastAiTip: savedAiTip,
        syncState: syncTransition(get().syncState, { type: "sync-success", at: now }),
      });
    } catch (err: any) {
      // Try to load local-only state so the user isn't blocked
      try {
        const localState = await engine.getLocalState();
        if (localState) {
          set({
            state: localState,
            status: "ready",
            syncState: syncTransition(get().syncState, {
              type: "sync-error",
              error: "Sync failed — using local data.",
            }),
            toast: { text: "Sync failed — using local data", variant: "info" },
          });
          return;
        }
      } catch {
        // Local state also unavailable — fall through to error
      }
      const friendly = classifySyncError(err);
      set({
        status: "error",
        errorMessage: friendly.message,
        syncState: syncTransition(get().syncState, {
          type: "sync-error",
          error: friendly.message,
        }),
      });
    }
  },

  resetAll: async () => {
    try {
      await engine.reset();
      await clearSyncMeta();
      await clearPin();
      await clearAllPlaidTokens("user-los");
      await clearAllPlaidTokens("user-jackia");
      await clearPlaidRefreshAt("user-los");
      await clearPlaidRefreshAt("user-jackia");
      await clearAiTip();
      set({ state: null, status: "idle", guardState: "needs-setup", errorMessage: null, lastPlaidRefreshAt: null, syncState: initialSyncState() });
    } catch (err: any) {
      set({ status: "error", errorMessage: err?.message ?? "Failed to reset" });
    }
  },

  switchUser: async () => {
    try {
      const meta = await loadSyncMeta();
      if (!meta) return;
      const nextUserId = meta.userId === "user-los" ? "user-jackia" : "user-los";
      const displayName = nextUserId === "user-los" ? "Los" : "Jackia";
      await saveSyncMeta({ ...meta, userId: nextUserId });
      set({ toast: { text: `Switched to ${displayName}`, variant: "success" } });
    } catch (err: any) {
      set({ status: "error", errorMessage: err?.message ?? "Failed to switch user" });
    }
  },

  resetAndSeed: async () => {
    set({ status: "loading", errorMessage: null });
    try {
      await engine.reset();
      const state = await engine.seed();
      set({ state, status: "ready" });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to reset app state",
      });
    }
  },

  createEnvelope: async (name, type, groupId) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.createEnvelope({ name, type, groupId });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: { text: "Envelope created", variant: "success" },
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to create envelope",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to create envelope" }),
      });
    }
  },

  renameEnvelope: async (envelopeId: string, name: string) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.renameEnvelope({ envelopeId, name });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to rename envelope",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to rename envelope" }),
      });
    }
  },

  deleteEnvelope: async (envelopeId: string) => {
    const current = get().state;
    if (!current) return;

    // Find envelope name before deleting (for toast message)
    const envName = current.budget.envelopes.find((e) => e.id === envelopeId)?.name ?? "Envelope";

    // Save snapshot for undo
    _undoSnapshot = current;
    if (_undoTimer) clearTimeout(_undoTimer);

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.deleteEnvelope({ envelopeId });
      // Start undo timer — clears snapshot after window expires
      _undoTimer = setTimeout(() => {
        _undoSnapshot = null;
        _undoTimer = null;
      }, UNDO_WINDOW_MS);
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: {
          text: `Deleted ${envName}`,
          variant: "info",
          action: { label: "Undo", onPress: () => get().undoDelete() },
          durationMs: UNDO_WINDOW_MS,
        },
      });
    } catch (err: any) {
      _undoSnapshot = null;
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to delete envelope",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to delete envelope" }),
      });
    }
  },

  undoDelete: async () => {
    const snapshot = _undoSnapshot;
    if (!snapshot) return;

    // Clear undo state
    if (_undoTimer) clearTimeout(_undoTimer);
    _undoTimer = null;
    _undoSnapshot = null;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.importState(snapshot);
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: { text: "Envelope restored", variant: "success" },
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to restore envelope",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to restore envelope" }),
      });
    }
  },

  setTransactionNote: async (transactionId: string, note: string) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.setTransactionNote({ transactionId, note });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to save note",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to save note" }),
      });
    }
  },

  assignTransaction: async (args) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.assignTransaction(args);
      const envelopeName = result.state.budget.envelopes.find(
        (e) => e.id === args.envelopeId,
      )?.name;
      const tx = result.state.transactions.find((t) => t.id === args.transactionId);
      const toastParts: string[] = [];
      if (tx) {
        const sign = tx.amount.cents < 0 ? "-" : "";
        toastParts.push(`${sign}$${formatMoney(Math.abs(tx.amount.cents))}`);
        if (tx.description) toastParts.push(tx.description);
      }
      if (envelopeName) toastParts.push(`→ ${envelopeName}`);
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: {
          text: toastParts.length > 0 ? toastParts.join(" ") : "Transaction assigned",
          variant: "success",
        },
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to assign transaction",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to assign transaction" }),
      });
    }
  },

  unassignTransaction: async (transactionId: string) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.unassignTransaction({ transactionId });
      const tx = result.state.transactions.find((t) => t.id === transactionId);
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: {
          text: tx?.description
            ? `"${tx.description}" returned to Inbox`
            : "Transaction returned to Inbox",
          variant: "success",
        },
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to unassign transaction",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to unassign transaction" }),
      });
    }
  },

  editTransaction: async (args) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.editTransaction(args);
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: { text: "Transaction updated", variant: "success" },
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to edit transaction",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to edit transaction" }),
      });
    }
  },

  deleteTransaction: async (transactionId: string) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.deleteTransaction({ transactionId });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: { text: "Transaction deleted", variant: "info" },
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to delete transaction",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to delete transaction" }),
      });
    }
  },

  transferBetweenEnvelopes: async (args) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.transferBetweenEnvelopes(args);
      const fromName = result.state.budget.envelopes.find((e) => e.id === args.fromEnvelopeId)?.name ?? "envelope";
      const toName = result.state.budget.envelopes.find((e) => e.id === args.toEnvelopeId)?.name ?? "envelope";
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: { text: `Moved funds: ${fromName} → ${toName}`, variant: "success" },
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to transfer",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to transfer" }),
      });
    }
  },

  setEnvelopeGoal: async (envelopeId: string, goalCents: number) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.setEnvelopeGoal({ envelopeId, goalCents });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: { text: "Monthly goal set", variant: "success" },
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to set goal",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to set goal" }),
      });
    }
  },

  clearEnvelopeGoal: async (envelopeId: string) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.clearEnvelopeGoal({ envelopeId });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: { text: "Goal cleared", variant: "info" },
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to clear goal",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to clear goal" }),
      });
    }
  },

  setEnvelopeTarget: async (envelopeId: string, targetCents: number) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.setEnvelopeTarget({ envelopeId, targetCents });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: { text: "Debt target set", variant: "success" },
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to set target",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to set target" }),
      });
    }
  },

  clearEnvelopeTarget: async (envelopeId: string) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.clearEnvelopeTarget({ envelopeId });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: { text: "Target cleared", variant: "info" },
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to clear target",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to clear target" }),
      });
    }
  },

  setEnvelopeType: async (envelopeId, envelopeType) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.setEnvelopeType({ envelopeId, envelopeType });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to set envelope type",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to set envelope type" }),
      });
    }
  },

  addAssignmentRule: async (args) => {
    const current = get().state;
    if (!current) return;
    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.addAssignmentRule(args);
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
      });
    } catch (err: any) {
      set({ status: "error", errorMessage: err?.message ?? "Failed to add rule", syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to add rule" }) });
    }
  },

  removeAssignmentRule: async (ruleId) => {
    const current = get().state;
    if (!current) return;
    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.removeAssignmentRule({ ruleId });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
      });
    } catch (err: any) {
      set({ status: "error", errorMessage: err?.message ?? "Failed to remove rule", syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to remove rule" }) });
    }
  },

  reorderAssignmentRules: async (ruleIds) => {
    const current = get().state;
    if (!current) return;
    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.reorderAssignmentRules({ ruleIds });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
      });
    } catch (err: any) {
      set({ status: "error", errorMessage: err?.message ?? "Failed to reorder rules", syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to reorder rules" }) });
    }
  },

  createEnvelopeGroup: async (name) => {
    const current = get().state;
    if (!current) return;
    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.createEnvelopeGroup({ name });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: { text: "Group created", variant: "success" },
      });
    } catch (err: any) {
      set({ status: "error", errorMessage: err?.message ?? "Failed to create group", syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to create group" }) });
    }
  },

  renameEnvelopeGroup: async (groupId, name) => {
    const current = get().state;
    if (!current) return;
    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.renameEnvelopeGroup({ groupId, name });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
      });
    } catch (err: any) {
      set({ status: "error", errorMessage: err?.message ?? "Failed to rename group", syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to rename group" }) });
    }
  },

  deleteEnvelopeGroup: async (groupId) => {
    const current = get().state;
    if (!current) return;
    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.deleteEnvelopeGroup({ groupId });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: { text: "Group deleted", variant: "info" },
      });
    } catch (err: any) {
      set({ status: "error", errorMessage: err?.message ?? "Failed to delete group", syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to delete group" }) });
    }
  },

  reorderEnvelopeGroups: async (orderedIds) => {
    const current = get().state;
    if (!current) return;
    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.reorderEnvelopeGroups({ orderedIds });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
      });
    } catch (err: any) {
      set({ status: "error", errorMessage: err?.message ?? "Failed to reorder groups", syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to reorder groups" }) });
    }
  },

  moveEnvelopeToGroup: async (envelopeId, groupId) => {
    const current = get().state;
    if (!current) return;
    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.moveEnvelopeToGroup({ envelopeId, groupId });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
      });
    } catch (err: any) {
      set({ status: "error", errorMessage: err?.message ?? "Failed to move envelope", syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to move envelope" }) });
    }
  },

  confirmAllSuggestions: async (assignments) => {
    const current = get().state;
    if (!current || assignments.length === 0) return;

    const meta = await loadSyncMeta();
    const userId = meta?.userId ?? "user-los";

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.confirmAllSuggestions({
        assignments: assignments.map((a) => ({
          ...a,
          assignedByUserId: userId,
        })),
      });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: {
          text: `${assignments.length} transaction${assignments.length === 1 ? "" : "s"} assigned`,
          variant: "success",
        },
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to confirm suggestions",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to confirm suggestions" }),
      });
    }
  },

  allocateToEnvelope: async (args) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.allocateToEnvelope(args);
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: { text: "Funds allocated", variant: "success" },
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to allocate",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to allocate" }),
      });
    }
  },

  fillEnvelopes: async (items) => {
    const current = get().state;
    if (!current) return;

    const nonZero = items.filter((i) => i.amountCents > 0);
    if (nonZero.length === 0) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    let filled = 0;
    try {
      for (const item of nonZero) {
        const result = await engine.allocateToEnvelope(item);
        set({
          state: result.state,
          syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        });
        filled++;
      }
      set({
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        toast: { text: `${filled} envelope${filled === 1 ? "" : "s"} filled`, variant: "success" },
      });
    } catch (err: any) {
      // Partial fill — re-fetch state from engine to reflect committed allocations
      try {
        const latest = await engine.getState();
        set({ state: latest });
      } catch { /* state already partially updated */ }
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to fill envelopes",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to fill envelopes" }),
        toast: { text: `Filled ${filled} of ${nonZero.length} — error on remaining`, variant: "error" },
      });
    }
  },

  addManualTransaction: async (args) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.addManualTransaction(args);
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: { text: "Transaction saved", variant: "success" },
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to add transaction",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to add transaction" }),
      });
    }
  },

  seedBudgetFromBalances: async (args) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.seedBudgetFromBalances(args);
      set({
        state: { ...result.state, budgetSeeded: true },
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: { text: "Budget seeded from account balances", variant: "success" },
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to seed budget",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to seed budget" }),
      });
    }
  },

  markBudgetSeeded: async () => {
    const current = get().state;
    if (!current) return;
    const next = { ...current, budgetSeeded: true };
    set({ state: next });
    // Persist via engine recompute so it hits storage + sync
    try {
      const result = await engine.recompute(next);
      set({
        state: result.state,
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
      });
    } catch {
      // State already set locally — sync will catch up
    }
  },

  deduplicateAccounts: async () => {
    try {
      const result = await engine.deduplicateAccounts();
      if (result.removedCount > 0) {
        set({
          state: result.state,
          toast: {
            text: `Cleaned up ${result.removedCount} duplicate account${result.removedCount === 1 ? "" : "s"}`,
            variant: "success",
          },
        });
      } else {
        set({ toast: { text: "No duplicates found", variant: "info" } });
      }
    } catch (err: any) {
      set({ toast: { text: err?.message ?? "Failed to clean up duplicates", variant: "error" } });
    }
  },

  dismissFirstRun: async () => {
    try {
      const result = await engine.dismissFirstRun();
      set({
        state: result.state,
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
      });
    } catch {
      // Best-effort — state already set locally
    }
  },

  importState: async (imported: AppStateV1) => {
    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.importState(imported);
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: { text: "Data imported successfully", variant: "success" },
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to import data",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to import data" }),
      });
    }
  },

  syncNow: async () => {
    set({ syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    const result = await engine.syncNow();
    if (result.pulledRemote && result.state) {
      set({ state: result.state, toast: { text: "Updated from another device", variant: "info" } });
    }
    // onSyncResult callback handles the final syncState transition
  },

  refreshFromPlaid: async (opts) => {
    if (!Features.PLAID) return { imported: 0 };
    // Cooldown check: skip Plaid API call if refreshed recently
    const meta = await loadSyncMeta();
    const currentUserId = meta?.userId ?? "user-los";

    if (!opts?.force) {
      const lastRefresh = await loadPlaidRefreshAt(currentUserId);
      if (lastRefresh) {
        const elapsed = Date.now() - new Date(lastRefresh).getTime();
        if (elapsed < REFRESH_COOLDOWN_MS) {
          set({ lastPlaidRefreshAt: lastRefresh });
          return { imported: 0 };
        }
      }
    }

    const isSilent = opts?.force || opts?.silent;
    // Only show full-screen loading overlay on boot sync, not pull-to-refresh or foreground sync
    if (!isSilent) {
      set({ status: "loading", errorMessage: null, plaidSyncError: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    } else {
      set({ errorMessage: null, plaidSyncError: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    }
    try {
      const USER_IDS = ["user-los", "user-jackia"];
      const allNewTransactions: import("@money-shepherd/domain").Transaction[] = [];
      const allRemovedIds: string[] = [];
      let hasTokens = false;

      for (const userId of USER_IDS) {
        const tokens = await loadPlaidTokens(userId);
        if (tokens.length > 0) hasTokens = true;
        for (const token of tokens) {
          // Build account mapping from plaidAccountId -> internalAccountId
          const accountMap: Record<string, string> = {};
          if (token.accountIdMap) {
            Object.assign(accountMap, token.accountIdMap);
          }

          // Paginated sync with cursor
          let cursor = token.syncCursor;
          let hasMore = true;
          let pageCount = 0;
          const isInitialSync = !token.syncCursor;

          while (hasMore) {
            const syncResult = await withTimeout(
              syncTransactions(token.accessToken, cursor),
              PLAID_SYNC_TIMEOUT_MS,
              "Plaid sync",
            );
            pageCount++;

            // Import transactions: all pages on incremental sync,
            // first page only on initial sync (matches pre-pagination behavior)
            if (!isInitialSync || pageCount === 1) {
              const mapped = mapPlaidTransactions(
                [...syncResult.added, ...syncResult.modified],
                accountMap,
              );
              allNewTransactions.push(...mapped);

              // Collect removed transaction IDs (map to internal ID format)
              for (const plaidTxId of syncResult.removed) {
                allRemovedIds.push(`plaid-tx-${plaidTxId}`);
              }
            }

            cursor = syncResult.nextCursor;
            hasMore = syncResult.hasMore;
          }

          // Persist cursor for next incremental sync
          if (cursor) {
            await updateTokenCursor(userId, token.itemId, cursor);
          }
        }
      }

      if (!hasTokens) {
        set({
          status: "ready",
          plaidSyncError: makePlaidError("not-connected"),
          syncState: syncTransition(get().syncState, { type: "sync-success", at: new Date().toISOString() }),
        });
        return { imported: 0 };
      }

      let state = get().state;
      if (!state) {
        set({
          status: "ready",
          syncState: syncTransition(get().syncState, { type: "sync-success", at: new Date().toISOString() }),
        });
        return { imported: 0 };
      }

      const before = state.transactions.length;
      let result = await engine.importPlaidTransactions({ transactions: allNewTransactions });
      const imported = result.state.transactions.length - before;

      // Remove transactions that Plaid reports as deleted/replaced
      if (allRemovedIds.length > 0) {
        result = await engine.removePlaidTransactions({ transactionIds: allRemovedIds });
      }

      // Refresh Plaid account balances from the API ("Plaid balance is truth").
      // This updates balances for all connected Plaid accounts with fresh data.
      for (const userId of USER_IDS) {
        const tokens = await loadPlaidTokens(userId);
        for (const token of tokens) {
          try {
            const plaidAccounts = await fetchAccounts(token.accessToken);
            const { accounts: refreshed } = mapPlaidAccounts(
              plaidAccounts,
              userId,
              result.state.accounts,
              undefined,
              token.institutionName,
            );
            result = await engine.updatePlaidBalances({ updatedAccounts: refreshed });
          } catch {
            // Balance refresh is best-effort — transaction sync already succeeded
          }
        }
      }

      const now = new Date().toISOString();
      await savePlaidRefreshAt(currentUserId, now);

      // Determine if we should prompt the seed-budget screen:
      // 1. First seed: imported transactions AND budget not yet seeded
      // 2. Re-seed: budget already seeded but new depository accounts exist that haven't been seeded
      let shouldSeedBudget = false;
      if (!result.state.budgetSeeded) {
        shouldSeedBudget = imported > 0;
      } else if (result.state.seededAccountIds) {
        const seeded = new Set(result.state.seededAccountIds);
        const hasUnseeded = result.state.accounts
          .filter((a) => !a.accountType || a.accountType === "depository")
          .some((a) => !seeded.has(a.id));
        shouldSeedBudget = hasUnseeded;
      }

      set({
        state: result.state,
        status: "ready",
        lastSyncAt: now,
        lastPlaidRefreshAt: now,
        syncState: result.syncOutcome === "error"
          ? applyOutcome(get().syncState, result.syncOutcome, result.syncError)
          : syncTransition(get().syncState, { type: "sync-success", at: now }),
      });
      return { imported, shouldSeedBudget };
    } catch (err: unknown) {
      const info = classifyPlaidError(err);
      set({
        // Don't show full-screen error overlay on pull-to-refresh or foreground sync
        ...(isSilent ? {} : { status: "error" as const }),
        errorMessage: info.message,
        plaidSyncError: info,
        syncState: syncTransition(get().syncState, { type: "sync-error", error: info.message }),
      });
      return { imported: 0 };
    }
  },

  analyzeSpending: async () => {
    const { state } = get();
    if (!state) throw new Error("No state available");

    const { buildAiContext } = await import("@money-shepherd/domain");
    const { callAnalyzeSpending } = await import("../infra/firebase/aiClient");

    const context = buildAiContext(state);
    const result = await callAnalyzeSpending(state.householdId, context);

    if (result.warning === "budget_warning") {
      set({ toast: { text: "AI budget at 75% — approaching monthly limit", variant: "info" } });
    }

    return result;
  },

  suggestAllocations: async () => {
    const { state } = get();
    if (!state) throw new Error("No state available");

    const { callSuggestAllocations } = await import("../infra/firebase/aiClient");

    const envelopes = state.budget.envelopes.map((e) => ({
      id: e.id,
      name: e.name,
      balanceCents: e.balance.cents,
      goalCents: e.goal?.cents,
      type: e.type,
    }));

    const result = await callSuggestAllocations(state.householdId, {
      availableCents: state.budget.availableToAssign.cents,
      envelopes,
    });

    if (result.warning === "budget_warning") {
      set({ toast: { text: "AI budget at 75% — approaching monthly limit", variant: "info" } });
    }

    return result;
  },

  categorizeInbox: async () => {
    const { state } = get();
    if (!state) return { mapped: 0 };

    const { normalizePayee } = await import("@money-shepherd/domain");
    const { callCategorizeTransactions } = await import("../infra/firebase/aiClient");

    const txById = Object.fromEntries(state.transactions.map((tx) => [tx.id, tx]));
    const existingAiMappings = state.aiPayeeMappings ?? {};
    const payeeMappings = state.payeeMappings ?? {};

    // Collect unique normalized merchants from unassigned inbox items
    // that don't already have an AI or payee mapping
    const merchants = Array.from(
      new Set(
        state.inbox.unassignedTransactionIds
          .map((id) => txById[id])
          .filter((tx) => tx !== undefined && tx.amount.cents < 0)
          .map((tx) => normalizePayee(tx!.description))
          .filter(
            (n) =>
              n.length > 0 &&
              !Object.hasOwn(existingAiMappings, n) &&
              !Object.hasOwn(payeeMappings, n),
          ),
      ),
    );

    if (merchants.length === 0) return { mapped: 0 };

    const envelopes = state.budget.envelopes.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
    }));

    const result = await callCategorizeTransactions(state.householdId, {
      merchants,
      envelopes,
    });

    if (result.categorizations.length === 0) return { mapped: 0 };

    // Build normalizedMerchant → envelopeId from high/medium confidence results
    const newMappings: Record<string, string> = {};
    for (const c of result.categorizations) {
      const normalized = normalizePayee(c.merchant);
      if (normalized) newMappings[normalized] = c.envelopeId;
    }

    await engine.mergeAiPayeeMappings(newMappings);

    const { state: updated } = get();
    useAppStore.setState({ state: updated });

    return { mapped: Object.keys(newMappings).length };
  },

  fetchMonthlyReview: async () => {
    const { state } = get();
    if (!state) throw new Error("No state available");

    const { buildAiContext } = await import("@money-shepherd/domain");
    const { callMonthlyReview } = await import("../infra/firebase/aiClient");

    // Build current month context
    const currentMonth = buildAiContext(state);

    // Build previous month context using period override
    const now = new Date();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // 1-based
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
    const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
    const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(prevLastDay).padStart(2, "0")}`;

    const previousMonth = buildAiContext(state, { startDate: prevStart, endDate: prevEnd });

    const result = await callMonthlyReview(state.householdId, currentMonth, previousMonth);

    // Cache AI summary as a dashboard insight tip (persisted across restarts)
    if (result.summary) {
      set({ lastAiTip: result.summary });
      saveAiTip(result.summary).catch(() => {}); // fire-and-forget
    }

    if (result.warning === "budget_warning") {
      set({ toast: { text: "AI budget at 75% — approaching monthly limit", variant: "info" } });
    }

    return result;
  },

  sendChatMessage: async (messages) => {
    const { state } = get();
    if (!state) throw new Error("No state available");

    const { buildAiContext } = await import("@money-shepherd/domain");
    const { callChatMessage } = await import("../infra/firebase/aiClient");

    const context = buildAiContext(state);
    const result = await callChatMessage(state.householdId, messages, context);

    if (result.warning === "budget_warning") {
      set({ toast: { text: "AI budget at 75% — approaching monthly limit", variant: "info" } });
    }

    return result;
  },

  executeChatAction: async (actionOrActions) => {
    const { state } = get();
    if (!state) throw new Error("No state available");

    const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions];
    const store = get();

    for (const action of actions) {
      await executeSingleAction(store, action);
    }
  },
}));
