import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
  Animated,
} from "react-native";
import ReAnimated, { FadeInDown } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";
import { formatMoney } from "../../src/lib/moneyFormat";
import { ScriptureStrip } from "../../src/ui/components/ScriptureStrip";
import { GreetingCard } from "../../src/ui/components/GreetingCard";
import { Card } from "../../src/ui/components/Card";
import { AccountsCard } from "../../src/ui/components/AccountsCard";
import { InsightCard } from "../../src/ui/components/InsightCard";
import { Spacing, Radius, FontSize, FontWeight, Shadow, type ColorTokens } from "../../src/ui/tokens";
import { useTheme, useThemedStyles } from "@/src/ui/ThemeProvider";
import { getThisMonthSummary } from "../../src/lib/periodSummary";
import { getCurrentPeriod, getFundingInPeriod, generateInsights } from "@money-shepherd/domain";
import type { InsightType } from "@money-shepherd/domain";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SEVERITY_PRIORITY: Record<string, number> = { warning: 0, info: 1, success: 2 };

export default function DashboardScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const state = useAppStore((s) => s.state);
  const lastAiTip = useAppStore((s) => s.lastAiTip);
  const dismissFirstRun = useAppStore((s) => s.dismissFirstRun);

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

  // ── First-run Getting Started card ──────────────────────────────────
  const firstRunSteps = useMemo(() => {
    if (!state) return null;
    if (state.firstRunDismissed) return null;
    if (state.accounts.length === 0) return null; // no bank connected yet

    const step1 = state.budget.envelopes.length > 0;
    const step2 = state.budgetSeeded === true;
    const step3 = state.budget.envelopes.some((e) => e.balance.cents > 0);
    const step4 = unassignedExpenseCount === 0;
    const allDone = step1 && step2 && step3 && step4;

    if (allDone) return null; // auto-dismiss when done

    return [
      { label: "Set up envelopes", done: step1, route: "/ai-setup-wizard" as const },
      { label: "Seed your budget", done: step2, route: "/seed-budget" as const },
      { label: "Fill envelopes", done: step3, route: "/fill-envelopes" as const },
      { label: "Review & assign transactions", done: step4, route: "/inbox" as const },
    ];
  }, [state, unassignedExpenseCount]);

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

  // Press scale animation for nudge cards
  const nudgeScale1 = useRef(new Animated.Value(1)).current;
  const nudgeScale2 = useRef(new Animated.Value(1)).current;
  const nudgeScale3 = useRef(new Animated.Value(1)).current;
  const animatePress = (scale: Animated.Value, toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 50, bounciness: 4 }).start();

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
  const heroState: "over-assigned" | "surplus" | "normal" =
    availableCents < 0 ? "over-assigned" : availableCents > 0 ? "surplus" : "normal";

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
      {/* Greeting + envelope health */}
      <ReAnimated.View entering={FadeInDown.delay(0).duration(400).springify()}>
        <GreetingCard envelopes={state.budget.envelopes} />
      </ReAnimated.View>

      {/* Available to Assign — hero card with 3 states */}
      <ReAnimated.View entering={FadeInDown.delay(50).duration(400).springify()}>
      <Pressable
        style={[
          styles.heroCard,
          heroState === "over-assigned" && styles.heroCardOverAssigned,
        ]}
        onPress={() => {
          if (heroState === "over-assigned") {
            setAtaModalVisible(true);
          } else {
            router.push("/fill-envelopes");
          }
        }}
        accessibilityLabel={
          heroState === "over-assigned"
            ? "Over-assigned — tap for details"
            : "Available to assign — tap to fill envelopes"
        }
        accessibilityRole="button"
      >
        <View style={styles.heroLabelRow}>
          <Text style={styles.heroLabel}>
            {heroState === "over-assigned" ? "⚠ Assigned Too Much" : "Available to Assign"}
          </Text>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              setAtaModalVisible(true);
            }}
            hitSlop={8}
            accessibilityLabel="How is this calculated?"
            accessibilityRole="button"
          >
            <View style={styles.helpIcon}>
              <Text style={styles.helpIconText}>?</Text>
            </View>
          </Pressable>
        </View>
        <Text style={styles.heroAmount}>
          ${formatMoney(availableCents)}
        </Text>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatLabel}>
            {heroState === "over-assigned"
              ? "Review your envelopes"
              : heroState === "surplus"
                ? "✦ Ready to Fill"
                : "Total in envelopes"}
          </Text>
          <Text style={styles.heroStatValue}>
            {heroState === "over-assigned"
              ? `−$${formatMoney(Math.abs(availableCents))} over`
              : `$${formatMoney(totalEnvelopeCents)}`}
          </Text>
        </View>
      </Pressable>
      </ReAnimated.View>

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

      {/* Quick stats — Income | Spent | Net */}
      {monthSummary && (monthSummary.incomeCents > 0 || monthSummary.spendingCents > 0) && (
        <ReAnimated.View entering={FadeInDown.delay(100).duration(400).springify()}>
          <Pressable
            style={styles.statsRow}
            onPress={() => router.push("/period-summary")}
            accessibilityLabel="View monthly summary"
            accessibilityRole="button"
          >
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>Income</Text>
              <Text style={[styles.statValue, styles.statIncome]}>
                +${formatMoney(monthSummary.incomeCents)}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>Spent</Text>
              <Text style={[styles.statValue, styles.statSpending]}>
                -${formatMoney(monthSummary.spendingCents)}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>Net</Text>
              <Text
                style={[
                  styles.statValue,
                  monthSummary.netCents >= 0 ? styles.statIncome : styles.statSpending,
                ]}
              >
                {monthSummary.netCents >= 0 ? "+" : "-"}${formatMoney(Math.abs(monthSummary.netCents))}
              </Text>
            </View>
          </Pressable>
        </ReAnimated.View>
      )}

      {/* Daily scripture */}
      <ReAnimated.View entering={FadeInDown.delay(150).duration(400).springify()}>
        <ScriptureStrip />
      </ReAnimated.View>

      {/* Insight card — Money Shepherd says... */}
      {topInsight && (
        <ReAnimated.View entering={FadeInDown.delay(200).duration(400).springify()}>
          <InsightCard insight={topInsight} onDismiss={dismissInsight} />
        </ReAnimated.View>
      )}

      {/* Getting Started checklist */}
      {firstRunSteps && (
        <ReAnimated.View entering={FadeInDown.delay(220).duration(400).springify()}>
          <Card style={styles.gettingStartedCard}>
            <Text style={styles.gettingStartedTitle}>Getting Started</Text>
            {firstRunSteps.map((step, i) => (
              <Pressable
                key={i}
                style={styles.gettingStartedRow}
                onPress={() => !step.done && router.push(step.route)}
                disabled={step.done}
              >
                <Text style={styles.gettingStartedCheck}>
                  {step.done ? "✓" : "○"}
                </Text>
                <Text
                  style={[
                    styles.gettingStartedLabel,
                    step.done && styles.gettingStartedDone,
                  ]}
                >
                  {step.label}
                </Text>
                {!step.done && (
                  <Text style={styles.gettingStartedChevron}>›</Text>
                )}
              </Pressable>
            ))}
            <Pressable
              onPress={dismissFirstRun}
              style={styles.gettingStartedDismiss}
            >
              <Text style={styles.gettingStartedDismissText}>Got it</Text>
            </Pressable>
          </Card>
        </ReAnimated.View>
      )}

      {/* Seed budget nudge */}
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
          <ReAnimated.View entering={FadeInDown.delay(250).duration(400).springify()}>
            <AnimatedPressable
              style={[styles.nudgeCard, { transform: [{ scale: nudgeScale1 }] }]}
              onPress={() => router.push("/seed-budget")}
              onPressIn={() => animatePress(nudgeScale1, 0.97)}
              onPressOut={() => animatePress(nudgeScale1, 1)}
              accessibilityLabel={state.budgetSeeded ? "Add new account balances to budget" : "Seed your budget from bank balances"}
              accessibilityRole="button"
            >
              <View style={styles.nudgeIconBadge}>
                <MaterialCommunityIcons name="bank-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.nudgeTextCol}>
                <Text style={styles.nudgeTitle}>
                  {state.budgetSeeded
                    ? "New accounts — add balances"
                    : "Seed your budget"}
                </Text>
                <Text style={styles.nudgeSubtitle}>
                  {state.budgetSeeded
                    ? "Review linked accounts"
                    : "Start from your current balances"}
                </Text>
              </View>
              <Text style={styles.nudgeChevron}>›</Text>
            </AnimatedPressable>
          </ReAnimated.View>
        )}

      {/* Fill envelopes nudge */}
      {hasUnfilledGoals && (
        <ReAnimated.View entering={FadeInDown.delay(300).duration(400).springify()}>
          <AnimatedPressable
            style={[styles.nudgeCard, { transform: [{ scale: nudgeScale2 }] }]}
            onPress={() => router.push("/fill-envelopes")}
            onPressIn={() => animatePress(nudgeScale2, 0.97)}
            onPressOut={() => animatePress(nudgeScale2, 1)}
            accessibilityLabel="Fill your envelopes from available funds"
            accessibilityRole="button"
          >
            <View style={styles.nudgeIconBadge}>
              <MaterialCommunityIcons name="target" size={20} color={colors.primary} />
            </View>
            <View style={styles.nudgeTextCol}>
              <Text style={styles.nudgeTitle}>Ready to fill your envelopes</Text>
              <Text style={styles.nudgeSubtitle}>
                ${formatMoney(availableCents)} available to assign
              </Text>
            </View>
            <Text style={styles.nudgeChevron}>›</Text>
          </AnimatedPressable>
        </ReAnimated.View>
      )}

      {/* Unassigned nudge */}
      {unassignedExpenseCount > 0 && (
        <ReAnimated.View entering={FadeInDown.delay(350).duration(400).springify()}>
          <AnimatedPressable
            style={[styles.nudgeCard, styles.nudgeCardWarning, { transform: [{ scale: nudgeScale3 }] }]}
            onPress={() => router.push("/inbox")}
            onPressIn={() => animatePress(nudgeScale3, 0.97)}
            onPressOut={() => animatePress(nudgeScale3, 1)}
            accessibilityLabel="Go to inbox to assign transactions"
            accessibilityRole="button"
          >
            <View style={[styles.nudgeIconBadge, styles.nudgeIconBadgeWarning]}>
              <MaterialCommunityIcons name="email-open-outline" size={20} color={colors.warning} />
            </View>
            <View style={styles.nudgeTextCol}>
              <Text style={styles.nudgeTitle}>
                {unassignedExpenseCount}{" "}
                {unassignedExpenseCount === 1 ? "transaction needs" : "transactions need"} a home
              </Text>
              <Text style={styles.nudgeSubtitle}>Tap to categorize</Text>
            </View>
            <Text style={styles.nudgeChevron}>›</Text>
          </AnimatedPressable>
        </ReAnimated.View>
      )}

      {/* Accounts overview */}
      {state.accounts.length > 0 && (
        <ReAnimated.View entering={FadeInDown.delay(400).duration(400).springify()}>
          <View style={styles.accountsSection}>
            <AccountsCard accounts={state.accounts} users={state.users} />
          </View>
        </ReAnimated.View>
      )}

      {/* Debt Freedom bar */}
      {debtSummary && (() => {
        const pct = debtSummary.totalDebt > 0
          ? Math.min(100, Math.round((debtSummary.totalSetAside / debtSummary.totalDebt) * 100))
          : 0;
        return (
          <ReAnimated.View entering={FadeInDown.delay(450).duration(400).springify()}>
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
          </ReAnimated.View>
        );
      })()}

    </ScrollView>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingBottom: Spacing.bottomPad },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  // Hero card — 3 states: normal (gold), surplus (deep gold), over-assigned (red)
  heroCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    backgroundColor: c.primary,
    borderRadius: Radius.hero,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  heroCardOverAssigned: {
    backgroundColor: c.heroOverAssigned,
  },
  heroLabelRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  heroLabel: { fontSize: FontSize.small, color: "rgba(255,255,255,0.85)", fontWeight: FontWeight.semibold, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  heroAmount: { fontSize: FontSize.hero, fontWeight: FontWeight.extrabold, color: c.textOnColor, marginTop: Spacing.xs },
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

  // Quick stats row
  statsRow: {
    flexDirection: "row",
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    backgroundColor: c.cardSurface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: c.borderLight,
    marginVertical: 2,
  },
  statLabel: {
    fontSize: FontSize.caption,
    color: c.textMuted,
  },
  statValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  statIncome: { color: c.success },
  statSpending: { color: c.error },

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

  // Getting Started card
  gettingStartedCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    padding: Spacing.base,
    gap: Spacing.xs,
  },
  gettingStartedTitle: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: c.textDark,
    marginBottom: Spacing.xs,
  },
  gettingStartedRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  gettingStartedCheck: {
    fontSize: 16,
    width: 20,
    textAlign: "center" as const,
    color: c.primary,
    fontWeight: FontWeight.bold,
  },
  gettingStartedLabel: {
    flex: 1,
    fontSize: FontSize.body,
    color: c.textDark,
  },
  gettingStartedDone: {
    color: c.textMuted,
    textDecorationLine: "line-through" as const,
  },
  gettingStartedChevron: {
    fontSize: 18,
    color: c.textMuted,
    fontWeight: FontWeight.medium,
  },
  gettingStartedDismiss: {
    alignItems: "center" as const,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.xs,
  },
  gettingStartedDismissText: {
    fontSize: FontSize.small,
    color: c.textMuted,
    fontWeight: FontWeight.medium,
  },

  // Nudge cards — icon + pill style
  nudgeCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.cardSurface,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    ...Shadow.sm,
  },
  nudgeCardWarning: {
    backgroundColor: c.warningSurface,
  },
  nudgeIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.primarySurface,
  },
  nudgeIconBadgeWarning: {
    backgroundColor: c.borderWarning,
  },
  nudgeTextCol: {
    flex: 1,
    gap: 2,
  },
  nudgeTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: c.textDark,
  },
  nudgeSubtitle: {
    fontSize: FontSize.caption,
    color: c.textMuted,
  },
  nudgeChevron: {
    fontSize: 22,
    color: c.textSubtle,
  },

  // Accounts
  accountsSection: { marginBottom: Spacing.lg },

});
