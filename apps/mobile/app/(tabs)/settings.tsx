import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { loadSyncMeta, type SyncMeta } from "../../src/infra/local/syncMeta";
import { useAppStore } from "../../src/store/useAppStore";

export default function SettingsScreen() {
  const router = useRouter();
  const resetAll = useAppStore((s) => s.resetAll);
  const switchUser = useAppStore((s) => s.switchUser);
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);

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

  const otherUser = meta?.userId === "user-los" ? "Jackia" : "Los";

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>Settings</Text>

      {/* Sync status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sync</Text>
        <Row label="Last synced" value={lastSyncAt ? formatSyncTime(lastSyncAt) : "Not yet this session"} />
        <Row label="User" value={meta ? userLabel(meta.userId) : "—"} />
      </View>

      {/* Device info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Device</Text>
        <Row label="Household" value={meta?.householdId ?? "—"} />
      </View>

      {/* Plaid */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bank Connections</Text>
        <ActionButton
          label="Connect Accounts"
          onPress={() => router.push("/settings/connect-accounts")}
          disabled={isBusy}
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
        <ActivityIndicator size="small" color={ACCENT} style={styles.spinner} />
      )}
    </ScrollView>
  );
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

const PRIMARY = "#1a1a2e";
const ACCENT = "#4f8ef7";
const DESTRUCTIVE = "#d94f4f";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f7f7f9" },
  container: { padding: 20, gap: 20, paddingBottom: 40 },
  pageTitle: { fontSize: 28, fontWeight: "800", color: PRIMARY, marginTop: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  rowLabel: { fontSize: 15, color: "#444" },
  rowValue: { fontSize: 15, color: PRIMARY, fontWeight: "500", maxWidth: "60%" },
  divider: { height: 1, backgroundColor: "#f0f0f0", marginVertical: 2 },
  actionBtn: { paddingVertical: 14 },
  actionBtnPressed: { opacity: 0.6 },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { fontSize: 16, color: ACCENT, fontWeight: "600" },
  actionBtnTextDestructive: { color: DESTRUCTIVE },
  spinner: { alignSelf: "center", marginTop: 8 },
});
