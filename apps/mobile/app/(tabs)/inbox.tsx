import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";
import { useAppStore } from "../../src/store/useAppStore";
import { formatCents } from "../../src/lib/moneyInput";
import type { Transaction } from "@money-shepherd/domain";

export default function InboxScreen() {
  const state = useAppStore((s) => s.state);

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const txById = Object.fromEntries(
    state.transactions.map((tx) => [tx.id, tx]),
  );

  const inboxItems = state.inbox.unassignedTransactionIds
    .map((id) => txById[id])
    .filter((tx): tx is Transaction => tx !== undefined && tx.amount.cents < 0);

  const accounts = state.accounts;

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
        <Text style={styles.title}>Inbox</Text>
        {inboxItems.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{inboxItems.length}</Text>
          </View>
        )}
      </View>

      {inboxItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Inbox is clear.</Text>
          <Text style={styles.emptyHint}>Assigned transactions will no longer appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={inboxItems}
          keyExtractor={(tx) => tx.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isExpense = item.amount.cents < 0;
            const desc = item.description || "Manual transaction";
            const meta = `${accountName(item.accountId)} · ${formatDate(item.postedAt)}`;
            return (
              <Pressable
                style={styles.row}
                onPress={() => {
                  // MS-14.4: navigate to assign flow
                }}
                accessibilityLabel={`Assign ${desc}`}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowDescription} numberOfLines={1}>
                    {desc}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {meta}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text
                    style={[
                      styles.rowAmount,
                      isExpense ? styles.expense : styles.income,
                    ]}
                  >
                    {isExpense ? "-" : "+"}${formatCents(Math.abs(item.amount.cents))}
                  </Text>
                  <Text style={styles.assignHint}>Tap to assign</Text>
                </View>
              </Pressable>
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
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
  },
  title: { fontSize: 24, fontWeight: "700" },
  badge: {
    backgroundColor: "#d94f4f",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: "center",
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 18, fontWeight: "700", color: "#2d9e6b" },
  emptyHint: { fontSize: 14, color: "#888", textAlign: "center" },
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
  rowMeta: { fontSize: 12, color: "#888" },
  rowRight: { alignItems: "flex-end", gap: 2, marginLeft: 12 },
  rowAmount: { fontSize: 16, fontWeight: "600" },
  income: { color: "#2d9e6b" },
  expense: { color: "#d94f4f" },
  assignHint: { fontSize: 11, color: "#aaa" },
});
