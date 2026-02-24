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
import { ScriptureStrip } from "../../src/ui/components/ScriptureStrip";
import { GreetingCard } from "../../src/ui/components/GreetingCard";
import { Card } from "../../src/ui/components/Card";
import { ProgressBar } from "../../src/ui/components/ProgressBar";
import { SectionHeader } from "../../src/ui/components/SectionHeader";
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

  const envelopes = state.budget.envelopes.slice(0, 5);
  const hasMoreEnvelopes = state.budget.envelopes.length > 5;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>Money Shepherd</Text>
        <SyncIndicator />
      </View>

      {/* Greeting + envelope health */}
      <GreetingCard envelopes={state.budget.envelopes} />

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

      {/* Daily scripture */}
      <ScriptureStrip />

      {/* Seed budget nudge — show when accounts exist but budget not yet seeded */}
      {state.accounts.length > 0 &&
        !state.budgetSeeded && (
          <Pressable
            style={styles.seedNudge}
            onPress={() => router.push("/seed-budget")}
            accessibilityLabel="Seed your budget from bank balances"
            accessibilityRole="button"
          >
            <Text style={styles.seedNudgeText}>
              Seed your budget from bank balances
            </Text>
            <Text style={styles.nudgeArrow}>→</Text>
          </Pressable>
        )}

      {/* Unassigned nudge */}
      {unassignedExpenseCount > 0 && (
        <Pressable
          style={styles.nudge}
          onPress={() => router.push("/(tabs)/inbox")}
          accessibilityLabel="Go to inbox to assign transactions"
          accessibilityRole="button"
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
          accessibilityRole="button"
        >
          <Text style={styles.ctaExpenseText}>− Expense</Text>
        </Pressable>
        <Pressable
          style={styles.ctaIncome}
          onPress={() => router.push({ pathname: "/add-transaction", params: { kind: "income" } })}
          accessibilityLabel="Add income"
          accessibilityRole="button"
        >
          <Text style={styles.ctaIncomeText}>+ Income</Text>
        </Pressable>
        <Pressable
          style={styles.ctaAllocate}
          onPress={() => router.push("/allocate")}
          accessibilityLabel="Allocate funds"
          accessibilityRole="button"
        >
          <Text style={styles.ctaAllocateText}>$ Allocate</Text>
        </Pressable>
      </View>

      {/* Envelopes preview */}
      <SectionHeader
        title="Envelopes"
        actionLabel={hasMoreEnvelopes ? "See all" : undefined}
        onAction={hasMoreEnvelopes ? () => router.push("/(tabs)/envelopes") : undefined}
      />

      {envelopes.length === 0 ? (
        <Card style={styles.emptyEnvelopes}>
          <Text style={styles.emptyText}>No envelopes yet.</Text>
          <Pressable
            onPress={() => router.push("/create-envelope")}
            style={styles.emptyEnvelopeBtn}
            accessibilityLabel="Create your first envelope"
            accessibilityRole="button"
          >
            <Text style={styles.emptyEnvelopeBtnText}>Create your first envelope</Text>
          </Pressable>
        </Card>
      ) : (
        <Card>
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
                accessibilityRole="button"
              >
                <View style={styles.envelopeRowContent}>
                  <View style={styles.envelopeRowTop}>
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
                  </View>
                  <ProgressBar balance={env.balance.cents} goal={env.goal?.cents} />
                </View>
              </Pressable>
            );
          })}
        </Card>
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
  appName: { fontSize: FontSize.small, fontWeight: FontWeight.semibold, color: Color.primary, textTransform: "uppercase" as const, letterSpacing: 1 },

  // Hero card
  heroCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    backgroundColor: Color.primary,
    borderRadius: Radius.hero,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  heroLabel: { fontSize: FontSize.small, color: "rgba(255,255,255,0.75)", fontWeight: FontWeight.semibold, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  heroAmount: { fontSize: FontSize.hero, fontWeight: FontWeight.extrabold, color: Color.textOnColor, marginTop: Spacing.xs },
  heroAmountNegative: { color: Color.heroNegative },
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

  // Seed nudge
  seedNudge: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Color.primarySurface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Color.primary,
  },
  seedNudgeText: { fontSize: 14, fontWeight: FontWeight.medium, color: Color.primaryDark, flex: 1 },

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
  nudgeText: { fontSize: 14, fontWeight: FontWeight.medium, color: Color.nudgeText },
  nudgeArrow: { fontSize: FontSize.subtitle, color: Color.nudgeText },

  // Quick actions
  ctaRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.lg,
  },
  ctaExpense: {
    flex: 1,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Color.error,
    backgroundColor: Color.errorSurface,
  },
  ctaExpenseText: { color: Color.error, fontWeight: FontWeight.bold, fontSize: FontSize.body },
  ctaIncome: {
    flex: 1,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Color.success,
    backgroundColor: Color.successSurface,
  },
  ctaIncomeText: { color: Color.success, fontWeight: FontWeight.bold, fontSize: FontSize.body },
  ctaAllocate: {
    flex: 1,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.primary,
  },
  ctaAllocateText: { color: Color.textOnColor, fontWeight: FontWeight.bold, fontSize: FontSize.body },

  // Envelopes
  emptyEnvelopes: {
    padding: Spacing.lg,
    backgroundColor: Color.surfaceLight,
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyText: { fontSize: FontSize.body, color: Color.textMuted, textAlign: "center" },
  emptyEnvelopeBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Color.primary,
  },
  emptyEnvelopeBtnText: { color: Color.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },
  envelopeRow: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
    backgroundColor: Color.surface,
  },
  envelopeRowContent: { gap: Spacing.sm },
  envelopeRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  envelopeName: { fontSize: FontSize.body, fontWeight: FontWeight.medium, color: Color.textDark, flex: 1 },
  envelopeBalance: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Color.success, marginLeft: Spacing.md },
  envelopeBalanceNegative: { color: Color.error },
});
