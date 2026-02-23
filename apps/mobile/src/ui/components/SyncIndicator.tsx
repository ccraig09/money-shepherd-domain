import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useAppStore } from "../../store/useAppStore";
import type { SyncStatus } from "../../domain/syncStatus";

const SUCCESS_VISIBLE_MS = 3_000;

export function SyncIndicator() {
  const syncState = useAppStore((s) => s.syncState);
  const [showSuccess, setShowSuccess] = useState(false);

  // Auto-hide "Synced" after a few seconds
  useEffect(() => {
    if (syncState.status === "success") {
      setShowSuccess(true);
      const id = setTimeout(() => setShowSuccess(false), SUCCESS_VISIBLE_MS);
      return () => clearTimeout(id);
    }
    setShowSuccess(false);
  }, [syncState.status, syncState.lastSyncedAt]);

  const status = syncState.status;
  const pending = syncState.pendingChanges;

  // Idle with no pending → render nothing
  if (status === "idle" && pending === 0) return null;
  // Success that has faded with no pending → render nothing
  if (status === "success" && !showSuccess && pending === 0) return null;

  // Pending changes waiting to sync (idle or error state with local saves queued)
  if (pending > 0 && (status === "idle" || (status === "success" && !showSuccess))) {
    return (
      <View style={[styles.pill, { backgroundColor: "#fff8e1" }]}>
        <View style={[styles.dot, { backgroundColor: "#f59e0b" }]} />
        <Text style={[styles.label, { color: "#92400e" }]}>
          {pending} pending
        </Text>
      </View>
    );
  }

  const config = statusConfig[status];
  const label =
    status === "error" && pending > 0
      ? `Sync failed · ${pending} pending`
      : config.text;

  return (
    <View style={[styles.pill, { backgroundColor: config.bg }]}>
      {status === "syncing" ? (
        <ActivityIndicator size={10} color={config.color} />
      ) : (
        <View style={[styles.dot, { backgroundColor: config.color }]} />
      )}
      <Text style={[styles.label, { color: config.color }]}>{label}</Text>
    </View>
  );
}

const statusConfig: Record<
  SyncStatus,
  { text: string; color: string; bg: string }
> = {
  idle: { text: "", color: "#999", bg: "transparent" },
  syncing: { text: "Syncing…", color: "#4f8ef7", bg: "#eef4ff" },
  success: { text: "Synced", color: "#2d9e6b", bg: "#edfaf3" },
  error: { text: "Sync failed", color: "#d94f4f", bg: "#fdeaea" },
  offline: { text: "Offline", color: "#888", bg: "#f0f0f0" },
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
});
