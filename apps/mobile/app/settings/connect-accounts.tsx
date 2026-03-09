import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";

const PRIVACY_POLICY_URL = "https://ccraig09.github.io/money-shepherd-domain/privacy.html";

/** Shows a consent dialog before opening Plaid Link. Resolves "continue" or "cancel". */
function requestConsent(): Promise<"continue" | "cancel"> {
  return new Promise((resolve) => {
    Alert.alert(
      "Before You Connect",
      "Money Shepherd uses Plaid to securely access your bank account balances and transactions. Your bank credentials are never shared with us — Plaid handles authentication directly.\n\nBy continuing, you agree that Plaid may share your financial data with Money Shepherd solely for personal budgeting. All data is encrypted in transit and at rest.",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => resolve("cancel"),
        },
        {
          text: "Privacy Policy",
          onPress: () => {
            Linking.openURL(PRIVACY_POLICY_URL);
            resolve("cancel");
          },
        },
        {
          text: "I Understand",
          onPress: () => resolve("continue"),
        },
      ]
    );
  });
}
import { usePlaidEmitter, type LinkEvent, LinkEventName } from "react-native-plaid-link-sdk";
import { loadSyncMeta, type SyncMeta } from "../../src/infra/local/syncMeta";
import { plaidConfigured } from "../../src/infra/plaid/config";
import { requestLinkToken, openPlaidLink, exchangePublicToken, fetchAccounts, removeItem } from "../../src/infra/plaid/plaidClient";
import { log, warn } from "../../src/lib/logger";
import {
  addPlaidToken,
  loadPlaidTokens,
  removePlaidToken,
  type PlaidTokenData,
} from "../../src/infra/local/secureTokens";
import { mapPlaidAccounts } from "../../src/infra/plaid/mapAccounts";
import { classifyPlaidError } from "../../src/infra/plaid/errors";
import { writeConnection, readConnections, deactivateConnection, type PlaidConnectionDoc } from "../../src/infra/remote/connectionManifest";
import { createEngine } from "../../src/domain/engine";
import { useAppStore } from "../../src/store/useAppStore";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../../src/ui/tokens";
import { useThemedStyles, useTheme } from "@/src/ui/ThemeProvider";

type UserEntry = {
  id: string;
  label: string;
};

const USERS: UserEntry[] = [
  { id: "user-los", label: "Los" },
  { id: "user-jackia", label: "Jackia" },
];

const engine = createEngine();

export default function ConnectAccountsScreen() {
  const [meta, setMeta] = React.useState<SyncMeta | null>(null);
  const [connecting, setConnecting] = React.useState<string | null>(null);
  const [tokens, setTokens] = React.useState<Record<string, PlaidTokenData[]>>({});
  const [remoteConnections, setRemoteConnections] = React.useState<PlaidConnectionDoc[]>([]);

  const styles = useThemedStyles(createStyles);

  // Capture Plaid Link events for debugging. Plaid support will ask for
  // link_session_id and error_type/error_code when troubleshooting issues.
  usePlaidEmitter((event: LinkEvent) => {
    const { eventName, metadata } = event;
    const payload = {
      eventName,
      linkSessionId: metadata.linkSessionId,
      viewName: metadata.viewName,
      timestamp: metadata.timestamp,
      ...(metadata.errorType && { errorType: metadata.errorType }),
      ...(metadata.errorCode && { errorCode: metadata.errorCode }),
      ...(metadata.errorMessage && { errorMessage: metadata.errorMessage }),
      ...(metadata.institutionId && { institutionId: metadata.institutionId }),
      ...(metadata.requestId && { requestId: metadata.requestId }),
    };
    if (eventName === LinkEventName.ERROR) {
      warn("Plaid:event", payload);
    } else {
      log("Plaid:event", payload);
    }
  });

  React.useEffect(() => {
    loadSyncMeta().then((m) => {
      setMeta(m);
      if (m?.householdId) {
        readConnections(m.householdId)
          .then(setRemoteConnections)
          .catch(() => {}); // best-effort
      }
    });
    loadAllTokens();
  }, []);

  async function loadAllTokens() {
    const entries: Record<string, PlaidTokenData[]> = {};
    for (const user of USERS) {
      entries[user.id] = await loadPlaidTokens(user.id);
    }
    setTokens(entries);
  }

  async function handleConnect(userId: string) {
    if (connecting) return;
    const consent = await requestConsent();
    if (consent === "cancel") return;
    setConnecting(userId);
    try {
      const linkToken = await requestLinkToken(userId);
      openPlaidLink(linkToken, {
        onSuccess: async (publicToken, linkMetadata) => {
          try {
            const { accessToken, itemId } = await exchangePublicToken(publicToken, userId);
            const institutionName = linkMetadata.institution?.name ?? "Your bank";

            // Fetch Plaid accounts before storing token so we can record accountIdMap
            const plaidAccounts = await fetchAccounts(accessToken);
            const state = await engine.getState();

            // Backfill seededAccountIds for legacy users (budgetSeeded but no tracking).
            // Do this BEFORE importing new accounts so they aren't included.
            if (state.budgetSeeded && !state.seededAccountIds) {
              const legacySeeded = state.accounts
                .filter((a) => !a.accountType || a.accountType === "depository")
                .map((a) => a.id);
              await engine.recompute({ ...state, seededAccountIds: legacySeeded });
            }

            const currentState = await engine.getState();
            // Build the set of internal account IDs already owned by this user so
            // name-based reconnect matching doesn't cross into the other user's accounts.
            const existingUserTokens = await loadPlaidTokens(userId);
            const userOwnedAccountIds = new Set(
              existingUserTokens.flatMap((t) => Object.values(t.accountIdMap ?? {}))
            );
            const { accounts: mergedAccounts, accountIdMap } = mapPlaidAccounts(plaidAccounts, userId, currentState.accounts, userOwnedAccountIds, institutionName);
            await addPlaidToken(userId, { accessToken, itemId, institutionName, accountIdMap });
            await engine.importPlaidAccounts({ newAccounts: mergedAccounts });

            // Write connection manifest to Firestore (cross-device visibility)
            if (meta?.householdId) {
              writeConnection(meta.householdId, {
                itemId,
                userId,
                institutionName,
                accountIds: Object.values(accountIdMap),
              }).catch(() => {}); // best-effort
            }

            // Refresh token list
            const updated = await loadPlaidTokens(userId);
            setTokens((prev) => ({ ...prev, [userId]: updated }));

            // Sync the store with the latest persisted state (the local engine
            // already saved via importPlaidAccounts, but the Zustand store is stale)
            const freshState = await engine.getState();
            useAppStore.setState({ state: freshState });

            Alert.alert("Bank connected!", `${institutionName} was linked with ${plaidAccounts.length} account(s). Sync transactions to populate balances.`);
          } catch (err: unknown) {
            const info = classifyPlaidError(err);
            Alert.alert("Connection failed", info.message);
          } finally {
            setConnecting(null);
          }
        },
        onExit: (error) => {
          setConnecting(null);
          if (error) {
            Alert.alert("Connection error", error.displayMessage ?? "Something went wrong connecting your bank.");
          }
        },
      });
    } catch (err: unknown) {
      setConnecting(null);
      const info = classifyPlaidError(err);
      Alert.alert("Unable to connect", info.message);
    }
  }

  async function handleDisconnect(userId: string, itemId: string, accessToken: string, institutionName: string) {
    Alert.alert(
      `Disconnect ${institutionName}?`,
      "This will remove the stored connection. You can reconnect later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            // Revoke access server-side first; if Plaid call fails, still remove locally.
            try {
              await removeItem(accessToken);
            } catch {
              console.warn("[Plaid] removeItem failed — removing local token anyway");
            }
            await removePlaidToken(userId, itemId);
            const updated = await loadPlaidTokens(userId);
            setTokens((prev) => ({ ...prev, [userId]: updated }));

            // Deactivate in Firestore (cross-device visibility)
            if (meta?.householdId) {
              deactivateConnection(meta.householdId, itemId).catch(() => {});
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>Connect Accounts</Text>
      <Text style={styles.pageSubtitle}>
        Link a bank account for each household member to automatically import
        transactions.
      </Text>

      {/* Current user first, then partner */}
      {USERS
        .sort((a, b) => {
          const aIsMe = a.id === meta?.userId ? -1 : 1;
          const bIsMe = b.id === meta?.userId ? -1 : 1;
          return aIsMe - bIsMe;
        })
        .map((user) => {
          const isCurrentUser = meta?.userId === user.id;
          const userTokens = tokens[user.id] ?? [];
          return isCurrentUser ? (
            <UserCard
              key={user.id}
              user={user}
              isConnecting={connecting === user.id}
              connectedBanks={userTokens}
              onConnect={() => handleConnect(user.id)}
              onDisconnect={(itemId, accessToken, name) => handleDisconnect(user.id, itemId, accessToken, name)}
            />
          ) : (
            <PartnerCard
              key={user.id}
              user={user}
              localBanks={userTokens}
              remoteBanks={remoteConnections.filter((c) => c.userId === user.id)}
            />
          );
        })}

      {!plaidConfigured && (
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>
            Plaid is not configured. Set{" "}
            <Text style={styles.warningCode}>EXPO_PUBLIC_PLAID_ENV</Text> in
            your .env to enable bank connections.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function UserCard({
  user,
  isConnecting,
  connectedBanks,
  onConnect,
  onDisconnect,
}: {
  user: UserEntry;
  isConnecting: boolean;
  connectedBanks: PlaidTokenData[];
  onConnect: () => void;
  onDisconnect: (itemId: string, accessToken: string, institutionName: string) => void;
}) {
  const hasConnections = connectedBanks.length > 0;
  const disabled = !plaidConfigured || isConnecting;
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  return (
    <View style={[styles.card, styles.cardActive]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.userName}>
            {user.label} (You)
          </Text>
          <Text style={styles.currentBadge}>This device</Text>
        </View>
        <StatusPill connected={hasConnections} />
      </View>

      {hasConnections && (
        <View style={styles.bankList}>
          {connectedBanks.map((bank) => (
            <View key={bank.itemId} style={styles.bankRow}>
              <Text style={styles.institutionLabel}>{bank.institutionName}</Text>
              <Pressable
                onPress={() => onDisconnect(bank.itemId, bank.accessToken, bank.institutionName)}
                hitSlop={8}
              >
                <Text style={styles.removeLink}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={styles.divider} />

      <Pressable
        style={({ pressed }) => [
          styles.connectBtn,
          pressed && styles.connectBtnPressed,
          disabled && styles.connectBtnDisabled,
        ]}
        onPress={onConnect}
        disabled={disabled}
      >
        {isConnecting ? (
          <ActivityIndicator color={colors.textDisabled} size="small" />
        ) : (
          <Text
            style={[
              styles.connectBtnText,
              disabled && styles.connectBtnTextDisabled,
            ]}
          >
            {hasConnections ? "Add Another Bank" : "Connect Your Bank"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function PartnerCard({
  user,
  localBanks,
  remoteBanks,
}: {
  user: UserEntry;
  localBanks: PlaidTokenData[];
  remoteBanks: PlaidConnectionDoc[];
}) {
  const styles = useThemedStyles(createStyles);

  // Merge local + remote, dedup by itemId. Local tokens take priority.
  const localIds = new Set(localBanks.map((b) => b.itemId));
  const merged: Array<{ itemId: string; institutionName: string; source: "local" | "remote" }> = [
    ...localBanks.map((b) => ({ itemId: b.itemId, institutionName: b.institutionName, source: "local" as const })),
    ...remoteBanks
      .filter((r) => !localIds.has(r.itemId))
      .map((r) => ({ itemId: r.itemId, institutionName: r.institutionName, source: "remote" as const })),
  ];

  const hasConnections = merged.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.userName}>{user.label}</Text>
          <Text style={styles.partnerHint}>
            {hasConnections
              ? `Connected on ${user.label}'s device`
              : "No banks connected yet"}
          </Text>
        </View>
        <StatusPill connected={hasConnections} />
      </View>

      {hasConnections && (
        <View style={styles.bankList}>
          {merged.map((bank) => (
            <View key={bank.itemId} style={styles.bankRow}>
              <Text style={styles.institutionLabel}>{bank.institutionName}</Text>
              {bank.source === "remote" && (
                <Text style={styles.remoteHint}>other device</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function StatusPill({ connected }: { connected: boolean }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.pill, connected ? styles.pillConnected : styles.pillEmpty]}>
      <Text
        style={[
          styles.pillText,
          connected ? styles.pillTextConnected : styles.pillTextEmpty,
        ]}
      >
        {connected ? "Connected" : "Not connected"}
      </Text>
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.surfaceLight },
  container: { padding: 20, gap: Spacing.base, paddingBottom: Spacing.bottomPad },
  pageTitle: { fontSize: FontSize.title, fontWeight: FontWeight.extrabold, color: c.textDark, marginTop: Spacing.sm },
  pageSubtitle: { fontSize: FontSize.body, color: c.textMid, lineHeight: 22, marginBottom: Spacing.xs },
  card: {
    backgroundColor: c.surface,
    borderRadius: Radius.hero,
    padding: Spacing.base,
    shadowColor: c.shadowColor,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardActive: {
    borderColor: c.primary,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  userName: { fontSize: 18, fontWeight: FontWeight.bold, color: c.textDark },
  currentBadge: {
    fontSize: FontSize.caption,
    color: c.primary,
    fontWeight: FontWeight.semibold,
    marginTop: 2,
  },
  partnerHint: {
    fontSize: FontSize.caption,
    color: c.textMuted,
    marginTop: 2,
    maxWidth: 220,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  pillConnected: { backgroundColor: c.successSurface },
  pillEmpty: { backgroundColor: c.surfaceLight },
  pillText: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold },
  pillTextConnected: { color: c.success },
  pillTextEmpty: { color: c.textMuted },
  bankList: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  bankRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  institutionLabel: {
    fontSize: FontSize.small,
    color: c.success,
    fontWeight: FontWeight.medium,
  },
  removeLink: {
    fontSize: FontSize.caption,
    color: c.error,
    fontWeight: FontWeight.semibold,
  },
  remoteHint: {
    fontSize: FontSize.caption,
    color: c.textMuted,
    fontStyle: "italic" as const,
  },
  divider: { height: 1, backgroundColor: c.borderLight, marginBottom: Spacing.md },
  connectBtn: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: c.primary,
  },
  connectBtnSecondary: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: c.primary,
  },
  connectBtnPressed: { opacity: 0.7 },
  connectBtnDisabled: { backgroundColor: c.surfaceLight, borderColor: "transparent" },
  connectBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: c.textOnColor },
  connectBtnTextSecondary: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: c.primary },
  connectBtnTextDisabled: { color: c.textDisabled },
  warningCard: {
    backgroundColor: c.warningSurface,
    borderRadius: Radius.lg,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: c.warning,
  },
  warningText: { fontSize: FontSize.small, color: c.warningText, lineHeight: 20 },
  warningCode: { fontFamily: "monospace", backgroundColor: c.warningSurface },
});
