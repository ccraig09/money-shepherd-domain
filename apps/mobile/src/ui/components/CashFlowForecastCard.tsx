import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Card } from "./Card";
import { HelpTooltip } from "./HelpTooltip";
import { Spacing, FontSize, FontWeight, type ColorTokens } from "../tokens";
import { useThemedStyles } from "../ThemeProvider";
import { formatMoney } from "../../lib/moneyFormat";
import type { CashFlowForecast } from "@money-shepherd/domain";

type Props = {
  forecast: CashFlowForecast;
};

function headline(netCents: number): { label: string; tone: "great" | "ok" | "warn" } {
  if (netCents >= 50000) return { label: "On pace to save", tone: "great" };
  if (netCents >= 0)     return { label: "Roughly breaking even", tone: "ok" };
  if (netCents >= -20000) return { label: "Watch your spending —", tone: "warn" };
  return { label: "Spending may exceed income by", tone: "warn" };
}

export function CashFlowForecastCard({ forecast }: Props) {
  const styles = useThemedStyles(createStyles);
  const { label, tone } = headline(forecast.projectedNetCents);
  const absNet = Math.abs(forecast.projectedNetCents);
  const isBreakingEven = forecast.projectedNetCents >= 0 && forecast.projectedNetCents < 50000;

  return (
    <Card style={styles.card}>
      {/* Header */}
      <Text style={styles.sectionLabel}>Month-End Forecast</Text>

      {/* Hero headline */}
      <View style={styles.heroRow}>
        <Text style={[
          styles.heroLabel,
          tone === "great" && styles.heroGreen,
          tone === "ok"   && styles.heroAmber,
          tone === "warn" && styles.heroRed,
        ]}>
          {isBreakingEven
            ? label
            : `${label} $${formatMoney(absNet)}`}
        </Text>
      </View>

      {/* Breakdown */}
      <View style={styles.breakdown}>
        <View style={styles.row}>
          <View style={styles.labelRow}>
            <Text style={styles.rowLabel}>Income this month</Text>
            <HelpTooltip
              title="Income this month"
              body="Paychecks and deposits received so far, plus recurring income expected later this month."
            />
          </View>
          <Text style={[styles.rowValue, styles.income]}>
            +${formatMoney(forecast.monthIncomeCents + forecast.remainingIncomeCents)}
          </Text>
        </View>

        <View style={styles.row}>
          <View style={styles.labelRow}>
            <Text style={styles.rowLabel}>Spent so far</Text>
            <HelpTooltip
              title="Spent so far"
              body="All non-transfer spending this month. Transfers between your own accounts are excluded."
            />
          </View>
          <Text style={styles.rowValue}>
            -${formatMoney(forecast.monthSpentCents)}
          </Text>
        </View>

        {forecast.upcomingBillsCents > 0 && (
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={styles.rowLabel}>Upcoming bills</Text>
              <HelpTooltip
                title="Upcoming bills"
                body="Recurring bills we expect but haven't posted yet this month."
              />
            </View>
            <Text style={[styles.rowValue, styles.expense]}>
              -${formatMoney(forecast.upcomingBillsCents)}
            </Text>
          </View>
        )}

        {forecast.projectedDiscretionaryCents > 0 && (
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={styles.rowLabel}>Est. remaining spend</Text>
              <HelpTooltip
                title="Est. remaining spend"
                body="Based on your average daily spending pace over the last 7 days. Large one-time purchases can inflate this estimate."
              />
            </View>
            <Text style={[styles.rowValue, styles.muted]}>
              -${formatMoney(forecast.projectedDiscretionaryCents)}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    card: {
      marginHorizontal: Spacing.base,
      marginBottom: Spacing.base,
      padding: Spacing.base,
    },
    sectionLabel: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.semibold,
      color: c.textMuted,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
      marginBottom: Spacing.sm,
    },
    heroRow: {
      marginBottom: Spacing.md,
    },
    heroLabel: {
      fontSize: FontSize.subtitle,
      fontWeight: FontWeight.bold,
      lineHeight: 24,
    },
    heroGreen: { color: c.success },
    heroAmber: { color: c.primary },
    heroRed:   { color: c.warning },
    breakdown: {
      gap: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderLight,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
    },
    rowLabel: {
      fontSize: FontSize.small,
      color: c.textMid,
    },
    rowValue: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.semibold,
      color: c.textDark,
    },
    income: { color: c.success },
    expense: { color: c.error },
    muted: { color: c.textMuted },
  });
