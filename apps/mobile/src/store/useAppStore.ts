import { create } from "zustand";
import { createEngine } from "../domain/engine";
import type { AppStateV1 } from "../domain/appState";
import { clearSyncMeta, loadSyncMeta, saveSyncMeta } from "../infra/local/syncMeta";
import { clearPin } from "../infra/local/pin";
import { loadPlaidTokens } from "../infra/local/secureTokens";
import { syncTransactions } from "../infra/plaid/plaidClient";
import { mapPlaidTransactions } from "../infra/plaid/mapTransaction";

type LoadState = "idle" | "loading" | "ready" | "error";
type GuardState = "checking" | "needs-setup" | "needs-pin-setup" | "needs-pin" | "ready";

type AppStore = {
  // state
  status: LoadState;
  errorMessage: string | null;
  state: AppStateV1 | null;
  guardState: GuardState;
  lastSyncAt: string | null;

  // actions
  bootstrap: () => Promise<void>;
  setGuardReady: () => void;
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
  refreshFromPlaid: () => Promise<{ imported: number }>;
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

  setGuardReady: () => set({ guardState: "ready" }),

  bootstrap: async () => {
    set({ status: "loading", errorMessage: null });
    try {
      const state = await engine.getState();
      set({ state, status: "ready", lastSyncAt: new Date().toISOString() });
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
      set({ state: null, status: "idle", guardState: "needs-setup", errorMessage: null });
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

  refreshFromPlaid: async () => {
    set({ status: "loading", errorMessage: null });
    try {
      const USER_IDS = ["user-los", "user-jackia"];
      const allNewTransactions: import("@money-shepherd/domain").Transaction[] = [];

      for (const userId of USER_IDS) {
        const tokens = await loadPlaidTokens(userId);
        for (const token of tokens) {
          const syncResult = await syncTransactions(token.accessToken);
          // Build account mapping from plaidAccountId -> internalAccountId
          const accountMap: Record<string, string> = {};
          accountMap[token.itemId] = `plaid-${token.itemId}`;

          const mapped = mapPlaidTransactions(
            [...syncResult.added, ...syncResult.modified],
            accountMap
          );
          allNewTransactions.push(...mapped);
        }
      }

      let state = get().state;
      if (!state) {
        set({ status: "ready" });
        return { imported: 0 };
      }

      const before = state.transactions.length;
      state = await engine.importPlaidTransactions({ transactions: allNewTransactions });
      const imported = state.transactions.length - before;

      set({ state, status: "ready", lastSyncAt: new Date().toISOString() });
      return { imported };
    } catch (err: any) {
      set({ status: "error", errorMessage: err?.message ?? "Failed to refresh" });
      return { imported: 0 };
    }
  },
}));
