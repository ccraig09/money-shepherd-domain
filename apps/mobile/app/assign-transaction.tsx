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
import { formatMoney } from "../src/lib/moneyFormat";
import { Card } from "../src/ui/components/Card";
import { SectionHeader } from "../src/ui/components/SectionHeader";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../src/ui/tokens";

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
        <ActivityIndicator color={Color.primary} />
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

    // Stale data guard: verify tx and envelope still exist
    const currentState = useAppStore.getState().state;
    if (currentState) {
      const txStillExists = currentState.transactions.some((t) => t.id === transactionId);
      const envStillExists = currentState.budget.envelopes.some((e) => e.id === selectedEnvelopeId);
      if (!txStillExists || !envStillExists) {
        useAppStore.getState().showToast("Data changed — please go back and try again.", "error");
        router.back();
        return;
      }
    }

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
          {isExpense ? "-" : "+"}${formatMoney(Math.abs(tx.amount.cents))}
        </Text>
      </View>

      <SectionHeader title="Assign to…" />

      {envelopes.length === 0 ? (
        <Card style={styles.noEnvelopes}>
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
        </Card>
      ) : (
        <FlatList
          data={envelopes}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedEnvelopeId;
            const resultingCents = item.balance.cents + tx.amount.cents;
            const wouldOverspend = isSelected && isExpense && resultingCents < 0;
            return (
              <View>
                <Pressable
                  style={[styles.envelopeRow, isSelected && styles.envelopeRowSelected]}
                  onPress={() => setSelectedEnvelopeId(item.id)}
                  accessibilityLabel={`Select ${item.name}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.envelopeName, isSelected && styles.envelopeNameSelected]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.envelopeBalance, isSelected && styles.envelopeBalanceSelected]}>
                    ${formatMoney(item.balance.cents)}
                  </Text>
                </Pressable>
                {wouldOverspend && (
                  <View style={styles.overspendWarning}>
                    <Text style={styles.overspendText}>
                      This will overspend {item.name} by ${formatMoney(Math.abs(resultingCents))}
                    </Text>
                  </View>
                )}
              </View>
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
  root: { flex: 1, backgroundColor: Color.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: FontSize.body, color: Color.error },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.border,
    backgroundColor: Color.surfaceLight,
  },
  summaryDesc: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Color.textDark, flex: 1 },
  summaryAmount: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, marginLeft: Spacing.md },
  income: { color: Color.success },
  expense: { color: Color.error },
  list: { paddingBottom: Spacing.base },
  envelopeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
  },
  envelopeRowSelected: {
    backgroundColor: Color.primarySurface,
  },
  envelopeName: { fontSize: FontSize.subtitle, fontWeight: FontWeight.medium, color: Color.textDark },
  envelopeNameSelected: { color: Color.primary, fontWeight: FontWeight.bold },
  envelopeBalance: { fontSize: FontSize.body, color: Color.textMuted },
  envelopeBalanceSelected: { color: Color.primary },
  noEnvelopes: {
    padding: Spacing.lg,
    alignItems: "center",
    backgroundColor: Color.surfaceLight,
    gap: Spacing.base,
  },
  noEnvelopesText: { fontSize: FontSize.subtitle, color: Color.textMid },
  createBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Color.primary,
  },
  createBtnText: { color: Color.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },
  footer: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
    gap: Spacing.sm,
  },
  assignBtn: {
    backgroundColor: Color.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  assignBtnDisabled: { opacity: 0.4 },
  assignBtnText: { color: Color.textOnColor, fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  cancelBtn: { alignItems: "center", paddingVertical: Spacing.sm },
  cancelText: { fontSize: FontSize.body, color: Color.textMuted },
  overspendWarning: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    backgroundColor: Color.warningSurface,
  },
  overspendText: { fontSize: FontSize.small, color: Color.warning, fontWeight: FontWeight.medium },
});
