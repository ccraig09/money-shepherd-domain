import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Share,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { loadSyncMeta, type SyncMeta } from "../../src/infra/local/syncMeta";
import { useAppStore } from "../../src/store/useAppStore";
import { buildExportPayload } from "../../src/domain/exportData";
import type { SyncStatus } from "../../src/domain/syncStatus";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../../src/ui/tokens";
import { Features } from "../../src/config/features";

export default function SettingsScreen() {
  const router = useRouter();
  const state = useAppStore((s) => s.state);
  const resetAll = useAppStore((s) => s.resetAll);
  const switchUser = useAppStore((s) => s.switchUser);
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const syncState = useAppStore((s) => s.syncState);
  const syncNow = useAppStore((s) => s.syncNow);

  const [meta, setMeta] = React.useState<SyncMeta | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);

  async function refreshMeta() {
    const current = await loadSyncMeta();
    setMeta(current);
  }

  React.useEffect(() => {
    refreshMeta();
  }, []);

  async function handleSwitchUser() {
    setIsBusy(true);
    try {
      await switchUser();
      await refreshMeta();
    } finally {
      setIsBusy(false);
    }
  }

  function handleChangeHousehold() {
    Alert.alert(
      "Change Household",
      "This will clear all local data and sync meta. You will need to set up the device again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear and restart",
          style: "destructive",
          onPress: async () => {
            setIsBusy(true);
            try {
              await resetAll();
            } finally {
              setIsBusy(false);
            }
          },
        },
      ]
    );
  }

  function handleReset() {
    Alert.alert(
      "Reset Local Storage",
      "This will clear all app data on this device. You will need to set up the device again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setIsBusy(true);
            try {
              await resetAll();
            } finally {
              setIsBusy(false);
            }
          },
        },
      ]
    );
  }

  async function handleExport() {
    if (!state) return;
    const payload = buildExportPayload(state);
    const json = JSON.stringify(payload, null, 2);
    try {
      await Share.share({
        message: json,
        title: "Money Shepherd Export",
      });
    } catch {
      // User cancelled or share failed — no action needed
    }
  }

  const otherUser = meta?.userId === "user-los" ? "Jackia" : "Los";

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <Text style={styles.appName}>Money Shepherd</Text>
      <Text style={styles.pageTitle}>Settings</Text>

      {/* Sync status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sync</Text>
        <Row label="Status" value={syncStatusLabel(syncState.status)} />
        <Row label="Last synced" value={syncState.lastSyncedAt ? formatSyncTime(syncState.lastSyncedAt) : lastSyncAt ? formatSyncTime(lastSyncAt) : "Not yet this session"} />
        <Row label="Pending changes" value={syncState.pendingChanges > 0 ? `${syncState.pendingChanges}` : "None"} />
        {syncState.lastError && <Row label="Last error" value={syncState.lastError} />}
        <Row label="User" value={meta ? userLabel(meta.userId) : "—"} />
        <Divider />
        <ActionButton
          label="Sync now"
          onPress={syncNow}
          disabled={isBusy || syncState.status === "syncing"}
        />
      </View>

      {/* Device info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Device</Text>
        <Row label="Household" value={meta?.householdId ?? "—"} />
      </View>

      {/* Plaid */}
      {Features.PLAID && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bank Connections</Text>
          <ActionButton
            label="Connect Accounts"
            onPress={() => router.push("/settings/connect-accounts")}
            disabled={isBusy}
          />
        </View>
      )}

      {/* Data */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Data</Text>
        <ActionButton
          label="Export Data"
          onPress={handleExport}
          disabled={isBusy || !state}
        />
      </View>

      {/* Actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>

        <ActionButton
          label={`Switch to ${otherUser}`}
          onPress={handleSwitchUser}
          disabled={isBusy || !meta}
        />

        <Divider />

        <ActionButton
          label="Change Household"
          onPress={handleChangeHousehold}
          disabled={isBusy}
          destructive
        />

        <Divider />

        <ActionButton
          label="Reset Local Storage"
          onPress={handleReset}
          disabled={isBusy}
          destructive
        />
      </View>

      {isBusy && (
        <ActivityIndicator size="small" color={Color.primary} style={styles.spinner} />
      )}
    </ScrollView>
  );
}

const syncStatusLabels: Record<SyncStatus, string> = {
  idle: "Up to date",
  syncing: "Syncing…",
  success: "Synced",
  error: "Sync failed",
  offline: "Offline",
};

function syncStatusLabel(status: SyncStatus): string {
  return syncStatusLabels[status];
}

function userLabel(userId: string): string {
  if (userId === "user-los") return "Los";
  if (userId === "user-jackia") return "Jackia";
  return userId;
}

function formatSyncTime(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    const time = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    if (isToday) return `Today, ${time}`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + `, ${time}`;
  } catch {
    return "—";
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function ActionButton({
  label,
  onPress,
  disabled,
  destructive,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionBtn,
        pressed && styles.actionBtnPressed,
        disabled && styles.actionBtnDisabled,
      ]}
    >
      <Text style={[styles.actionBtnText, destructive && styles.actionBtnTextDestructive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Color.surfaceLight },
  container: { padding: Spacing.lg, paddingTop: 60, gap: Spacing.lg, paddingBottom: Spacing.bottomPad },
  appName: { fontSize: FontSize.small, fontWeight: FontWeight.semibold, color: Color.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  pageTitle: { fontSize: FontSize.title, fontWeight: FontWeight.extrabold, color: Color.textDark, marginTop: 2 },
  card: {
    backgroundColor: Color.surface,
    borderRadius: Radius.hero,
    padding: Spacing.base,
    gap: Spacing.xs,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Color.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  rowLabel: { fontSize: FontSize.body, color: Color.textMid },
  rowValue: { fontSize: FontSize.body, color: Color.textDark, fontWeight: FontWeight.medium, maxWidth: "60%" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Color.borderLight, marginVertical: 2 },
  actionBtn: { paddingVertical: Spacing.md, minHeight: 44 },
  actionBtnPressed: { opacity: 0.6 },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { fontSize: FontSize.subtitle, color: Color.primary, fontWeight: FontWeight.semibold },
  actionBtnTextDestructive: { color: Color.error },
  spinner: { alignSelf: "center", marginTop: Spacing.sm },
});
