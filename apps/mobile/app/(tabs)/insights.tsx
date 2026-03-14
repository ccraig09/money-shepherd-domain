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
  FontSize,
  FontWeight,
  type ColorTokens,
} from "../../src/ui/tokens";
import { useThemedStyles } from "@/src/ui/ThemeProvider";
import { SpendingDonutCard } from "../../src/ui/components/charts/SpendingDonutCard";
import { MonthlyTrendCard } from "../../src/ui/components/charts/MonthlyTrendCard";
import { CashFlowForecastCard } from "../../src/ui/components/CashFlowForecastCard";
import { getThisMonthSummary, getMonthlyTrend } from "../../src/lib/periodSummary";
import { getCashFlowForecast } from "@money-shepherd/domain";

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
        <Text style={styles.sectionLabel}>SPENDING</Text>
        {monthSummary ? (
          <SpendingDonutCard
            envelopes={state.budget.envelopes}
            spentByEnvelope={monthSummary.spentByEnvelope}
            now={now}
          />
        ) : (
          <Text style={styles.placeholderText}>
            Add transactions to see your spending breakdown.
          </Text>
        )}

        {/* Trend section */}
        <Text style={styles.sectionLabel}>TRENDS</Text>
        {trend && trend.some((p) => p.incomeCents > 0 || p.spendingCents > 0) ? (
          <MonthlyTrendCard trend={trend} />
        ) : (
          <Text style={styles.placeholderText}>
            Transaction history will appear here.
          </Text>
        )}

        {/* Forecast section */}
        <Text style={styles.sectionLabel}>FORECAST</Text>
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
    sectionLabel: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.semibold,
      color: c.textMuted,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginTop: Spacing.base,
      marginBottom: Spacing.xs,
      paddingHorizontal: Spacing.base,
    },
    placeholderText: {
      fontSize: FontSize.body,
      color: c.textSubtle,
      textAlign: "center",
      letterSpacing: 0,
      marginHorizontal: Spacing.base,
      marginBottom: Spacing.base,
    },
  });
