import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";
import { formatMoney } from "../../src/lib/moneyFormat";
import { SyncIndicator } from "../../src/ui/components/SyncIndicator";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../../src/ui/tokens";

export default function DashboardScreen() {
  const state = useAppStore((s) => s.state);

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const availableCents = state.budget.availableToAssign.cents;
  const totalEnvelopeCents = state.budget.envelopes.reduce(
    (sum, e) => sum + e.balance.cents,
    0,
  );

  // Unassigned expenses — nudge the user to assign them
  const assignedTxIds = new Set(
    Object.values(state.inbox.assignmentsByTransactionId).map(
      (a) => a.transactionId,
    ),
  );
  const unassignedExpenseCount = state.transactions.filter(
    (tx) => tx.amount.cents < 0 && !assignedTxIds.has(tx.id),
  ).length;

  const envelopes = state.budget.envelopes;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <SyncIndicator />
      </View>

      {/* Available to Assign — hero card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Available to Assign</Text>
        <Text
          style={[
            styles.heroAmount,
            availableCents < 0 && styles.heroAmountNegative,
          ]}
        >
          ${formatMoney(availableCents)}
        </Text>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatLabel}>Total in envelopes</Text>
          <Text style={styles.heroStatValue}>
            ${formatMoney(totalEnvelopeCents)}
          </Text>
        </View>
      </View>

      {/* Unassigned nudge */}
      {unassignedExpenseCount > 0 && (
        <Pressable
          style={styles.nudge}
          onPress={() => router.push("/(tabs)/inbox")}
          accessibilityLabel="Go to inbox to assign transactions"
        >
          <Text style={styles.nudgeText}>
            {unassignedExpenseCount}{" "}
            {unassignedExpenseCount === 1 ? "transaction needs" : "transactions need"} a home
          </Text>
          <Text style={styles.nudgeArrow}>→</Text>
        </Pressable>
      )}

      {/* Quick actions */}
      <View style={styles.ctaRow}>
        <Pressable
          style={styles.ctaExpense}
          onPress={() => router.push({ pathname: "/add-transaction", params: { kind: "expense" } })}
          accessibilityLabel="Add expense"
        >
          <Text style={styles.ctaExpenseText}>− Expense</Text>
        </Pressable>
        <Pressable
          style={styles.ctaIncome}
          onPress={() => router.push({ pathname: "/add-transaction", params: { kind: "income" } })}
          accessibilityLabel="Add income"
        >
          <Text style={styles.ctaIncomeText}>+ Income</Text>
        </Pressable>
      </View>
      <View style={styles.ctaRowSingle}>
        <Pressable
          style={styles.ctaAllocate}
          onPress={() => router.push("/allocate")}
          accessibilityLabel="Allocate funds"
        >
          <Text style={styles.ctaAllocateText}>$ Allocate</Text>
        </Pressable>
      </View>

      {/* Envelopes preview */}
      <Text style={styles.sectionLabel}>Envelopes</Text>

      {envelopes.length === 0 ? (
        <View style={styles.emptyEnvelopes}>
          <Text style={styles.emptyText}>No envelopes yet.</Text>
          <Pressable
            onPress={() => router.push("/create-envelope")}
            style={styles.emptyEnvelopeBtn}
            accessibilityLabel="Create your first envelope"
          >
            <Text style={styles.emptyEnvelopeBtnText}>Create your first envelope</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.envelopeList}>
          {envelopes.map((env) => {
            const isNegative = env.balance.cents < 0;
            return (
              <Pressable
                key={env.id}
                style={styles.envelopeRow}
                onPress={() =>
                  router.push({
                    pathname: "/envelope/[envelopeId]",
                    params: { envelopeId: env.id },
                  })
                }
                accessibilityLabel={`${env.name} envelope`}
              >
                <Text style={styles.envelopeName} numberOfLines={1}>
                  {env.name}
                </Text>
                <Text
                  style={[
                    styles.envelopeBalance,
                    isNegative && styles.envelopeBalanceNegative,
                  ]}
                >
                  ${formatMoney(env.balance.cents)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Color.surface },
  content: { paddingBottom: Spacing.bottomPad },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingTop: 60,
    paddingBottom: Spacing.base,
  },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold, color: Color.textDark },

  // Hero card
  heroCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    backgroundColor: Color.primary,
    borderRadius: Radius.hero,
    paddingVertical: 28,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  heroLabel: { fontSize: FontSize.small, color: "rgba(255,255,255,0.75)", fontWeight: FontWeight.semibold, textTransform: "uppercase", letterSpacing: 0.5 },
  heroAmount: { fontSize: FontSize.hero, fontWeight: FontWeight.extrabold, color: Color.textOnColor, marginTop: Spacing.xs },
  heroAmountNegative: { color: "#ffcdd2" },
  heroStat: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.base,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.3)",
  },
  heroStatLabel: { fontSize: FontSize.small, color: "rgba(255,255,255,0.75)" },
  heroStatValue: { fontSize: FontSize.small, fontWeight: FontWeight.semibold, color: Color.textOnColor },

  // Nudge
  nudge: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Color.warningSurface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Color.borderWarning,
  },
  nudgeText: { fontSize: 14, fontWeight: FontWeight.medium, color: "#795548" },
  nudgeArrow: { fontSize: FontSize.subtitle, color: "#795548" },

  // Quick actions
  ctaRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: Spacing.base,
    marginBottom: 10,
  },
  ctaRowSingle: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.lg,
  },
  ctaExpense: {
    flex: 1,
    borderRadius: Radius.xl,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Color.error,
    backgroundColor: Color.errorSurface,
  },
  ctaExpenseText: { color: Color.error, fontWeight: FontWeight.bold, fontSize: FontSize.body },
  ctaIncome: {
    flex: 1,
    borderRadius: Radius.xl,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Color.success,
    backgroundColor: Color.successSurface,
  },
  ctaIncomeText: { color: Color.success, fontWeight: FontWeight.bold, fontSize: FontSize.body },
  ctaAllocate: {
    borderRadius: Radius.xl,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: Color.primary,
  },
  ctaAllocateText: { color: Color.textOnColor, fontWeight: FontWeight.bold, fontSize: FontSize.body },

  // Section
  sectionLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: Color.textMid,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },

  // Envelopes
  emptyEnvelopes: {
    marginHorizontal: Spacing.base,
    padding: 20,
    borderRadius: Radius.xl,
    backgroundColor: Color.surfaceLight,
    alignItems: "center",
  },
  emptyText: { fontSize: 14, color: Color.textMuted, textAlign: "center" },
  emptyEnvelopeBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Color.primary,
  },
  emptyEnvelopeBtnText: { color: Color.textOnColor, fontWeight: FontWeight.semibold, fontSize: 14 },
  envelopeList: {
    marginHorizontal: Spacing.base,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
    overflow: "hidden",
  },
  envelopeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
    backgroundColor: Color.surface,
  },
  envelopeName: { fontSize: FontSize.body, fontWeight: FontWeight.medium, color: Color.textDark, flex: 1 },
  envelopeBalance: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Color.success, marginLeft: Spacing.md },
  envelopeBalanceNegative: { color: Color.error },
});
