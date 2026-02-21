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
import { requestLinkToken, openPlaidLink, exchangePublicToken } from "../../src/infra/plaid/plaidClient";
import {
  savePlaidToken,
  loadPlaidToken,
  clearPlaidToken,
  type PlaidTokenData,
} from "../../src/infra/local/secureTokens";

type UserEntry = {
  id: string;
  label: string;
};

const USERS: UserEntry[] = [
  { id: "user-los", label: "Los" },
  { id: "user-jackia", label: "Jackia" },
];

export default function ConnectAccountsScreen() {
  const [meta, setMeta] = React.useState<SyncMeta | null>(null);
  const [connecting, setConnecting] = React.useState<string | null>(null);
  const [tokens, setTokens] = React.useState<Record<string, PlaidTokenData | null>>({});

  React.useEffect(() => {
    loadSyncMeta().then(setMeta);
    loadAllTokens();
  }, []);

  async function loadAllTokens() {
    const entries: Record<string, PlaidTokenData | null> = {};
    for (const user of USERS) {
      entries[user.id] = await loadPlaidToken(user.id);
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
            await savePlaidToken(userId, { accessToken, itemId, institutionName });
            setTokens((prev) => ({
              ...prev,
              [userId]: { accessToken, itemId, institutionName },
            }));
            Alert.alert("Bank connected!", `${institutionName} was linked successfully.`);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Token exchange failed.";
            Alert.alert("Exchange error", message);
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
      const message = err instanceof Error ? err.message : "Unable to start bank connection.";
      Alert.alert("Error", message);
    }
  }

  async function handleDisconnect(userId: string) {
    Alert.alert(
      "Disconnect bank?",
      "This will remove the stored connection. You can reconnect later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            await clearPlaidToken(userId);
            setTokens((prev) => ({ ...prev, [userId]: null }));
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

      {USERS.map((user) => {
        const isCurrentUser = meta?.userId === user.id;
        const tokenData = tokens[user.id] ?? null;
        return (
          <UserCard
            key={user.id}
            user={user}
            isCurrentUser={isCurrentUser}
            isConnecting={connecting === user.id}
            tokenData={tokenData}
            onConnect={() => handleConnect(user.id)}
            onDisconnect={() => handleDisconnect(user.id)}
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
  tokenData,
  onConnect,
  onDisconnect,
}: {
  user: UserEntry;
  isCurrentUser: boolean;
  isConnecting: boolean;
  tokenData: PlaidTokenData | null;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const connected = tokenData !== null;
  const disabled = !plaidConfigured || isConnecting;

  return (
    <View style={[styles.card, isCurrentUser && styles.cardActive]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.userName}>{user.label}</Text>
          {isCurrentUser && (
            <Text style={styles.currentBadge}>This device</Text>
          )}
          {connected && (
            <Text style={styles.institutionLabel}>{tokenData.institutionName}</Text>
          )}
        </View>
        <StatusPill connected={connected} />
      </View>

      <View style={styles.divider} />

      {connected ? (
        <Pressable
          style={({ pressed }) => [
            styles.disconnectBtn,
            pressed && styles.disconnectBtnPressed,
          ]}
          onPress={onDisconnect}
        >
          <Text style={styles.disconnectBtnText}>Disconnect</Text>
        </Pressable>
      ) : (
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
            <ActivityIndicator color="#aaa" size="small" />
          ) : (
            <Text
              style={[
                styles.connectBtnText,
                disabled && styles.connectBtnTextDisabled,
              ]}
            >
              Connect Bank
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

function StatusPill({ connected }: { connected: boolean }) {
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

const PRIMARY = "#1a1a2e";
const ACCENT = "#4f8ef7";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f7f7f9" },
  container: { padding: 20, gap: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 28, fontWeight: "800", color: PRIMARY, marginTop: 8 },
  pageSubtitle: { fontSize: 15, color: "#666", lineHeight: 22, marginBottom: 4 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardActive: {
    borderColor: ACCENT,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  userName: { fontSize: 18, fontWeight: "700", color: PRIMARY },
  currentBadge: {
    fontSize: 12,
    color: ACCENT,
    fontWeight: "600",
    marginTop: 2,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  pillConnected: { backgroundColor: "#e6f9f0" },
  pillEmpty: { backgroundColor: "#f0f0f5" },
  pillText: { fontSize: 12, fontWeight: "600" },
  pillTextConnected: { color: "#1a9e5c" },
  pillTextEmpty: { color: "#999" },
  institutionLabel: {
    fontSize: 13,
    color: "#1a9e5c",
    fontWeight: "500",
    marginTop: 2,
  },
  divider: { height: 1, backgroundColor: "#f0f0f0", marginBottom: 12 },
  connectBtn: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: ACCENT,
  },
  connectBtnPressed: { opacity: 0.7 },
  connectBtnDisabled: { backgroundColor: "#e0e0e8" },
  connectBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  connectBtnTextDisabled: { color: "#aaa" },
  disconnectBtn: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e8",
  },
  disconnectBtnPressed: { opacity: 0.7 },
  disconnectBtnText: { fontSize: 15, fontWeight: "600", color: "#d32f2f" },
  warningCard: {
    backgroundColor: "#fff8e1",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#f5a623",
  },
  warningText: { fontSize: 13, color: "#7a5c00", lineHeight: 20 },
  warningCode: { fontFamily: "monospace", backgroundColor: "#fdefc4" },
});
