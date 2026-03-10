import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Card } from "./Card";
import { Spacing, FontSize, FontWeight, type ColorTokens } from "../tokens";
import { useThemedStyles } from "../ThemeProvider";
import { formatMoney } from "../../lib/moneyFormat";
import type { WeeklySummary } from "@money-shepherd/domain";

type Props = {
  summary: WeeklySummary;
};

function paceLabel(ratio: number | null): { text: string; tone: "ok" | "warn" } {
  if (ratio === null) return { text: "No budget set", tone: "ok" };
  if (ratio <= 1.0) return { text: "On track", tone: "ok" };
  return { text: "Spending fast", tone: "warn" };
}

export function WeeklyNudgeCard({ summary }: Props) {
  const styles = useThemedStyles(createStyles);

  if (summary.totalSpentCents === 0) return null;

  const pace = paceLabel(summary.paceRatio);

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>This Week</Text>
        <Text style={[styles.pace, pace.tone === "warn" && styles.paceWarn]}>
          {pace.text}
        </Text>
      </View>

      <Text style={styles.total}>${formatMoney(summary.totalSpentCents)}</Text>
      <Text style={styles.totalLabel}>spent this week</Text>

      {summary.topEnvelopes.length > 0 && (
        <View style={styles.envelopeList}>
          {summary.topEnvelopes.map((env) => {
            const pct =
              summary.totalSpentCents > 0
                ? Math.round((env.spentCents / summary.totalSpentCents) * 100)
                : 0;
            return (
              <View key={env.envelopeId} style={styles.envRow}>
                <View style={styles.envInfo}>
                  <Text style={styles.envName} numberOfLines={1}>
                    {env.name}
                  </Text>
                  <Text style={styles.envAmount}>
                    ${formatMoney(env.spentCents)}
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%` }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {summary.unassignedSpentCents > 0 && (
        <Text style={styles.unassigned}>
          ${formatMoney(summary.unassignedSpentCents)} unassigned
        </Text>
      )}
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
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.sm,
    },
    title: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.semibold,
      color: c.textMuted,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
    },
    pace: {
      fontSize: FontSize.caption,
      fontWeight: FontWeight.semibold,
      color: c.success,
    },
    paceWarn: {
      color: c.warning,
    },
    total: {
      fontSize: FontSize.title,
      fontWeight: FontWeight.bold,
      color: c.textDark,
    },
    totalLabel: {
      fontSize: FontSize.caption,
      color: c.textMuted,
      marginBottom: Spacing.md,
    },
    envelopeList: {
      gap: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderLight,
    },
    envRow: {
      gap: Spacing.xs,
    },
    envInfo: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    envName: {
      fontSize: FontSize.small,
      color: c.textDark,
      flex: 1,
      marginRight: Spacing.sm,
    },
    envAmount: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.semibold,
      color: c.textMid,
    },
    barTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: c.borderLight,
      overflow: "hidden" as const,
    },
    barFill: {
      height: 4,
      borderRadius: 2,
      backgroundColor: c.primary,
    },
    unassigned: {
      fontSize: FontSize.caption,
      color: c.textMuted,
      marginTop: Spacing.sm,
      fontStyle: "italic" as const,
    },
  });
