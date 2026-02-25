import React, { useMemo } from "react";
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
import { AccountsCard } from "../../src/ui/components/AccountsCard";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../../src/ui/tokens";
import { getThisMonthSummary } from "../../src/lib/periodSummary";
import { getCurrentPeriod, getFundingInPeriod, getSpendingInPeriod } from "@money-shepherd/domain";

export default function DashboardScreen() {
  const state = useAppStore((s) => s.state);

  const totalEnvelopeCents = useMemo(
    () => state?.budget.envelopes.reduce((sum, e) => sum + e.balance.cents, 0) ?? 0,
    [state],
  );

  // Unassigned expenses — nudge the user to assign them
  const unassignedExpenseCount = useMemo(() => {
    if (!state) return 0;
    const assignedTxIds = new Set(
      Object.values(state.inbox.assignmentsByTransactionId).map(
        (a) => a.transactionId,
      ),
    );
    return state.transactions.filter(
      (tx) => tx.amount.cents < 0 && !assignedTxIds.has(tx.id),
    ).length;
  }, [state]);

  const monthSummary = useMemo(() => {
    if (!state) return null;
    const now = new Date().toISOString().slice(0, 10);
    return getThisMonthSummary(
      state.transactions,
      state.inbox.assignmentsByTransactionId,
      state.budget.envelopes,
      now,
    );
  }, [state]);

  const hasUnfilledGoals = useMemo(() => {
    if (!state) return false;
    if (state.budget.availableToAssign.cents <= 0) return false;
    const period = getCurrentPeriod(new Date().toISOString());
    return state.budget.envelopes.some((env) => {
      if (!env.goal || env.goal.cents <= 0) return false;
      const funded = getFundingInPeriod(state.allocations ?? [], env.id, period).cents;
      return funded < env.goal.cents;
    });
  }, [state]);

  const givingThisMonthCents = useMemo(() => {
    if (!state) return 0;
    const givingEnvelopes = state.budget.envelopes.filter((e) => e.type === "giving");
    if (givingEnvelopes.length === 0) return 0;
    const period = getCurrentPeriod(new Date().toISOString());
    const assignments = Object.values(state.inbox.assignmentsByTransactionId);
    return givingEnvelopes.reduce((sum, env) => {
      return sum + getSpendingInPeriod(state.transactions, assignments, env.id, period).cents;
    }, 0);
  }, [state]);

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const availableCents = state.budget.availableToAssign.cents;

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

      {/* This Month summary */}
      {monthSummary && (monthSummary.incomeCents > 0 || monthSummary.spendingCents > 0) && (
        <Card style={styles.monthCard}>
          <Text style={styles.monthTitle}>This Month</Text>
          <View style={styles.monthRow}>
            <View style={styles.monthStat}>
              <Text style={styles.monthStatLabel}>Income</Text>
              <Text style={[styles.monthStatValue, styles.monthIncome]}>
                +${formatMoney(monthSummary.incomeCents)}
              </Text>
            </View>
            <View style={styles.monthStat}>
              <Text style={styles.monthStatLabel}>Spending</Text>
              <Text style={[styles.monthStatValue, styles.monthSpending]}>
                -${formatMoney(monthSummary.spendingCents)}
              </Text>
            </View>
            <View style={styles.monthStat}>
              <Text style={styles.monthStatLabel}>Net</Text>
              <Text
                style={[
                  styles.monthStatValue,
                  monthSummary.netCents >= 0 ? styles.monthIncome : styles.monthSpending,
                ]}
              >
                {monthSummary.netCents >= 0 ? "+" : "-"}${formatMoney(Math.abs(monthSummary.netCents))}
              </Text>
            </View>
          </View>
          {givingThisMonthCents > 0 && (
            <View style={styles.givingRow}>
              <Text style={styles.givingRowLabel}>Giving this month</Text>
              <Text style={styles.givingRowValue}>${formatMoney(givingThisMonthCents)}</Text>
            </View>
          )}
        </Card>
      )}

      {/* Seed budget nudge — show when not yet seeded, or when new accounts need seeding */}
      {state.accounts.length > 0 &&
        (() => {
          if (!state.budgetSeeded) return true;
          const seeded = state.seededAccountIds;
          if (!seeded) return false;
          const seededSet = new Set(seeded);
          return state.accounts
            .filter((a) => !a.accountType || a.accountType === "depository")
            .some((a) => !seededSet.has(a.id));
        })() && (
          <Pressable
            style={styles.seedNudge}
            onPress={() => router.push("/seed-budget")}
            accessibilityLabel={state.budgetSeeded ? "Add new account balances to budget" : "Seed your budget from bank balances"}
            accessibilityRole="button"
          >
            <Text style={styles.seedNudgeText}>
              {state.budgetSeeded
                ? "New accounts — add balances to budget"
                : "Seed your budget from bank balances"}
            </Text>
            <Text style={styles.nudgeArrow}>→</Text>
          </Pressable>
        )}

      {/* Fill envelopes nudge */}
      {hasUnfilledGoals && (
        <Pressable
          style={styles.fillNudge}
          onPress={() => router.push("/fill-envelopes")}
          accessibilityLabel="Fill your envelopes from available funds"
          accessibilityRole="button"
        >
          <Text style={styles.fillNudgeText}>Ready to fill your envelopes?</Text>
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

      {/* Accounts overview */}
      {state.accounts.length > 0 && (
        <View style={styles.accountsSection}>
          <AccountsCard accounts={state.accounts} />
        </View>
      )}

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
                    <View style={styles.envelopeNameRow}>
                      <Text style={styles.envelopeName} numberOfLines={1}>
                        {env.name}
                      </Text>
                      {env.type === "giving" && (
                        <View style={styles.givingBadge} accessibilityLabel="Giving envelope">
                          <Text style={styles.givingBadgeText}>GIVING</Text>
                        </View>
                      )}
                      {isNegative && (
                        <View style={styles.overspentBadge} accessibilityLabel="Overspent">
                          <Text style={styles.overspentBadgeText}>OVERSPENT</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.envelopeBalance,
                        isNegative && styles.envelopeBalanceNegative,
                      ]}
                    >
                      ${formatMoney(env.balance.cents)}
                    </Text>
                  </View>
                  {monthSummary && (monthSummary.spentByEnvelope[env.id] ?? 0) > 0 && (
                    <Text style={styles.envelopeSpentMonth}>
                      ${formatMoney(monthSummary.spentByEnvelope[env.id])} spent this month
                    </Text>
                  )}
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

  // This Month card
  monthCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    padding: Spacing.base,
  },
  monthTitle: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: Color.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  monthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  monthStat: { alignItems: "center", flex: 1 },
  monthStatLabel: { fontSize: FontSize.caption, color: Color.textMuted, marginBottom: Spacing.xs },
  monthStatValue: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  monthIncome: { color: Color.success },
  monthSpending: { color: Color.error },

  // Giving row in This Month card
  givingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
  },
  givingRowLabel: { fontSize: FontSize.small, color: Color.giving, fontWeight: FontWeight.semibold },
  givingRowValue: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Color.giving },

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

  // Fill nudge
  fillNudge: {
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
  fillNudgeText: { fontSize: 14, fontWeight: FontWeight.medium, color: Color.primaryDark, flex: 1 },

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

  // Accounts
  accountsSection: { marginBottom: Spacing.lg },

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
  envelopeNameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, flex: 1 },
  envelopeName: { fontSize: FontSize.body, fontWeight: FontWeight.medium, color: Color.textDark, flexShrink: 1 },
  overspentBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    backgroundColor: Color.errorSurface,
  },
  overspentBadgeText: { fontSize: 9, fontWeight: FontWeight.bold, color: Color.error, letterSpacing: 0.5 },
  givingBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    backgroundColor: Color.givingSurface,
  },
  givingBadgeText: { fontSize: 9, fontWeight: FontWeight.bold, color: Color.giving, letterSpacing: 0.5 },
  envelopeSpentMonth: { fontSize: FontSize.caption, color: Color.textMuted },
  envelopeBalance: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Color.success, marginLeft: Spacing.md },
  envelopeBalanceNegative: { color: Color.error },
});
