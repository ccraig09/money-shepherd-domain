/**
 * Sync status model — tracks Firestore sync state separately from
 * the general app loading state (LoadState).
 *
 * Used by the store to drive the sync indicator (MS-17.2) and
 * pending/retry features (MS-17.4, MS-17.5).
 */

export type SyncStatus = "idle" | "syncing" | "success" | "error" | "offline";

export type SyncState = {
  status: SyncStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
  pendingChanges: number;
};

export type SyncOutcome =
  | "pushed"
  | "conflict-resolved"
  | "local-only"
  | "error";

export function initialSyncState(): SyncState {
  return {
    status: "idle",
    lastSyncedAt: null,
    lastError: null,
    pendingChanges: 0,
  };
}

export type SyncEvent =
  | { type: "sync-start" }
  | { type: "sync-success"; at: string }
  | { type: "sync-conflict-resolved"; at: string }
  | { type: "sync-error"; error: string }
  | { type: "local-save" }
  | { type: "reset" };

export function syncTransition(
  current: SyncState,
  event: SyncEvent,
): SyncState {
  switch (event.type) {
    case "sync-start":
      return { ...current, status: "syncing", lastError: null };

    case "sync-success":
      return {
        ...current,
        status: "success",
        lastSyncedAt: event.at,
        lastError: null,
        pendingChanges: 0,
      };

    case "sync-conflict-resolved":
      return {
        ...current,
        status: "success",
        lastSyncedAt: event.at,
        lastError: null,
        pendingChanges: 0,
      };

    case "sync-error":
      return {
        ...current,
        status: "error",
        lastError: event.error,
      };

    case "local-save":
      return {
        ...current,
        pendingChanges: current.pendingChanges + 1,
      };

    case "reset":
      return initialSyncState();

    default:
      return current;
  }
}
