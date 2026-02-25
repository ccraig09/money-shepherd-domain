import { Money } from "@money-shepherd/domain";
import { loadAppState, saveAppState, clearAppState } from "../storage";

// ── Mock AsyncStorage ────────────────────────────────────────────
const store: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
    multiRemove: jest.fn((keys: string[]) => {
      keys.forEach((k) => delete store[k]);
      return Promise.resolve();
    }),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────
const KEY = "moneyShepherd.appState.v1";
const KEY_TMP = "moneyShepherd.appState.v1.tmp";
const KEY_BACKUP = "moneyShepherd.appState.v1.backup";

function makeMinimalState(availableCents = 0) {
  return {
    version: 1,
    householdId: "hh-1",
    users: [],
    budget: {
      id: "budget-1",
      availableToAssign: { cents: availableCents },
      envelopes: [],
    },
    accounts: [],
    transactions: [],
    inbox: { unassignedTransactionIds: [], assignmentsByTransactionId: {} },
    appliedAccountTransactionIds: [],
    appliedBudgetTransactionIds: [],
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

function clearStore() {
  Object.keys(store).forEach((k) => delete store[k]);
}

// ── Tests ────────────────────────────────────────────────────────
describe("storage", () => {
  beforeEach(clearStore);

  describe("loadAppState", () => {
    it("returns null when no data exists", async () => {
      expect(await loadAppState()).toBeNull();
    });

    it("loads and hydrates Money objects from the main key", async () => {
      store[KEY] = JSON.stringify(makeMinimalState(50000));
      const state = await loadAppState();
      expect(state).not.toBeNull();
      expect(state!.budget.availableToAssign).toBeInstanceOf(Money);
      expect(state!.budget.availableToAssign.cents).toBe(50000);
    });

    it("falls back to tmp key when main is corrupt", async () => {
      store[KEY] = "not valid json";
      store[KEY_TMP] = JSON.stringify(makeMinimalState(30000));
      const state = await loadAppState();
      expect(state).not.toBeNull();
      expect(state!.budget.availableToAssign.cents).toBe(30000);
    });

    it("falls back to backup key when main and tmp are both corrupt", async () => {
      store[KEY] = "corrupt";
      store[KEY_TMP] = "also corrupt";
      store[KEY_BACKUP] = JSON.stringify(makeMinimalState(10000));
      const state = await loadAppState();
      expect(state).not.toBeNull();
      expect(state!.budget.availableToAssign.cents).toBe(10000);
    });

    it("returns null when all keys are corrupt", async () => {
      store[KEY] = "bad";
      store[KEY_TMP] = "bad";
      store[KEY_BACKUP] = "bad";
      expect(await loadAppState()).toBeNull();
    });
  });

  describe("saveAppState", () => {
    it("writes to main key and cleans up tmp", async () => {
      const state = makeMinimalState(25000) as any;
      await saveAppState(state);
      expect(store[KEY]).toBeDefined();
      expect(store[KEY_TMP]).toBeUndefined();
      const parsed = JSON.parse(store[KEY]);
      expect(parsed.budget.availableToAssign.cents).toBe(25000);
    });

    it("preserves previous main as backup", async () => {
      // First save
      store[KEY] = JSON.stringify(makeMinimalState(10000));
      // Second save with different data
      const state = makeMinimalState(99000) as any;
      await saveAppState(state);
      // Backup should hold the old main data
      expect(store[KEY_BACKUP]).toBeDefined();
      const backup = JSON.parse(store[KEY_BACKUP]);
      expect(backup.budget.availableToAssign.cents).toBe(10000);
    });
  });

  describe("clearAppState", () => {
    it("removes all three keys", async () => {
      store[KEY] = "data";
      store[KEY_TMP] = "data";
      store[KEY_BACKUP] = "data";
      await clearAppState();
      expect(store[KEY]).toBeUndefined();
      expect(store[KEY_TMP]).toBeUndefined();
      expect(store[KEY_BACKUP]).toBeUndefined();
    });
  });
});
