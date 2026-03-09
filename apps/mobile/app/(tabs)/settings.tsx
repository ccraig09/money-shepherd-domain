import React from "react";
import {
  View,
  Text,
  Pressable,
  Switch,
  StyleSheet,
  Alert,
  Share,
  ActivityIndicator,
  ScrollView,
  useColorScheme,
} from "react-native";
import { useRouter } from "expo-router";
import { loadSyncMeta, type SyncMeta } from "../../src/infra/local/syncMeta";
import { clearPin } from "../../src/infra/local/pin";
import { useAppStore } from "../../src/store/useAppStore";
import { hasDuplicateAccounts } from "../../src/domain/commands";
import { buildExportPayload } from "../../src/domain/exportData";
import type { SyncStatus } from "../../src/domain/syncStatus";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../../src/ui/tokens";
import { useThemedStyles, useTheme } from "@/src/ui/ThemeProvider";
import { Features } from "../../src/config/features";
import { readAiUsage, type AiUsageStats } from "../../src/infra/firebase/aiUsage";
import {
  hasBiometricHardware,
  isBiometricEnrolled,
  loadBiometricPreference,
  saveBiometricPreference,
  authenticateWithBiometric,
  getBiometricTypeLabel,
} from "../../src/infra/local/biometric";

export default function SettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors, preference, setPreference } = useTheme();
  const systemScheme = useColorScheme();
  const router = useRouter();
  const state = useAppStore((s) => s.state);
  const resetAll = useAppStore((s) => s.resetAll);
  const switchUser = useAppStore((s) => s.switchUser);
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const syncState = useAppStore((s) => s.syncState);
  const syncNow = useAppStore((s) => s.syncNow);
  const dedupAccounts = useAppStore((s) => s.deduplicateAccounts);

  const hasDupes = state ? hasDuplicateAccounts(state) : false;

  const [meta, setMeta] = React.useState<SyncMeta | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);

  // Biometric state
  const [biometricSupported, setBiometricSupported] = React.useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = React.useState(false);
  const [biometricEnabled, setBiometricEnabled] = React.useState(false);
  const [biometricLabel, setBiometricLabel] = React.useState("Biometric");

  // AI usage state
  const [aiUsage, setAiUsage] = React.useState<AiUsageStats | null>(null);

  async function refreshMeta() {
    const current = await loadSyncMeta();
    setMeta(current);
  }

  React.useEffect(() => {
    refreshMeta();

    // Load AI usage stats
    if (Features.AI_ADVISOR && state?.householdId) {
      readAiUsage(state.householdId).then(setAiUsage).catch(() => {});
    }

    async function initBiometric() {
      const [hasHw, enrolled, prefOn] = await Promise.all([
        hasBiometricHardware(),
        isBiometricEnrolled(),
        loadBiometricPreference(),
      ]);
      setBiometricSupported(hasHw);
      setBiometricEnrolled(enrolled);
      setBiometricEnabled(prefOn);
      if (hasHw) {
        const label = await getBiometricTypeLabel();
        setBiometricLabel(label);
      }
    }
    initBiometric();
  }, []);

  async function handleBiometricToggle(newValue: boolean) {
    if (newValue) {
      const result = await authenticateWithBiometric();
      if (!result.success) return; // verification failed — keep toggle off
      await saveBiometricPreference(true);
      setBiometricEnabled(true);
    } else {
      await saveBiometricPreference(false);
      setBiometricEnabled(false);
    }
  }

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

  function handleResetPin() {
    Alert.alert(
      "Reset PIN",
      "This will clear your PIN. You will need to set a new one on next app launch.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset PIN",
          style: "destructive",
          onPress: async () => {
            await clearPin();
            useAppStore.setState({ guardState: "needs-pin-setup" });
          },
        },
      ],
    );
  }

  async function handleCopyDebugInfo() {
    const lines: string[] = [
      "— Money Shepherd Debug Info —",
      `App version: 1.0.0`,
      `User: ${meta?.userId ? userLabel(meta.userId) : "unknown"}`,
      `Household: ${meta?.householdId ?? "none"}`,
      `Sync status: ${syncStatusLabel(syncState.status)}`,
      `Last synced: ${syncState.lastSyncedAt ? formatSyncTime(syncState.lastSyncedAt) : lastSyncAt ? formatSyncTime(lastSyncAt) : "never"}`,
      `Pending changes: ${syncState.pendingChanges}`,
      ...(syncState.lastError ? [`Last error: ${syncState.lastError}`] : []),
      `Feature flags: PLAID=${Features.PLAID}, REMOTE_SYNC=${Features.REMOTE_SYNC}`,
      `Transactions: ${state?.transactions.length ?? 0}`,
      `Envelopes: ${state?.budget.envelopes.length ?? 0}`,
      `Accounts: ${state?.accounts.length ?? 0}`,
    ];
    try {
      await Share.share({ message: lines.join("\n"), title: "Debug Info" });
    } catch {
      // User cancelled
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
        <Divider />
        <ActionButton
          label="Share Debug Info"
          onPress={handleCopyDebugInfo}
          disabled={isBusy}
        />
      </View>

      {/* Security — biometric toggle */}
      {biometricSupported && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Security</Text>
          {biometricEnrolled ? (
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{biometricLabel}</Text>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: colors.borderLight, true: colors.primary }}
              />
            </View>
          ) : (
            <Text style={styles.hintText}>
              {biometricLabel} is not set up. Enable it in your device Settings.
            </Text>
          )}
        </View>
      )}

      {/* Appearance */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Appearance</Text>
        {(["light", "dark", "system"] as const).map((opt) => {
          const active = preference === opt;
          const label =
            opt === "system"
              ? `System (${systemScheme === "dark" ? "Dark" : "Light"})`
              : opt === "light"
                ? "Light"
                : "Dark";
          return (
            <Pressable
              key={opt}
              onPress={() => setPreference(opt)}
              style={({ pressed }) => [
                styles.themeRow,
                pressed && styles.actionBtnPressed,
              ]}
            >
              <Text style={[styles.themeLabel, active && styles.themeLabelActive]}>
                {label}
              </Text>
              {active && <Text style={styles.themeCheck}>✓</Text>}
            </Pressable>
          );
        })}
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

      {/* AI Usage */}
      {Features.AI_ADVISOR && aiUsage && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI Advisor</Text>
          <Row label="Calls today" value={`${aiUsage.callsToday} / 20`} />
          <Row label="Calls this month" value={`${aiUsage.totalCalls}`} />
          <AiBudgetBar costCents={aiUsage.estimatedCostCents} />
        </View>
      )}

      {/* Budget */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Budget</Text>
        <ActionButton
          label="Reconcile Budget"
          onPress={() => router.push("/seed-budget")}
          disabled={isBusy || !state || state.accounts.length === 0}
        />
      </View>

      {/* Smart Assignment */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Smart Assignment</Text>
        <ActionButton
          label="Assignment Rules"
          onPress={() => router.push("/settings/assignment-rules")}
          disabled={isBusy}
        />
      </View>

      {/* Privacy */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Legal</Text>
        <ActionButton
          label="Privacy & Data"
          onPress={() => router.push("/settings/privacy")}
          disabled={isBusy}
        />
      </View>

      {/* Data */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Data</Text>
        <ActionButton
          label="Export Data"
          onPress={handleExport}
          disabled={isBusy || !state}
        />
        <Divider />
        <ActionButton
          label="Import Data"
          onPress={() => router.push("/settings/import")}
          disabled={isBusy}
        />
        {hasDupes && (
          <>
            <Divider />
            <ActionButton
              label="Clean Up Duplicates"
              onPress={dedupAccounts}
              disabled={isBusy}
            />
          </>
        )}
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
          label="Reset PIN"
          onPress={handleResetPin}
          disabled={isBusy}
          destructive
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
        <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
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
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Divider() {
  const styles = useThemedStyles(createStyles);
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
  const styles = useThemedStyles(createStyles);
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

const AI_BUDGET_CAP_CENTS = 700; // $7.00
const AI_BUDGET_WARNING_PERCENT = 0.75;

function AiBudgetBar({ costCents }: { costCents: number }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const percent = Math.min(costCents / AI_BUDGET_CAP_CENTS, 1);
  const isWarning = percent >= AI_BUDGET_WARNING_PERCENT;
  const isFull = percent >= 1;
  const costDollars = (costCents / 100).toFixed(2);
  const capDollars = (AI_BUDGET_CAP_CENTS / 100).toFixed(2);

  return (
    <View style={styles.budgetBarContainer}>
      <View style={styles.budgetBarLabels}>
        <Text style={[styles.budgetBarCost, isFull && styles.budgetBarFull, isWarning && !isFull && styles.budgetBarWarning]}>
          ${costDollars}
        </Text>
        <Text style={styles.budgetBarCap}>/ ${capDollars}</Text>
      </View>
      <View style={styles.budgetBarTrack}>
        <View
          style={[
            styles.budgetBarFill,
            { width: `${Math.round(percent * 100)}%` as `${number}%` },
            isFull
              ? { backgroundColor: colors.error }
              : isWarning
                ? { backgroundColor: colors.warning }
                : { backgroundColor: colors.primary },
          ]}
        />
        {/* 75% warning marker */}
        <View style={[styles.budgetBarMarker, { left: "75%" }]} />
      </View>
      {isWarning && !isFull && (
        <Text style={styles.budgetBarHint}>Approaching monthly limit</Text>
      )}
      {isFull && (
        <Text style={[styles.budgetBarHint, { color: colors.error }]}>Monthly limit reached</Text>
      )}
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.surfaceLight },
  container: { padding: Spacing.lg, paddingTop: 60, gap: Spacing.lg, paddingBottom: Spacing.bottomPad },
  appName: { fontSize: FontSize.small, fontWeight: FontWeight.semibold, color: c.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  pageTitle: { fontSize: FontSize.title, fontWeight: FontWeight.extrabold, color: c.textDark, marginTop: 2 },
  card: {
    backgroundColor: c.surface,
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
    color: c.textMuted,
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
  rowLabel: { fontSize: FontSize.body, color: c.textMid },
  rowValue: { fontSize: FontSize.body, color: c.textDark, fontWeight: FontWeight.medium, maxWidth: "60%" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderLight, marginVertical: 2 },
  actionBtn: { paddingVertical: Spacing.md, minHeight: 44 },
  actionBtnPressed: { opacity: 0.6 },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { fontSize: FontSize.subtitle, color: c.primary, fontWeight: FontWeight.semibold },
  actionBtnTextDestructive: { color: c.error },
  spinner: { alignSelf: "center", marginTop: Spacing.sm },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  toggleLabel: { fontSize: FontSize.subtitle, color: c.textDark, fontWeight: FontWeight.semibold },
  hintText: { fontSize: FontSize.body, color: c.textMuted, lineHeight: 20 },
  themeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    minHeight: 44,
  },
  themeLabel: { fontSize: FontSize.subtitle, color: c.textMid },
  themeLabelActive: { color: c.textDark, fontWeight: FontWeight.semibold },
  themeCheck: { fontSize: FontSize.subtitle, color: c.primary, fontWeight: FontWeight.bold },
  budgetBarContainer: { paddingVertical: Spacing.sm },
  budgetBarLabels: { flexDirection: "row", alignItems: "baseline", marginBottom: Spacing.xs },
  budgetBarCost: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, color: c.textDark },
  budgetBarWarning: { color: c.warning },
  budgetBarFull: { color: c.error },
  budgetBarCap: { fontSize: FontSize.small, color: c.textMuted, marginLeft: Spacing.xs },
  budgetBarTrack: { height: 8, backgroundColor: c.borderLight, borderRadius: 4, overflow: "hidden" as const, position: "relative" as const },
  budgetBarFill: { height: "100%", borderRadius: 4 },
  budgetBarMarker: { position: "absolute" as const, top: 0, bottom: 0, width: 2, backgroundColor: c.textMuted, opacity: 0.4 },
  budgetBarHint: { fontSize: FontSize.caption, color: c.warning, marginTop: Spacing.xs },
});
