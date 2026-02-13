import { create } from "zustand";
import { createEngine } from "../domain/engine";
import type { AppStateV1 } from "../domain/appState";

type LoadState = "idle" | "loading" | "ready" | "error";

type AppStore = {
  // state
  status: LoadState;
  errorMessage: string | null;
  state: AppStateV1 | null;

  // actions
  bootstrap: () => Promise<void>;
  resetAndSeed: () => Promise<void>;
  addIncomeToLos: () => Promise<void>;
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

  bootstrap: async () => {
    set({ status: "loading", errorMessage: null });
    try {
      const state = await engine.getState();
      set({ state, status: "ready" });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to load app state",
      });
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

  addIncomeToLos: async () => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null });
    try {
      const state = await engine.addManualTransaction({
        accountId: "acc-los",
        amountCents: 2000,
        description: "Manual income",
      });
      set({ state, status: "ready" });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to add transaction",
      });
    }
  },
}));
