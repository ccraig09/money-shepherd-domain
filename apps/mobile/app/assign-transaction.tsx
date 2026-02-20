import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAppStore } from "../src/store/useAppStore";
import { loadSyncMeta } from "../src/infra/local/syncMeta";
import { formatCents } from "../src/lib/moneyInput";

export default function AssignTransactionScreen() {
  const { transactionId } = useLocalSearchParams<{ transactionId: string }>();
  const state = useAppStore((s) => s.state);
  const assignTransaction = useAppStore((s) => s.assignTransaction);

  const [userId, setUserId] = React.useState<string>("user-los");
  const [selectedEnvelopeId, setSelectedEnvelopeId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    loadSyncMeta().then((meta) => {
      if (meta?.userId) setUserId(meta.userId);
    });
  }, []);

  if (!state || !transactionId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const tx = state.transactions.find((t) => t.id === transactionId);
  const envelopes = state.budget.envelopes;

  if (!tx) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Transaction not found.</Text>
      </View>
    );
  }

  const isExpense = tx.amount.cents < 0;
  const desc = tx.description || "Manual transaction";

  async function handleAssign() {
    if (!selectedEnvelopeId || !transactionId) return;
    setSaving(true);
    try {
      await assignTransaction({
        transactionId,
        envelopeId: selectedEnvelopeId,
        assignedByUserId: userId,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      {/* Transaction summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryDesc} numberOfLines={1}>{desc}</Text>
        <Text style={[styles.summaryAmount, isExpense ? styles.expense : styles.income]}>
          {isExpense ? "-" : "+"}${formatCents(Math.abs(tx.amount.cents))}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Choose an envelope</Text>

      {envelopes.length === 0 ? (
        <View style={styles.noEnvelopes}>
          <Text style={styles.noEnvelopesText}>No envelopes yet.</Text>
          <Pressable
            onPress={() => {
              router.back();
              router.push("/create-envelope");
            }}
            style={styles.createBtn}
            accessibilityLabel="Create an envelope first"
          >
            <Text style={styles.createBtnText}>Create an envelope first</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={envelopes}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedEnvelopeId;
            return (
              <Pressable
                style={[styles.envelopeRow, isSelected && styles.envelopeRowSelected]}
                onPress={() => setSelectedEnvelopeId(item.id)}
                accessibilityLabel={`Select ${item.name}`}
              >
                <Text style={[styles.envelopeName, isSelected && styles.envelopeNameSelected]}>
                  {item.name}
                </Text>
                <Text style={[styles.envelopeBalance, isSelected && styles.envelopeBalanceSelected]}>
                  ${formatCents(item.balance.cents)}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      {envelopes.length > 0 && (
        <View style={styles.footer}>
          <Pressable
            onPress={handleAssign}
            disabled={!selectedEnvelopeId || saving}
            style={[
              styles.assignBtn,
              (!selectedEnvelopeId || saving) && styles.assignBtnDisabled,
            ]}
            accessibilityLabel="Confirm assignment"
          >
            <Text style={styles.assignBtnText}>
              {saving ? "Assigning…" : "Assign"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            style={styles.cancelBtn}
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 15, color: "#d94f4f" },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
    backgroundColor: "#f9f9f9",
  },
  summaryDesc: { fontSize: 15, fontWeight: "600", color: "#111", flex: 1 },
  summaryAmount: { fontSize: 16, fontWeight: "700", marginLeft: 12 },
  income: { color: "#2d9e6b" },
  expense: { color: "#d94f4f" },
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
  list: { paddingBottom: 16 },
  envelopeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#eee",
  },
  envelopeRowSelected: {
    backgroundColor: "#edf3fe",
  },
  envelopeName: { fontSize: 16, fontWeight: "500", color: "#111" },
  envelopeNameSelected: { color: "#4f8ef7", fontWeight: "700" },
  envelopeBalance: { fontSize: 14, color: "#888" },
  envelopeBalanceSelected: { color: "#4f8ef7" },
  noEnvelopes: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 32,
  },
  noEnvelopesText: { fontSize: 16, color: "#555" },
  createBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#4f8ef7",
  },
  createBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "#eee",
    gap: 8,
  },
  assignBtn: {
    backgroundColor: "#4f8ef7",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  assignBtnDisabled: { opacity: 0.4 },
  assignBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelText: { fontSize: 15, color: "#888" },
});
