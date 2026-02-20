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

export default function TransactionsScreen() {
  const state = useAppStore((s) => s.state);

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const accounts = state.accounts;
  const transactions = [...state.transactions].sort(
    (a, b) => b.postedAt.localeCompare(a.postedAt),
  );

  function accountName(accountId: string): string {
    return accounts.find((a) => a.id === accountId)?.name ?? accountId;
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <Pressable
          onPress={() => router.push("/add-transaction")}
          style={styles.addBtn}
          accessibilityLabel="Add transaction"
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No transactions yet. Add your first one.
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(tx) => tx.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isExpense = item.amount.cents < 0;
            const desc = item.description || "Manual transaction";
            const meta = `${accountName(item.accountId)} · ${formatDate(item.postedAt)}`;
            return (
              <View style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowDescription} numberOfLines={1}>
                    {desc}
                  </Text>
                  <Text style={styles.rowAccount} numberOfLines={1}>
                    {meta}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.rowAmount,
                    isExpense ? styles.expense : styles.income,
                  ]}
                >
                  {isExpense ? "-" : "+"}${formatCents(Math.abs(item.amount.cents))}
                </Text>
              </View>
            );
          }}
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
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 17, fontWeight: "600", color: "#333", textAlign: "center" },
  list: { paddingVertical: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#eee",
  },
  rowMain: { flex: 1, gap: 2 },
  rowDescription: { fontSize: 15, fontWeight: "500", color: "#111" },
  rowAccount: { fontSize: 12, color: "#888" },
  rowAmount: { fontSize: 16, fontWeight: "600", minWidth: 80, textAlign: "right" },
  income: { color: "#2d9e6b" },
  expense: { color: "#d94f4f" },
});
