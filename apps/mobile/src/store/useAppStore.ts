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

  createEnvelope: async (name: string) => {
    const current = get().state;
    if (!current) return;

    set({ status: "loading", errorMessage: null });
    try {
      const state = await engine.createEnvelope({ name });
      set({ state, status: "ready" });
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
      set({ state, status: "ready" });
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
      set({ state, status: "ready" });
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
      set({ state, status: "ready" });
    } catch (err: any) {
      set({
        status: "error",
        errorMessage: err?.message ?? "Failed to add transaction",
      });
    }
  },
}));
