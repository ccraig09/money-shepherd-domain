import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Card } from "../Card";
import { DonutChart } from "./DonutChart";
import type { DonutSegment } from "./DonutChart";
import { ChartErrorBoundary } from "./ChartErrorBoundary";
import { formatMoney } from "../../../lib/moneyFormat";
import { FontSize, FontWeight, Spacing, type ColorTokens } from "../../tokens";
import { useThemedStyles, useTheme } from "../../ThemeProvider";
import type { Envelope } from "@money-shepherd/domain";

/** Vibrant, high-saturation palette — distinct hues for data viz */
const CHART_PALETTE = [
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#10b981", // emerald
  "#f43f5e", // rose
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#84cc16", // lime
] as const;

const MAX_SLICES = 6;
const CHART_SIZE = 170;
const CHART_STROKE = 22;

type Props = {
  envelopes: Envelope[];
  spentByEnvelope: Record<string, number>;
};

/**
 * Dashboard card showing a donut chart of this month's spending by envelope.
 * Hidden when there is no spending data.
 */
export function SpendingDonutCard({ envelopes, spentByEnvelope }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  const sorted = envelopes
    .map((env) => ({
      envelope: env,
      spent: spentByEnvelope[env.id] ?? 0,
    }))
    .filter((e) => e.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  if (sorted.length === 0) return null;

  const totalSpent = sorted.reduce((sum, e) => sum + e.spent, 0);

  // Group smaller slices into "Other" if we have too many
  let displayed = sorted;
  let otherCents = 0;
  if (sorted.length > MAX_SLICES) {
    displayed = sorted.slice(0, MAX_SLICES - 1);
    otherCents = sorted
      .slice(MAX_SLICES - 1)
      .reduce((sum, e) => sum + e.spent, 0);
  }

  // Separate palette counter so giving/debt overrides don't skip palette slots
  let paletteIdx = 0;
  const segments: DonutSegment[] = displayed.map((entry) => {
    if (entry.envelope.type === "giving")
      return { value: entry.spent, color: colors.giving, label: entry.envelope.name };
    if (entry.envelope.type === "debt")
      return { value: entry.spent, color: colors.debt, label: entry.envelope.name };
    const color = CHART_PALETTE[paletteIdx % CHART_PALETTE.length];
    paletteIdx++;
    return { value: entry.spent, color, label: entry.envelope.name };
  });

  if (otherCents > 0) {
    segments.push({
      value: otherCents,
      color: colors.textSubtle,
      label: "Other",
    });
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Spending Breakdown</Text>

      {/* Chart — centered with total in the middle */}
      <View style={styles.chartContainer}>
        <ChartErrorBoundary fallbackMessage="Spending chart unavailable" colors={colors}>
          <DonutChart segments={segments} size={CHART_SIZE} strokeWidth={CHART_STROKE} />
          <View style={styles.centerLabel} pointerEvents="none">
            <Text style={styles.centerAmount}>${formatMoney(totalSpent)}</Text>
            <Text style={styles.centerCaption}>spent</Text>
          </View>
        </ChartErrorBoundary>
      </View>

      {/* Legend — full-width rows with dot, name, pct, amount */}
      <View style={styles.legend}>
        {segments.map((seg) => {
          const pct = Math.round((seg.value / totalSpent) * 100);
          return (
            <View key={seg.label} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
              <Text style={styles.legendName} numberOfLines={1}>
                {seg.label}
              </Text>
              <Text style={styles.legendPct}>{pct}%</Text>
              <Text style={styles.legendAmount}>${formatMoney(seg.value)}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  card: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    padding: Spacing.base,
  },
  title: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: c.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  chartContainer: {
    position: "relative",
    width: CHART_SIZE,
    height: CHART_SIZE,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.base,
  },
  centerLabel: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  centerAmount: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: c.textDark,
  },
  centerCaption: {
    fontSize: FontSize.caption,
    color: c.textMuted,
  },
  legend: {
    gap: Spacing.sm,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendName: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    color: c.textDark,
  },
  legendPct: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: c.textMuted,
    minWidth: 32,
    textAlign: "right",
  },
  legendAmount: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: c.textDark,
    minWidth: 80,
    textAlign: "right",
  },
});
