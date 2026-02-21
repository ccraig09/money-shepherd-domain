import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { loadSyncMeta, type SyncMeta } from "../../src/infra/local/syncMeta";
import { plaidConfigured } from "../../src/infra/plaid/config";

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

  React.useEffect(() => {
    loadSyncMeta().then(setMeta);
  }, []);

  function handleConnect(userId: string) {
    // MS-15.4 will wire the Plaid Link flow here
    Alert.alert("Coming soon", `Bank connection for ${userId} will be available in the next update.`);
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
        return (
          <UserCard
            key={user.id}
            user={user}
            isCurrentUser={isCurrentUser}
            onConnect={() => handleConnect(user.id)}
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
  onConnect,
}: {
  user: UserEntry;
  isCurrentUser: boolean;
  onConnect: () => void;
}) {
  return (
    <View style={[styles.card, isCurrentUser && styles.cardActive]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.userName}>{user.label}</Text>
          {isCurrentUser && (
            <Text style={styles.currentBadge}>This device</Text>
          )}
        </View>
        <StatusPill connected={false} />
      </View>

      <View style={styles.divider} />

      <Pressable
        style={({ pressed }) => [
          styles.connectBtn,
          pressed && styles.connectBtnPressed,
          !plaidConfigured && styles.connectBtnDisabled,
        ]}
        onPress={onConnect}
        disabled={!plaidConfigured}
      >
        <Text
          style={[
            styles.connectBtnText,
            !plaidConfigured && styles.connectBtnTextDisabled,
          ]}
        >
          Connect Bank
        </Text>
      </Pressable>
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
