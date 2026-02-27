import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../tokens";
import { useThemedStyles, useTheme } from "../ThemeProvider";
import { useAppStore } from "../../store/useAppStore";
import type { SyncStatus } from "../../domain/syncStatus";

const SUCCESS_VISIBLE_MS = 3_000;

export function SyncIndicator() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const syncState = useAppStore((s) => s.syncState);
  const [showSuccess, setShowSuccess] = useState(false);

  const statusConfig: Record<
    SyncStatus,
    { text: string; color: string; bg: string }
  > = {
    idle: { text: "", color: colors.textMuted, bg: "transparent" },
    syncing: { text: "Syncing\u2026", color: colors.primary, bg: colors.primarySurface },
    success: { text: "Synced", color: colors.success, bg: colors.successSurface },
    error: { text: "Sync failed", color: colors.error, bg: colors.errorSurface },
    offline: { text: "Offline", color: colors.textMuted, bg: colors.surfaceLight },
  };

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
      <View style={[styles.pill, styles.pillProminent, { backgroundColor: colors.warningSurface, borderColor: colors.warning }]}>
        <View style={[styles.dot, { backgroundColor: colors.warning }]} />
        <Text style={[styles.labelProminent, { color: colors.warning }]}>
          {pending} pending
        </Text>
      </View>
    );
  }

  const conflictMsg = syncState.lastConflictMessage;
  const config = statusConfig[status];
  const label =
    status === "error" && pending > 0
      ? `Sync failed \u00b7 ${pending} pending`
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

const createStyles = (c: ColorTokens) => StyleSheet.create({
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
