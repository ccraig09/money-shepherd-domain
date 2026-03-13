import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";
import { formatMoney } from "../../src/lib/moneyFormat";
import { SyncIndicator } from "../../src/ui/components/SyncIndicator";
import { ScriptureStrip } from "../../src/ui/components/ScriptureStrip";
import { GreetingCard } from "../../src/ui/components/GreetingCard";
import { Card } from "../../src/ui/components/Card";
import { AccountsCard } from "../../src/ui/components/AccountsCard";
import { InsightCard } from "../../src/ui/components/InsightCard";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../../src/ui/tokens";
import { useTheme, useThemedStyles } from "@/src/ui/ThemeProvider";
import { getThisMonthSummary } from "../../src/lib/periodSummary";
import { getCurrentPeriod, getFundingInPeriod, getSpendingInPeriod, generateInsights } from "@money-shepherd/domain";
import type { InsightType } from "@money-shepherd/domain";

const SEVERITY_PRIORITY: Record<string, number> = { warning: 0, info: 1, success: 2 };

export default function DashboardScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const state = useAppStore((s) => s.state);
  const lastAiTip = useAppStore((s) => s.lastAiTip);

  const totalEnvelopeCents = useMemo(
    () => state?.budget.envelopes.reduce((sum, e) => sum + e.balance.cents, 0) ?? 0,
    [state],
  );

  const totalAccountCents = useMemo(
    () => state?.accounts.reduce((sum, a) => sum + a.balance.cents, 0) ?? 0,
    [state],
  );

  const [ataModalVisible, setAtaModalVisible] = useState(false);

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
      const funded = getFundingInPeriod(state.allocations ?? [], env.id, period).cents || 0;
      return funded < env.goal.cents;
    });
  }, [state]);

  const debtSummary = useMemo(() => {
    if (!state) return null;
    const debts = state.budget.envelopes.filter((e) => e.type === "debt");
    if (debts.length === 0) return null;
    const totalDebt = debts.reduce((sum, e) => sum + (e.target?.cents ?? 0), 0);
    const totalSetAside = debts.reduce((sum, e) => sum + e.balance.cents, 0);
    return { count: debts.length, totalDebt, totalSetAside };
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

  // Insights engine
  const [dismissedTypes, setDismissedTypes] = useState<Set<InsightType>>(new Set());

  const topInsight = useMemo(() => {
    if (!state) return null;
    const assignedTxIds = new Set(
      Object.values(state.inbox.assignmentsByTransactionId).map((a) => a.transactionId),
    );
    const now = new Date().toISOString().slice(0, 10);
    const all = generateInsights({
      envelopes: state.budget.envelopes,
      transactions: state.transactions,
      assignedTransactionIds: assignedTxIds,
      availableToAssignCents: state.budget.availableToAssign.cents,
      now,
      aiTip: lastAiTip ?? undefined,
    });
    const visible = all.filter((i) => !dismissedTypes.has(i.type));
    visible.sort((a, b) => (SEVERITY_PRIORITY[a.severity] ?? 9) - (SEVERITY_PRIORITY[b.severity] ?? 9));
    return visible[0] ?? null;
  }, [state, dismissedTypes, lastAiTip]);

  const dismissInsight = useCallback(() => {
    if (!topInsight) return;
    setDismissedTypes((prev) => new Set(prev).add(topInsight.type));
  }, [topInsight]);

  const [refreshing, setRefreshing] = useState(false);
  const refreshFromPlaid = useAppStore((s) => s.refreshFromPlaid);
  const syncNow = useAppStore((s) => s.syncNow);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshFromPlaid({ force: true }), syncNow()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshFromPlaid, syncNow]);

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const availableCents = state.budget.availableToAssign.cents;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
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
        <View style={styles.heroLabelRow}>
          <Text style={styles.heroLabel}>Available to Assign</Text>
          <Pressable
            onPress={() => setAtaModalVisible(true)}
            hitSlop={8}
            accessibilityLabel="How is this calculated?"
            accessibilityRole="button"
          >
            <View style={styles.helpIcon}>
              <Text style={styles.helpIconText}>?</Text>
            </View>
          </Pressable>
        </View>
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

      {/* ATA Explainer Modal */}
      <Modal
        visible={ataModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAtaModalVisible(false)}
      >
        <Pressable style={styles.ataOverlay} onPress={() => setAtaModalVisible(false)}>
          <Pressable style={styles.ataCard} onPress={() => {}}>
            <Text style={styles.ataTitle}>How Available to Assign works</Text>
            <Text style={styles.ataDescription}>
              This is money in your accounts that hasn&apos;t been given a job yet.
            </Text>
            <View style={styles.ataBreakdown}>
              <View style={styles.ataRow}>
                <Text style={styles.ataRowLabel}>Total in accounts</Text>
                <Text style={styles.ataRowValue}>${formatMoney(totalAccountCents)}</Text>
              </View>
              <View style={styles.ataRow}>
                <Text style={styles.ataRowLabel}>Allocated to envelopes</Text>
                <Text style={[styles.ataRowValue, styles.ataRowDeduct]}>
                  −${formatMoney(totalEnvelopeCents)}
                </Text>
              </View>
              <View style={styles.ataDivider} />
              <View style={styles.ataRow}>
                <Text style={styles.ataRowTotal}>Available to Assign</Text>
                <Text style={[styles.ataRowTotal, availableCents < 0 && styles.ataRowNegative]}>
                  ${formatMoney(availableCents)}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => setAtaModalVisible(false)} style={styles.ataDismiss}>
              <Text style={styles.ataDismissText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Daily scripture */}
      <ScriptureStrip />

      {/* Insight card — Money Shepherd says... */}
      {topInsight && (
        <InsightCard insight={topInsight} onDismiss={dismissInsight} />
      )}

      {/* This Month summary */}
      {monthSummary && (monthSummary.incomeCents > 0 || monthSummary.spendingCents > 0) && (
        <Card style={styles.monthCard} onPress={() => router.push("/period-summary")} accessibilityLabel="View monthly summary">
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
          {/* Income vs Spending ratio bar */}
          {(() => {
            const total = monthSummary.incomeCents + monthSummary.spendingCents;
            if (total <= 0) return null;
            const incomePct = Math.round((monthSummary.incomeCents / total) * 100);
            return (
              <View style={styles.ratioBarSection}>
                <View style={styles.ratioBarTrack}>
                  <View style={[styles.ratioBarIncome, { flex: incomePct }]} />
                  <View style={[styles.ratioBarSpending, { flex: 100 - incomePct }]} />
                </View>
                <View style={styles.ratioBarLabels}>
                  <Text style={styles.ratioBarLabelIncome}>Income {incomePct}%</Text>
                  <Text style={styles.ratioBarLabelSpending}>Spending {100 - incomePct}%</Text>
                </View>
              </View>
            );
          })()}
          {givingThisMonthCents > 0 && (
            <View style={styles.givingRow}>
              <Text style={styles.givingRowLabel}>Giving this month</Text>
              <Text style={styles.givingRowValue}>${formatMoney(givingThisMonthCents)}</Text>
            </View>
          )}
        </Card>
      )}

      {/* Debt Freedom card */}
      {debtSummary && (() => {
        const pct = debtSummary.totalDebt > 0
          ? Math.min(100, Math.round((debtSummary.totalSetAside / debtSummary.totalDebt) * 100))
          : 0;
        return (
          <Card style={styles.debtCard} onPress={() => router.push("/debt-overview")} accessibilityLabel="View debt overview">
            <View style={styles.debtCardHeader}>
              <Text style={styles.debtCardTitle}>Debt Freedom</Text>
              <Text style={styles.debtCardPct}>{pct}%</Text>
            </View>
            <View style={styles.debtProgressTrack}>
              <View style={[styles.debtProgressFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.debtCardSummary}>
              ${formatMoney(debtSummary.totalSetAside)} set aside of ${formatMoney(debtSummary.totalDebt)}
            </Text>
          </Card>
        );
      })()}

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
          onPress={() => router.push("/inbox")}
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
          <AccountsCard accounts={state.accounts} users={state.users} />
        </View>
      )}

    </ScrollView>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.surface },
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
  appName: { fontSize: FontSize.small, fontWeight: FontWeight.semibold, color: c.primary, textTransform: "uppercase" as const, letterSpacing: 1 },

  // Hero card
  heroCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    backgroundColor: c.primary,
    borderRadius: Radius.hero,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  heroLabelRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  heroLabel: { fontSize: FontSize.small, color: "rgba(255,255,255,0.75)", fontWeight: FontWeight.semibold, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  heroAmount: { fontSize: FontSize.hero, fontWeight: FontWeight.extrabold, color: c.textOnColor, marginTop: Spacing.xs },
  heroAmountNegative: { color: c.heroNegative },
  heroStat: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.base,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.3)",
  },
  heroStatLabel: { fontSize: FontSize.small, color: "rgba(255,255,255,0.75)" },
  heroStatValue: { fontSize: FontSize.small, fontWeight: FontWeight.semibold, color: c.textOnColor },
  helpIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  helpIconText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 14,
  },

  // ATA explainer modal
  ataOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  ataCard: {
    backgroundColor: c.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.xl,
    maxWidth: 340,
    width: "100%",
    gap: Spacing.sm,
  },
  ataTitle: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: c.textDark,
  },
  ataDescription: {
    fontSize: FontSize.body,
    color: c.textMid,
    lineHeight: 22,
  },
  ataBreakdown: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  ataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ataRowLabel: {
    fontSize: FontSize.body,
    color: c.textMid,
  },
  ataRowValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: c.textDark,
  },
  ataRowDeduct: {
    color: c.error,
  },
  ataDivider: {
    height: 1,
    backgroundColor: c.borderLight,
  },
  ataRowTotal: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: c.textDark,
  },
  ataRowNegative: {
    color: c.error,
  },
  ataDismiss: {
    marginTop: Spacing.sm,
    alignSelf: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  ataDismissText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: c.primary,
  },

  // This Month card
  monthCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    padding: Spacing.base,
  },
  monthTitle: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: c.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  monthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  monthStat: { alignItems: "center", flex: 1 },
  monthStatLabel: { fontSize: FontSize.caption, color: c.textMuted, marginBottom: Spacing.xs },
  monthStatValue: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  monthIncome: { color: c.success },
  monthSpending: { color: c.error },

  // Income vs Spending ratio bar
  ratioBarSection: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  ratioBarTrack: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  ratioBarIncome: {
    backgroundColor: c.success,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  ratioBarSpending: {
    backgroundColor: c.error,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  ratioBarLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ratioBarLabelIncome: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: c.success,
  },
  ratioBarLabelSpending: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: c.error,
  },

  // Giving row in This Month card
  givingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
  },
  givingRowLabel: { fontSize: FontSize.small, color: c.giving, fontWeight: FontWeight.semibold },
  givingRowValue: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: c.giving },

  // Debt Freedom card
  debtCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    padding: Spacing.base,
  },
  debtCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  debtCardTitle: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: c.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  debtCardPct: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: c.primary,
  },
  debtProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: c.borderLight,
    overflow: "hidden" as const,
    marginBottom: Spacing.sm,
  },
  debtProgressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: c.primary,
  },
  debtCardSummary: {
    fontSize: FontSize.caption,
    color: c.textMuted,
  },

  // Seed nudge
  seedNudge: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: c.primarySurface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: c.primary,
  },
  seedNudgeText: { fontSize: 14, fontWeight: FontWeight.medium, color: c.primaryDark, flex: 1 },

  // Fill nudge
  fillNudge: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: c.primarySurface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: c.primary,
  },
  fillNudgeText: { fontSize: 14, fontWeight: FontWeight.medium, color: c.primaryDark, flex: 1 },

  // Nudge
  nudge: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: c.warningSurface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: c.borderWarning,
  },
  nudgeText: { fontSize: 14, fontWeight: FontWeight.medium, color: c.nudgeText },
  nudgeArrow: { fontSize: FontSize.subtitle, color: c.nudgeText },

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
    borderColor: c.error,
    backgroundColor: c.errorSurface,
  },
  ctaExpenseText: { color: c.error, fontWeight: FontWeight.bold, fontSize: FontSize.body },
  ctaIncome: {
    flex: 1,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.success,
    backgroundColor: c.successSurface,
  },
  ctaIncomeText: { color: c.success, fontWeight: FontWeight.bold, fontSize: FontSize.body },
  ctaAllocate: {
    flex: 1,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.primary,
  },
  ctaAllocateText: { color: c.textOnColor, fontWeight: FontWeight.bold, fontSize: FontSize.body },

  // Accounts
  accountsSection: { marginBottom: Spacing.lg },

});
