import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { loadSyncMeta, type SyncMeta } from "../../src/infra/local/syncMeta";
import { plaidConfigured } from "../../src/infra/plaid/config";
import { requestLinkToken, openPlaidLink, exchangePublicToken, fetchAccounts } from "../../src/infra/plaid/plaidClient";
import {
  addPlaidToken,
  loadPlaidTokens,
  removePlaidToken,
  type PlaidTokenData,
} from "../../src/infra/local/secureTokens";
import { mapPlaidAccounts } from "../../src/infra/plaid/mapAccounts";
import { classifyPlaidError } from "../../src/infra/plaid/errors";
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

  const styles = useThemedStyles(createStyles);

  React.useEffect(() => {
    loadSyncMeta().then(setMeta);
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
            const { accounts: mergedAccounts, accountIdMap } = mapPlaidAccounts(plaidAccounts, userId, currentState.accounts);
            await addPlaidToken(userId, { accessToken, itemId, institutionName, accountIdMap });
            await engine.importPlaidAccounts({ newAccounts: mergedAccounts });

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

  async function handleDisconnect(userId: string, itemId: string, institutionName: string) {
    Alert.alert(
      `Disconnect ${institutionName}?`,
      "This will remove the stored connection. You can reconnect later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            await removePlaidToken(userId, itemId);
            const updated = await loadPlaidTokens(userId);
            setTokens((prev) => ({ ...prev, [userId]: updated }));
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
          return (
            <UserCard
              key={user.id}
              user={user}
              isCurrentUser={isCurrentUser}
              isConnecting={connecting === user.id}
              connectedBanks={userTokens}
              onConnect={() => handleConnect(user.id)}
              onDisconnect={(itemId, name) => handleDisconnect(user.id, itemId, name)}
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
  isCurrentUser,
  isConnecting,
  connectedBanks,
  onConnect,
  onDisconnect,
}: {
  user: UserEntry;
  isCurrentUser: boolean;
  isConnecting: boolean;
  connectedBanks: PlaidTokenData[];
  onConnect: () => void;
  onDisconnect: (itemId: string, institutionName: string) => void;
}) {
  const hasConnections = connectedBanks.length > 0;
  const disabled = !plaidConfigured || isConnecting;
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  return (
    <View style={[styles.card, isCurrentUser && styles.cardActive]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.userName}>
            {user.label}{isCurrentUser ? " (You)" : ""}
          </Text>
          {isCurrentUser && (
            <Text style={styles.currentBadge}>This device</Text>
          )}
          {!isCurrentUser && !hasConnections && (
            <Text style={styles.partnerHint}>
              {user.label} can connect from their device, or log in here
            </Text>
          )}
        </View>
        <StatusPill connected={hasConnections} />
      </View>

      {hasConnections && (
        <View style={styles.bankList}>
          {connectedBanks.map((bank) => (
            <View key={bank.itemId} style={styles.bankRow}>
              <Text style={styles.institutionLabel}>{bank.institutionName}</Text>
              <Pressable
                onPress={() => onDisconnect(bank.itemId, bank.institutionName)}
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
          isCurrentUser ? styles.connectBtn : styles.connectBtnSecondary,
          pressed && styles.connectBtnPressed,
          disabled && styles.connectBtnDisabled,
        ]}
        onPress={onConnect}
        disabled={disabled}
      >
        {isConnecting ? (
          <ActivityIndicator color={isCurrentUser ? colors.textDisabled : colors.primary} size="small" />
        ) : (
          <Text
            style={[
              isCurrentUser ? styles.connectBtnText : styles.connectBtnTextSecondary,
              disabled && styles.connectBtnTextDisabled,
            ]}
          >
            {hasConnections ? "Add Another Bank" : `Connect ${isCurrentUser ? "Your" : user.label + "'s"} Bank`}
          </Text>
        )}
      </Pressable>
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
