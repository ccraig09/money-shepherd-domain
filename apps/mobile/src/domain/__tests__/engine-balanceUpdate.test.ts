import { Money } from "@money-shepherd/domain";
import type { Account } from "@money-shepherd/domain";
import type { AppStateV1 } from "../appState";

// ─── Mocks ──────────────────────────────────────────────────

jest.mock("../../infra/local/syncMeta");
jest.mock("../storage");
jest.mock("../../infra/firebase/firebaseClient");
jest.mock("../../infra/remote/householdStateRepo");
jest.mock("../../lib/timeout", () => ({
  withTimeout: <T>(p: Promise<T>) => p,
}));
jest.mock("../../lib/retry", () => ({
  withRetry: (fn: () => Promise<any>) => fn(),
}));
jest.mock("../../lib/debounce", () => ({
  debouncedAsync: (fn: (...args: any[]) => Promise<void>) => fn,
}));
jest.mock("../../lib/id", () => ({
  nowIso: () => "2024-01-01T00:00:00.000Z",
  makeId: (prefix: string) => `${prefix}-mock`,
}));
jest.mock("../../config/features", () => ({
  Features: { REMOTE_SYNC: false, PLAID: true },
}));

const { loadSyncMeta, saveSyncMeta } = jest.requireMock("../../infra/local/syncMeta") as {
  loadSyncMeta: jest.Mock;
  saveSyncMeta: jest.Mock;
};
const { loadAppState, saveAppState } = jest.requireMock("../storage") as {
  loadAppState: jest.Mock;
  saveAppState: jest.Mock;
};

// ─── Helpers ────────────────────────────────────────────────

function makeState(overrides?: Partial<AppStateV1>): AppStateV1 {
  return {
    version: 1,
    householdId: "hh-1",
    users: [],
    budget: {
      id: "budget-1",
      availableToAssign: Money.zero(),
      envelopes: [],
    },
    accounts: [],
    transactions: [],
    inbox: { unassignedTransactionIds: [], assignmentsByTransactionId: {} },
    appliedAccountTransactionIds: [],
    appliedBudgetTransactionIds: [],
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const LOS_ACCOUNT: Account = {
  id: "plaid-los-checking",
  name: "Los Checking",
  balance: Money.fromCents(50000),
  accountType: "depository",
  ownerUserId: "user-los",
  institutionName: "Navy Federal",
};

const JACKIA_ACCOUNT: Account = {
  id: "plaid-jackia-checking",
  name: "Jackia Checking",
  balance: Money.fromCents(65000),
  accountType: "depository",
  ownerUserId: "user-jackia",
  institutionName: "Navy Federal",
};

// ─── Tests ──────────────────────────────────────────────────

describe("engine.updatePlaidBalances", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadSyncMeta.mockResolvedValue(null); // no sync meta = local-only mode
  });

  it("updates only the refreshed accounts, leaving partner accounts untouched", async () => {
    const state = makeState({ accounts: [LOS_ACCOUNT, JACKIA_ACCOUNT] });
    loadAppState.mockResolvedValue(state);

    const { createEngine } = await import("../engine");
    const engine = createEngine();

    // Only Los's account is refreshed with new balance
    const freshLos: Account = {
      ...LOS_ACCOUNT,
      balance: Money.fromCents(75000), // new balance from Plaid
    };

    const result = await engine.updatePlaidBalances({ updatedAccounts: [freshLos] });

    const losAccount = result.state.accounts.find((a) => a.id === "plaid-los-checking");
    const jackiaAccount = result.state.accounts.find((a) => a.id === "plaid-jackia-checking");

    expect(losAccount?.balance.cents).toBe(75000); // updated
    expect(jackiaAccount?.balance.cents).toBe(65000); // unchanged
  });

  it("preserves ownerUserId and institutionName on non-refreshed accounts", async () => {
    const state = makeState({ accounts: [LOS_ACCOUNT, JACKIA_ACCOUNT] });
    loadAppState.mockResolvedValue(state);

    const { createEngine } = await import("../engine");
    const engine = createEngine();

    const freshLos: Account = { ...LOS_ACCOUNT, balance: Money.fromCents(75000) };
    const result = await engine.updatePlaidBalances({ updatedAccounts: [freshLos] });

    const jackiaAccount = result.state.accounts.find((a) => a.id === "plaid-jackia-checking");
    expect(jackiaAccount?.ownerUserId).toBe("user-jackia");
    expect(jackiaAccount?.institutionName).toBe("Navy Federal");
  });

  it("backfills ownerUserId and institutionName from fresh Plaid data", async () => {
    // Existing account has no ownership fields (pre-27.8.1 data)
    const legacyAccount: Account = {
      id: "plaid-los-checking",
      name: "Los Checking",
      balance: Money.fromCents(50000),
      accountType: "depository",
    };
    const state = makeState({ accounts: [legacyAccount] });
    loadAppState.mockResolvedValue(state);

    const { createEngine } = await import("../engine");
    const engine = createEngine();

    const freshWithOwnership: Account = {
      ...legacyAccount,
      balance: Money.fromCents(75000),
      ownerUserId: "user-los",
      institutionName: "SoFi",
    };

    const result = await engine.updatePlaidBalances({ updatedAccounts: [freshWithOwnership] });

    const account = result.state.accounts.find((a) => a.id === "plaid-los-checking");
    expect(account?.ownerUserId).toBe("user-los");
    expect(account?.institutionName).toBe("SoFi");
    expect(account?.balance.cents).toBe(75000);
  });

  it("handles empty updatedAccounts without modifying state", async () => {
    const state = makeState({ accounts: [LOS_ACCOUNT, JACKIA_ACCOUNT] });
    loadAppState.mockResolvedValue(state);

    const { createEngine } = await import("../engine");
    const engine = createEngine();

    const result = await engine.updatePlaidBalances({ updatedAccounts: [] });

    expect(result.state.accounts).toHaveLength(2);
    expect(result.state.accounts[0].balance.cents).toBe(50000);
    expect(result.state.accounts[1].balance.cents).toBe(65000);
  });
});
