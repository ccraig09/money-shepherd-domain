import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";
import { formatCents } from "../../src/lib/moneyInput";

export default function EnvelopesScreen() {
  const state = useAppStore((s) => s.state);

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const envelopes = state.budget.envelopes;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Envelopes</Text>
        <Pressable
          onPress={() => router.push("/create-envelope")}
          style={styles.addBtn}
          accessibilityLabel="Create envelope"
        >
          <Text style={styles.addBtnText}>+ New</Text>
        </Pressable>
      </View>

      {envelopes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No envelopes yet.</Text>
          <Pressable
            onPress={() => router.push("/create-envelope")}
            style={styles.emptyBtn}
            accessibilityLabel="Create your first envelope"
          >
            <Text style={styles.emptyBtnText}>Create Envelope</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={envelopes}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => {
                // MS-14.8: envelope detail — wired in a future ticket
              }}
              accessibilityLabel={`${item.name} envelope`}
            >
              <Text style={styles.rowName} numberOfLines={1}>
                {item.name || "Unnamed envelope"}
              </Text>
              <Text style={styles.rowBalance}>
                ${formatCents(item.balance.cents)}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
  },
  title: { fontSize: 24, fontWeight: "700" },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#4f8ef7",
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 17, fontWeight: "600", color: "#333" },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#4f8ef7",
  },
  emptyBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  list: { paddingVertical: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#eee",
  },
  rowName: { fontSize: 16, fontWeight: "500", color: "#111", flex: 1 },
  rowBalance: { fontSize: 16, fontWeight: "600", color: "#333", marginLeft: 12 },
});
