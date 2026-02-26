import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../tokens";
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
      <View style={[styles.pill, styles.pillProminent, { backgroundColor: Color.warningSurface, borderColor: Color.warning }]}>
        <View style={[styles.dot, { backgroundColor: Color.warning }]} />
        <Text style={[styles.labelProminent, { color: Color.warning }]}>
          {pending} pending
        </Text>
      </View>
    );
  }

  const conflictMsg = syncState.lastConflictMessage;
  const config = statusConfig[status];
  const label =
    status === "error" && pending > 0
      ? `Sync failed · ${pending} pending`
      : conflictMsg && status === "success"
        ? conflictMsg
        : config.text;

  const isError = status === "error";

  return (
    <View style={[styles.pill, isError && styles.pillProminent, { backgroundColor: config.bg }, isError && { borderColor: config.color }]}>
      {status === "syncing" ? (
        <ActivityIndicator size={10} color={config.color} />
      ) : (
        <View style={[styles.dot, { backgroundColor: config.color }]} />
      )}
      <Text style={[isError ? styles.labelProminent : styles.label, { color: config.color }]}>{label}</Text>
    </View>
  );
}

const statusConfig: Record<
  SyncStatus,
  { text: string; color: string; bg: string }
> = {
  idle: { text: "", color: Color.textMuted, bg: "transparent" },
  syncing: { text: "Syncing…", color: Color.primary, bg: Color.primarySurface },
  success: { text: "Synced", color: Color.success, bg: Color.successSurface },
  error: { text: "Sync failed", color: Color.error, bg: Color.errorSurface },
  offline: { text: "Offline", color: Color.textMuted, bg: Color.surfaceLight },
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.lg,
  },
  pillProminent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  labelProminent: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
  },
});
