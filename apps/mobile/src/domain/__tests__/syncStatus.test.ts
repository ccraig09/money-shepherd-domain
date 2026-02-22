import {
  initialSyncState,
  syncTransition,
  type SyncState,
  type SyncEvent,
} from "../syncStatus";

describe("initialSyncState", () => {
  it("returns idle state with no history", () => {
    const state = initialSyncState();
    expect(state).toEqual({
      status: "idle",
      lastSyncedAt: null,
      lastError: null,
      pendingChanges: 0,
    });
  });
});

describe("syncTransition", () => {
  const idle = initialSyncState();

  it("transitions from idle to syncing on sync-start", () => {
    const next = syncTransition(idle, { type: "sync-start" });
    expect(next.status).toBe("syncing");
    expect(next.lastError).toBeNull();
  });

  it("transitions from syncing to success", () => {
    const syncing = syncTransition(idle, { type: "sync-start" });
    const next = syncTransition(syncing, {
      type: "sync-success",
      at: "2024-06-01T12:00:00.000Z",
    });
    expect(next.status).toBe("success");
    expect(next.lastSyncedAt).toBe("2024-06-01T12:00:00.000Z");
    expect(next.lastError).toBeNull();
    expect(next.pendingChanges).toBe(0);
  });

  it("transitions from syncing to error", () => {
    const syncing = syncTransition(idle, { type: "sync-start" });
    const next = syncTransition(syncing, {
      type: "sync-error",
      error: "Network failed",
    });
    expect(next.status).toBe("error");
    expect(next.lastError).toBe("Network failed");
  });

  it("preserves lastSyncedAt on error", () => {
    const synced: SyncState = {
      status: "success",
      lastSyncedAt: "2024-06-01T12:00:00.000Z",
      lastError: null,
      pendingChanges: 0,
    };
    const syncing = syncTransition(synced, { type: "sync-start" });
    const errored = syncTransition(syncing, {
      type: "sync-error",
      error: "Push failed",
    });
    expect(errored.lastSyncedAt).toBe("2024-06-01T12:00:00.000Z");
  });

  it("handles conflict-resolved like success", () => {
    const syncing = syncTransition(idle, { type: "sync-start" });
    const next = syncTransition(syncing, {
      type: "sync-conflict-resolved",
      at: "2024-06-01T13:00:00.000Z",
    });
    expect(next.status).toBe("success");
    expect(next.lastSyncedAt).toBe("2024-06-01T13:00:00.000Z");
    expect(next.pendingChanges).toBe(0);
  });

  it("increments pendingChanges on local-save", () => {
    const next = syncTransition(idle, { type: "local-save" });
    expect(next.pendingChanges).toBe(1);
    const next2 = syncTransition(next, { type: "local-save" });
    expect(next2.pendingChanges).toBe(2);
  });

  it("resets pendingChanges on sync-success", () => {
    let state = syncTransition(idle, { type: "local-save" });
    state = syncTransition(state, { type: "local-save" });
    expect(state.pendingChanges).toBe(2);

    state = syncTransition(state, { type: "sync-start" });
    state = syncTransition(state, {
      type: "sync-success",
      at: "2024-06-01T14:00:00.000Z",
    });
    expect(state.pendingChanges).toBe(0);
  });

  it("clears lastError on sync-start", () => {
    const errored: SyncState = {
      status: "error",
      lastSyncedAt: null,
      lastError: "Previous failure",
      pendingChanges: 1,
    };
    const next = syncTransition(errored, { type: "sync-start" });
    expect(next.lastError).toBeNull();
    expect(next.status).toBe("syncing");
  });

  it("resets everything on reset event", () => {
    const dirty: SyncState = {
      status: "error",
      lastSyncedAt: "2024-06-01T12:00:00.000Z",
      lastError: "Some error",
      pendingChanges: 5,
    };
    const next = syncTransition(dirty, { type: "reset" });
    expect(next).toEqual(initialSyncState());
  });
});
