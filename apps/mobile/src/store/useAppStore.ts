import { create } from "zustand";
import { createEngine } from "../domain/engine";
import type { AppStateV1 } from "../domain/appState";
import { clearSyncMeta, loadSyncMeta, saveSyncMeta } from "../infra/local/syncMeta";
import { clearPin } from "../infra/local/pin";
import { loadPlaidTokens, clearAllPlaidTokens } from "../infra/local/secureTokens";
import { savePlaidRefreshAt, loadPlaidRefreshAt, clearPlaidRefreshAt } from "../infra/local/plaidMeta";
import { syncTransactions } from "../infra/plaid/plaidClient";
import { mapPlaidTransactions } from "../infra/plaid/mapTransaction";
import { classifyPlaidError, makePlaidError, type PlaidErrorInfo } from "../infra/plaid/errors";

const REFRESH_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

type LoadState = "idle" | "loading" | "ready" | "error";
type GuardState = "checking" | "needs-setup" | "needs-pin-setup" | "needs-pin" | "ready";

type AppStore = {
  // state
  status: LoadState;
  errorMessage: string | null;
  state: AppStateV1 | null;
  guardState: GuardState;
  lastSyncAt: string | null;
  lastPlaidRefreshAt: string | null;
  plaidSyncError: PlaidErrorInfo | null;

  // actions
  bootstrap: () => Promise<void>;
  setGuardReady: () => void;
  clearPlaidSyncError: () => void;
  resetAll: () => Promise<void>;
  switchUser: () => Promise<void>;
  resetAndSeed: () => Promise<void>;
  createEnvelope: (name: string) => Promise<void>;
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
  refreshFromPlaid: (opts?: { force?: boolean }) => Promise<{ imported: number }>;
};

const engine = createEngine();

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
  lastSyncAt: null,
  lastPlaidRefreshAt: null,
  plaidSyncError: null,

  setGuardReady: () => set({ guardState: "ready" }),
  clearPlaidSyncError: () => set({ plaidSyncError: null }),

  bootstrap: async () => {
    set({ status: "loading", errorMessage: null });
    try {
      const state = await engine.getState();
      const syncMeta = await loadSyncMeta();
      const lastRefresh = syncMeta
        ? await loadPlaidRefreshAt(syncMeta.userId)
        : null;
      set({
        state,
        status: "ready",
        lastSyncAt: new Date().toISOString(),
        lastPlaidRefreshAt: lastRefresh,
      });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to load app state",
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
      set({ state: null, status: "idle", guardState: "needs-setup", errorMessage: null, lastPlaidRefreshAt: null });
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

    set({ status: "loading", errorMessage: null });
    try {
      const state = await engine.createEnvelope({ name });
      set({ state, status: "ready", lastSyncAt: new Date().toISOString() });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to create envelope",
      });
    }
  },

  assignTransaction: async (args) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null });
    try {
      const state = await engine.assignTransaction(args);
      set({ state, status: "ready", lastSyncAt: new Date().toISOString() });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to assign transaction",
      });
    }
  },

  allocateToEnvelope: async (args) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null });
    try {
      const state = await engine.allocateToEnvelope(args);
      set({ state, status: "ready", lastSyncAt: new Date().toISOString() });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to allocate",
      });
    }
  },

  addManualTransaction: async (args) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null });
    try {
      const state = await engine.addManualTransaction(args);
      set({ state, status: "ready", lastSyncAt: new Date().toISOString() });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to add transaction",
      });
    }
  },

  refreshFromPlaid: async (opts) => {
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

    set({ status: "loading", errorMessage: null, plaidSyncError: null });
    try {
      const USER_IDS = ["user-los", "user-jackia"];
      const allNewTransactions: import("@money-shepherd/domain").Transaction[] = [];
      let hasTokens = false;

      for (const userId of USER_IDS) {
        const tokens = await loadPlaidTokens(userId);
        if (tokens.length > 0) hasTokens = true;
        for (const token of tokens) {
          const syncResult = await syncTransactions(token.accessToken);
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
        set({ status: "ready", plaidSyncError: makePlaidError("not-connected") });
        return { imported: 0 };
      }

      let state = get().state;
      if (!state) {
        set({ status: "ready" });
        return { imported: 0 };
      }

      const before = state.transactions.length;
      state = await engine.importPlaidTransactions({ transactions: allNewTransactions });
      const imported = state.transactions.length - before;

      const now = new Date().toISOString();
      await savePlaidRefreshAt(currentUserId, now);
      set({ state, status: "ready", lastSyncAt: now, lastPlaidRefreshAt: now });
      return { imported };
    } catch (err: unknown) {
      const info = classifyPlaidError(err);
      set({ status: "error", errorMessage: info.message, plaidSyncError: info });
      return { imported: 0 };
    }
  },
}));
