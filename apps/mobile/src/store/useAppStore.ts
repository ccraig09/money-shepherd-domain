import { create } from "zustand";
import { createEngine } from "../domain/engine";
import type { AppStateV1 } from "../domain/appState";
import { initialSyncState, syncTransition, type SyncState } from "../domain/syncStatus";
import { classifySyncError } from "../infra/remote/syncErrors";
import { clearSyncMeta, loadSyncMeta, saveSyncMeta } from "../infra/local/syncMeta";
import { clearPin } from "../infra/local/pin";
import { loadPlaidTokens, clearAllPlaidTokens } from "../infra/local/secureTokens";
import { savePlaidRefreshAt, loadPlaidRefreshAt, clearPlaidRefreshAt } from "../infra/local/plaidMeta";
import { syncTransactions } from "../infra/plaid/plaidClient";
import { mapPlaidTransactions } from "../infra/plaid/mapTransaction";
import { classifyPlaidError, makePlaidError, type PlaidErrorInfo } from "../infra/plaid/errors";
import { withTimeout } from "../lib/timeout";
import { Features } from "../config/features";

const REFRESH_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
const PLAID_SYNC_TIMEOUT_MS = 15_000;

type LoadState = "idle" | "loading" | "ready" | "error";
type GuardState = "checking" | "needs-setup" | "needs-pin-setup" | "needs-pin" | "ready";

type ToastMessage = { text: string; variant: "success" | "error" | "info" };

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

  // actions
  showToast: (text: string, variant?: ToastMessage["variant"]) => void;
  bootstrap: () => Promise<void>;
  setGuardReady: () => void;
  clearPlaidSyncError: () => void;
  resetAll: () => Promise<void>;
  switchUser: () => Promise<void>;
  resetAndSeed: () => Promise<void>;
  createEnvelope: (name: string) => Promise<void>;
  renameEnvelope: (envelopeId: string, name: string) => Promise<void>;
  deleteEnvelope: (envelopeId: string) => Promise<void>;
  setTransactionNote: (transactionId: string, note: string) => Promise<void>;
  assignTransaction: (args: {
    transactionId: string;
    envelopeId: string;
    assignedByUserId: string;
  }) => Promise<void>;
  allocateToEnvelope: (args: {
    envelopeId: string;
    amountCents: number;
  }) => Promise<void>;
  addManualTransaction: (args: {
    accountId: string;
    amountCents: number;
    description: string;
    postedAt?: string;
  }) => Promise<void>;
  seedBudgetFromBalances: (args: { totalCents: number }) => Promise<void>;
  markBudgetSeeded: () => Promise<void>;
  refreshFromPlaid: (opts?: { force?: boolean }) => Promise<{ imported: number; shouldSeedBudget?: boolean }>;
  syncNow: () => Promise<void>;
};

const engine = createEngine();

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
      const state = await engine.getState();
      const syncMeta = await loadSyncMeta();
      const lastRefresh = syncMeta
        ? await loadPlaidRefreshAt(syncMeta.userId)
        : null;
      const now = new Date().toISOString();
      set({
        state,
        status: "ready",
        lastSyncAt: now,
        lastPlaidRefreshAt: lastRefresh,
        syncState: syncTransition(get().syncState, { type: "sync-success", at: now }),
      });
    } catch (err: any) {
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
      await saveSyncMeta({ ...meta, userId: nextUserId });
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

  createEnvelope: async (name: string) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.createEnvelope({ name });
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

    set({ status: "loading", errorMessage: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const result = await engine.deleteEnvelope({ envelopeId });
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: { text: "Envelope deleted", variant: "info" },
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to delete envelope",
        syncState: syncTransition(get().syncState, { type: "sync-error", error: err?.message ?? "Failed to delete envelope" }),
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
      set({
        state: result.state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        syncState: applyOutcome(get().syncState, result.syncOutcome, result.syncError),
        toast: {
          text: envelopeName ? `Assigned to ${envelopeName}` : "Transaction assigned",
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

    set({ status: "loading", errorMessage: null, plaidSyncError: null, syncState: syncTransition(get().syncState, { type: "sync-start" }) });
    try {
      const USER_IDS = ["user-los", "user-jackia"];
      const allNewTransactions: import("@money-shepherd/domain").Transaction[] = [];
      let hasTokens = false;

      for (const userId of USER_IDS) {
        const tokens = await loadPlaidTokens(userId);
        if (tokens.length > 0) hasTokens = true;
        for (const token of tokens) {
          const syncResult = await withTimeout(
            syncTransactions(token.accessToken),
            PLAID_SYNC_TIMEOUT_MS,
            "Plaid sync",
          );
          // Build account mapping from plaidAccountId -> internalAccountId
          const accountMap: Record<string, string> = {};
          if (token.accountIdMap) {
            Object.assign(accountMap, token.accountIdMap);
          }

          const mapped = mapPlaidTransactions(
            [...syncResult.added, ...syncResult.modified],
            accountMap
          );
          allNewTransactions.push(...mapped);
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
      const result = await engine.importPlaidTransactions({ transactions: allNewTransactions });
      const imported = result.state.transactions.length - before;

      const now = new Date().toISOString();
      await savePlaidRefreshAt(currentUserId, now);

      // Determine if we should prompt the seed-budget screen:
      // first sync that actually imported transactions AND budget not yet seeded.
      const shouldSeedBudget = imported > 0 && !result.state.budgetSeeded;

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
        status: "error",
        errorMessage: info.message,
        plaidSyncError: info,
        syncState: syncTransition(get().syncState, { type: "sync-error", error: info.message }),
      });
      return { imported: 0 };
    }
  },
}));
