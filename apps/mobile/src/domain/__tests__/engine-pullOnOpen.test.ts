import { Money } from "@money-shepherd/domain";
import type { AppStateV1 } from "../appState";
import type { SyncMeta } from "../../infra/local/syncMeta";
import type { RemoteSnapshot } from "../../infra/remote/householdStateRepo";

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

const { loadSyncMeta, saveSyncMeta } = jest.requireMock("../../infra/local/syncMeta") as {
  loadSyncMeta: jest.Mock;
  saveSyncMeta: jest.Mock;
};
const { loadAppState, saveAppState } = jest.requireMock("../storage") as {
  loadAppState: jest.Mock;
  saveAppState: jest.Mock;
};
const { ensureAnonAuth } = jest.requireMock("../../infra/firebase/firebaseClient") as {
  ensureAnonAuth: jest.Mock;
};
const { HouseholdStateRepo } = jest.requireMock("../../infra/remote/householdStateRepo") as {
  HouseholdStateRepo: jest.Mock;
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

const META: SyncMeta = { householdId: "hh-1", rev: 3, userId: "user-los" };

let pullMock: jest.Mock;
let pushMock: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  ensureAnonAuth.mockResolvedValue({ uid: "anon-123" });

  pullMock = jest.fn();
  pushMock = jest.fn();
  HouseholdStateRepo.mockImplementation(() => ({
    pull: pullMock,
    push: pushMock,
    clear: jest.fn(),
  }));
});

// ─── Tests: getState pull-on-open ───────────────────────────

describe("engine.getState — pull-on-open", () => {
  let createEngine: typeof import("../engine").createEngine;

  beforeEach(() => {
    jest.isolateModules(() => {
      createEngine = require("../engine").createEngine;
    });
  });

  it("uses remote state when remote rev is higher", async () => {
    const localState = makeState({ updatedAt: "2024-01-01T00:00:00.000Z" });
    const remoteState = makeState({ updatedAt: "2024-06-01T00:00:00.000Z" });

    loadSyncMeta.mockResolvedValue(META);
    loadAppState.mockResolvedValue(localState);
    pullMock.mockResolvedValue({ rev: 5, state: remoteState } as RemoteSnapshot);

    const engine = createEngine();
    const result = await engine.getState();

    expect(result).toBe(remoteState);
    expect(saveAppState).toHaveBeenCalledWith(remoteState);
    expect(saveSyncMeta).toHaveBeenCalledWith({ ...META, rev: 5 });
  });

  it("uses local state when remote rev equals local rev", async () => {
    const localState = makeState();

    loadSyncMeta.mockResolvedValue(META);
    loadAppState.mockResolvedValue(localState);
    pullMock.mockResolvedValue({ rev: 3, state: makeState() } as RemoteSnapshot);

    const engine = createEngine();
    const result = await engine.getState();

    expect(result).toBe(localState);
    expect(saveAppState).not.toHaveBeenCalled();
  });

  it("uses local state when remote is unreachable", async () => {
    const localState = makeState();

    loadSyncMeta.mockResolvedValue(META);
    loadAppState.mockResolvedValue(localState);
    pullMock.mockRejectedValue(new Error("Network error"));

    const engine = createEngine();
    const result = await engine.getState();

    expect(result).toBe(localState);
    expect(saveAppState).not.toHaveBeenCalled();
  });

  it("uses local state when remote returns null", async () => {
    const localState = makeState();

    loadSyncMeta.mockResolvedValue(META);
    loadAppState.mockResolvedValue(localState);
    pullMock.mockResolvedValue(null);

    const engine = createEngine();
    const result = await engine.getState();

    expect(result).toBe(localState);
    expect(saveAppState).not.toHaveBeenCalled();
  });

  it("falls through to bootstrap when no local state", async () => {
    const remoteState = makeState({ updatedAt: "2024-06-01T00:00:00.000Z" });

    loadSyncMeta.mockResolvedValue(META);
    loadAppState.mockResolvedValue(null);
    pullMock.mockResolvedValue({ rev: 5, state: remoteState } as RemoteSnapshot);

    const engine = createEngine();
    const result = await engine.getState();

    // bootstrap path: should get remote state
    expect(result).toBe(remoteState);
  });
});

// ─── Tests: syncNow pull-then-push ──────────────────────────

describe("engine.syncNow — pull-then-push", () => {
  let createEngine: typeof import("../engine").createEngine;

  beforeEach(() => {
    jest.isolateModules(() => {
      createEngine = require("../engine").createEngine;
    });
  });

  it("pulls remote and returns it when remote rev is higher", async () => {
    const remoteState = makeState({ updatedAt: "2024-06-01T00:00:00.000Z" });

    loadSyncMeta.mockResolvedValue(META);
    pullMock.mockResolvedValue({ rev: 5, state: remoteState } as RemoteSnapshot);

    const engine = createEngine();
    const onSync = jest.fn();
    engine.onSyncResult = onSync;

    const result = await engine.syncNow();

    expect(result.pulledRemote).toBe(true);
    expect(result.state).toBe(remoteState);
    expect(saveAppState).toHaveBeenCalledWith(remoteState);
    expect(saveSyncMeta).toHaveBeenCalledWith({ ...META, rev: 5 });
    expect(onSync).toHaveBeenCalledWith({ syncOutcome: "conflict-resolved" });
  });

  it("pushes local when remote rev matches", async () => {
    const localState = makeState();

    loadSyncMeta.mockResolvedValue(META);
    pullMock.mockResolvedValue({ rev: 3, state: makeState() } as RemoteSnapshot);
    loadAppState.mockResolvedValue(localState);
    pushMock.mockResolvedValue({ rev: 4 });

    const engine = createEngine();
    const result = await engine.syncNow();

    expect(result.pulledRemote).toBe(false);
    expect(result.state).toBeUndefined();
  });

  it("returns early when no syncMeta", async () => {
    loadSyncMeta.mockResolvedValue(null);

    const engine = createEngine();
    const result = await engine.syncNow();

    expect(result.pulledRemote).toBe(false);
    expect(pullMock).not.toHaveBeenCalled();
  });
});
