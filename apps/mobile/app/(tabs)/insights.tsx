import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useAppStore } from "../../src/store/useAppStore";
import {
  Spacing,
  Radius,
  FontSize,
  FontWeight,
  Shadow,
  type ColorTokens,
} from "../../src/ui/tokens";
import { useThemedStyles } from "@/src/ui/ThemeProvider";
import { SpendingDonutCard } from "../../src/ui/components/charts/SpendingDonutCard";
import { MonthlyTrendCard } from "../../src/ui/components/charts/MonthlyTrendCard";
import { CashFlowForecastCard } from "../../src/ui/components/CashFlowForecastCard";
import { WeeklyNudgeCard } from "../../src/ui/components/WeeklyNudgeCard";
import { DebtProgressBar } from "../../src/ui/components/DebtProgressBar";
import { Card } from "../../src/ui/components/Card";
import { HelpTooltip } from "../../src/ui/components/HelpTooltip";
import { getThisMonthSummary, getMonthlyTrend } from "../../src/lib/periodSummary";
import { getCashFlowForecast, getWeeklySummary } from "@money-shepherd/domain";

export default function InsightsScreen() {
  const styles = useThemedStyles(createStyles);
  const state = useAppStore((s) => s.state);

  const now = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const monthSummary = useMemo(() => {
    if (!state) return null;
    return getThisMonthSummary(
      state.transactions,
      state.inbox.assignmentsByTransactionId,
      state.budget.envelopes,
      now,
    );
  }, [state, now]);

  const trend = useMemo(() => {
    if (!state) return null;
    return getMonthlyTrend(state.transactions, now, 6);
  }, [state, now]);

  const forecast = useMemo(() => {
    if (!state) return null;
    return getCashFlowForecast(state.transactions, now);
  }, [state, now]);

  const weeklySummary = useMemo(() => {
    if (!state) return null;
    return getWeeklySummary(
      state.transactions,
      state.inbox.assignmentsByTransactionId,
      state.budget.envelopes,
      now,
    );
  }, [state, now]);

  const spendingEnvelopes = useMemo(() => {
    if (!state) return [];
    return state.budget.envelopes.filter(
      (e) => e.type === "spending" || e.type === "giving",
    );
  }, [state]);

  const debtEnvelopes = useMemo(() => {
    if (!state) return [];
    return state.budget.envelopes.filter(
      (e) => e.type === "debt" && e.goal && e.goal.cents > 0,
    );
  }, [state]);

  if (!state) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Spending section */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>SPENDING</Text>
          <HelpTooltip
            title="Spending Breakdown"
            body="Shows spending by category this month. Each % is that category's share of your total spending."
          />
        </View>
        {monthSummary ? (
          <SpendingDonutCard
            envelopes={spendingEnvelopes}
            spentByEnvelope={monthSummary.spentByEnvelope}
            now={now}
          />
        ) : (
          <Text style={styles.placeholderText}>
            Add transactions to see your spending breakdown.
          </Text>
        )}

        {/* Weekly nudge section */}
        {weeklySummary && weeklySummary.totalSpentCents > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>THIS WEEK</Text>
              <HelpTooltip
                title="This Week"
                body="Your total discretionary spending over the last 7 days."
              />
            </View>
            <WeeklyNudgeCard summary={weeklySummary} />
          </>
        )}

        {/* Debt progress section */}
        {debtEnvelopes.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>DEBT PROGRESS</Text>
              <HelpTooltip
                title="Debt Progress"
                body="Tracks how much you've paid toward each debt goal. Balance shown is the amount paid so far."
              />
            </View>
            <Card style={styles.debtCard}>
              {debtEnvelopes.map((env, idx) => (
                <View
                  key={env.id}
                  style={[styles.debtRow, idx < debtEnvelopes.length - 1 && styles.debtRowBorder]}
                >
                  <View style={styles.debtHeader}>
                    <Text style={styles.debtName} numberOfLines={1}>{env.name}</Text>
                    <Text style={styles.debtAmount}>
                      ${Math.round(env.balance.cents / 100)} / ${Math.round((env.goal?.cents ?? 0) / 100)}
                    </Text>
                  </View>
                  <DebtProgressBar
                    paidCents={env.balance.cents}
                    targetCents={env.goal?.cents ?? 0}
                  />
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Trend section */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>TRENDS</Text>
          <HelpTooltip
            title="Monthly Trends"
            body="Income and spending over the past 6 months. Bars show the net difference each month."
          />
        </View>
        {trend && trend.some((p) => p.incomeCents > 0 || p.spendingCents > 0) ? (
          <MonthlyTrendCard trend={trend} />
        ) : (
          <Text style={styles.placeholderText}>
            Transaction history will appear here.
          </Text>
        )}

        {/* Forecast section */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>FORECAST</Text>
          <HelpTooltip
            title="Cash Flow Forecast"
            body="Projects your month-end balance using recurring bills and your recent 7-day spending pace."
          />
        </View>
        {forecast ? (
          <CashFlowForecastCard forecast={forecast} />
        ) : (
          <Text style={styles.placeholderText}>
            Cash flow forecast available after the 2nd of the month.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.surface },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    loadingText: { fontSize: FontSize.body, color: c.textMuted },
    header: {
      paddingHorizontal: Spacing.base,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    title: {
      fontSize: FontSize.title,
      fontWeight: FontWeight.bold,
      color: c.textDark,
    },
    scroll: { flex: 1 },
    content: {
      paddingVertical: Spacing.sm,
      paddingBottom: Spacing.bottomPad,
    },
    sectionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
      marginTop: Spacing.base,
      marginBottom: Spacing.xs,
      paddingHorizontal: Spacing.base,
    },
    sectionLabel: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.semibold,
      color: c.textMuted,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    placeholderText: {
      fontSize: FontSize.body,
      color: c.textSubtle,
      textAlign: "center",
      letterSpacing: 0,
      marginHorizontal: Spacing.base,
      marginBottom: Spacing.base,
    },
    debtCard: {
      marginHorizontal: Spacing.base,
      marginBottom: Spacing.base,
      padding: Spacing.base,
      borderRadius: Radius.lg,
      ...Shadow.sm,
    },
    debtRow: {
      paddingVertical: Spacing.md,
      gap: Spacing.sm,
    },
    debtRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderLight,
    },
    debtHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.xs,
    },
    debtName: {
      fontSize: FontSize.body,
      fontWeight: FontWeight.semibold,
      color: c.textDark,
      flex: 1,
    },
    debtAmount: {
      fontSize: FontSize.caption,
      color: c.textMuted,
      marginLeft: Spacing.sm,
    },
  });
