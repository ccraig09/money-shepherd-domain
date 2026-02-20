import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";
import { formatCents } from "../../src/lib/moneyInput";
import type { Transaction } from "@money-shepherd/domain";

export default function EnvelopeDetailScreen() {
  const { envelopeId } = useLocalSearchParams<{ envelopeId: string }>();
  const state = useAppStore((s) => s.state);

  if (!state || !envelopeId) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const envelope = state.budget.envelopes.find((e) => e.id === envelopeId);

  if (!envelope) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Envelope not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // Derive transactions assigned to this envelope
  const assignments = Object.values(state.inbox.assignmentsByTransactionId);
  const assignmentByTxId = Object.fromEntries(
    assignments.map((a) => [a.transactionId, a]),
  );
  const assignedTxIds = new Set(
    assignments
      .filter((a) => a.envelopeId === envelopeId)
      .map((a) => a.transactionId),
  );

  const txById = Object.fromEntries(
    state.transactions.map((tx) => [tx.id, tx]),
  );

  const assignedTxs = Array.from(assignedTxIds)
    .map((id) => txById[id])
    .filter((tx): tx is Transaction => tx !== undefined)
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt));

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
      <Stack.Screen options={{ title: envelope.name }} />
      {/* Envelope summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.envelopeName} numberOfLines={1}>
          {envelope.name}
        </Text>
        <Text style={styles.balanceLabel}>Balance</Text>
        <Text style={styles.balance}>
          ${formatCents(envelope.balance.cents)}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Assigned Transactions</Text>

      {assignedTxs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No transactions assigned yet.</Text>
        </View>
      ) : (
        <FlatList
          data={assignedTxs}
          keyExtractor={(tx) => tx.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isExpense = item.amount.cents < 0;
            const desc = item.description || "Manual transaction";
            const assignedByUserId = assignmentByTxId[item.id]?.assignedByUserId;
            const assignedByName = assignedByUserId
              ? (state.users?.find((u) => u.id === assignedByUserId)?.displayName ?? null)
              : null;
            const meta = `${accountName(item.accountId)} · ${formatDate(item.postedAt)}${assignedByName ? ` · by ${assignedByName}` : ""}`;
            return (
              <View style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowDescription} numberOfLines={1}>
                    {desc}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorText: { fontSize: 15, color: "#d94f4f" },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  backBtnText: { fontSize: 14, color: "#555" },
  summaryCard: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#eee",
    backgroundColor: "#f9f9f9",
    gap: 4,
  },
  envelopeName: { fontSize: 22, fontWeight: "700", color: "#111" },
  balanceLabel: { fontSize: 13, color: "#888", marginTop: 4 },
  balance: { fontSize: 32, fontWeight: "800", color: "#2d9e6b" },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { fontSize: 15, color: "#888" },
  list: { paddingBottom: 24 },
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
  rowAmount: { fontSize: 16, fontWeight: "600", marginLeft: 12 },
  income: { color: "#2d9e6b" },
  expense: { color: "#d94f4f" },
});
