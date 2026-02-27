import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Card } from "../Card";
import { ChartErrorBoundary } from "./ChartErrorBoundary";
import { formatMoney } from "../../../lib/moneyFormat";
import type { MonthTrendPoint } from "../../../lib/periodSummary";
import { FontSize, FontWeight, Spacing, type ColorTokens } from "../../tokens";
import { useThemedStyles, useTheme } from "../../ThemeProvider";

type Props = {
  trend: MonthTrendPoint[];
};

const CHART_HEIGHT = 100;
const BAR_WIDTH = 16;

/**
 * Grouped bar chart showing income vs spending per month.
 * Hidden when fewer than 2 months have data.
 */
export function MonthlyTrendCard({ trend }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  const withData = trend.filter((m) => m.incomeCents > 0 || m.spendingCents > 0);
  if (withData.length < 2) return null;

  const maxVal = Math.max(
    ...trend.flatMap((m) => [m.incomeCents, m.spendingCents]),
    1,
  );

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Monthly Trend</Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
            <Text style={styles.legendText}>Income</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
            <Text style={styles.legendText}>Spending</Text>
          </View>
        </View>
      </View>

      <ChartErrorBoundary fallbackMessage="Trend chart unavailable">
        <View style={styles.chartRow}>
          {trend.map((m, i) => {
            const incomeH = maxVal > 0 ? (m.incomeCents / maxVal) * CHART_HEIGHT : 0;
            const spendH = maxVal > 0 ? (m.spendingCents / maxVal) * CHART_HEIGHT : 0;
            const hasData = m.incomeCents > 0 || m.spendingCents > 0;

            return (
              <View key={m.label + i} style={styles.monthGroup}>
                <View style={styles.barsContainer}>
                  <TrendAnimatedBar targetHeight={incomeH} color={colors.success} delay={i * 80} />
                  <TrendAnimatedBar targetHeight={spendH} color={colors.error} delay={i * 80 + 40} />
                </View>
                <Text style={styles.monthLabel}>{m.label}</Text>
                {hasData && (
                  <Text
                    style={[
                      styles.netLabel,
                      m.netCents >= 0 ? styles.netPositive : styles.netNegative,
                    ]}
                    numberOfLines={1}
                  >
                    {m.netCents >= 0 ? "+" : "-"}${formatCompact(Math.abs(m.netCents))}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </ChartErrorBoundary>
    </Card>
  );
}

/** Compact money display: $1.2k, $48k, $350 */
function formatCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 10000) return `${Math.round(dollars / 1000)}k`;
  if (dollars >= 1000) return `${(dollars / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return formatMoney(cents);
}

function TrendAnimatedBar({
  targetHeight,
  color,
  delay,
}: {
  targetHeight: number;
  color: string;
  delay: number;
}) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      progress.value = withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      });
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared value ref is stable
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    height: targetHeight * progress.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: BAR_WIDTH,
          backgroundColor: color,
          borderRadius: 3,
          minHeight: targetHeight > 0 ? 2 : 0,
        },
        animatedStyle,
      ]}
    />
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  card: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    padding: Spacing.base,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: c.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  legend: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: FontSize.caption,
    color: c.textMuted,
  },
  chartRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  monthGroup: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.xs,
  },
  barsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: CHART_HEIGHT,
    gap: 2,
  },
  monthLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    color: c.textMuted,
  },
  netLabel: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
  },
  netPositive: {
    color: c.success,
  },
  netNegative: {
    color: c.error,
  },
});
