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
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../src/ui/tokens";
import { useThemedStyles, useTheme } from "@/src/ui/ThemeProvider";

export default function AssignTransactionScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  const { transactionId, suggestedEnvelopeId } = useLocalSearchParams<{
    transactionId: string;
    suggestedEnvelopeId?: string;
  }>();
  const state = useAppStore((s) => s.state);
  const assignTransaction = useAppStore((s) => s.assignTransaction);

  const [userId, setUserId] = React.useState<string>("user-los");
  const [selectedEnvelopeId, setSelectedEnvelopeId] = React.useState<string | null>(
    suggestedEnvelopeId ?? null,
  );
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    loadSyncMeta().then((meta) => {
      if (meta?.userId) setUserId(meta.userId);
    });
  }, []);

  if (!state || !transactionId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
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

const createStyles = (c: ColorTokens) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: FontSize.body, color: c.error },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surfaceLight,
  },
  summaryDesc: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: c.textDark, flex: 1 },
  summaryAmount: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, marginLeft: Spacing.md },
  income: { color: c.success },
  expense: { color: c.error },
  list: { paddingBottom: Spacing.base },
  envelopeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
  },
  envelopeRowSelected: {
    backgroundColor: c.primarySurface,
  },
  envelopeName: { fontSize: FontSize.subtitle, fontWeight: FontWeight.medium, color: c.textDark },
  envelopeNameSelected: { color: c.primary, fontWeight: FontWeight.bold },
  envelopeBalance: { fontSize: FontSize.body, color: c.textMuted },
  envelopeBalanceSelected: { color: c.primary },
  noEnvelopes: {
    padding: Spacing.lg,
    alignItems: "center",
    backgroundColor: c.surfaceLight,
    gap: Spacing.base,
  },
  noEnvelopesText: { fontSize: FontSize.subtitle, color: c.textMid },
  createBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: c.primary,
  },
  createBtnText: { color: c.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },
  footer: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
    gap: Spacing.sm,
  },
  assignBtn: {
    backgroundColor: c.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  assignBtnDisabled: { opacity: 0.4 },
  assignBtnText: { color: c.textOnColor, fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  cancelBtn: { alignItems: "center", paddingVertical: Spacing.sm },
  cancelText: { fontSize: FontSize.body, color: c.textMuted },
  overspendWarning: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    backgroundColor: c.warningSurface,
  },
  overspendText: { fontSize: FontSize.small, color: c.warning, fontWeight: FontWeight.medium },
});
