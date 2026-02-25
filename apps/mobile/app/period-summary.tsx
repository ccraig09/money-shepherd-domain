import React, { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
} from "react-native";
import { Stack } from "expo-router";
import { useAppStore } from "../src/store/useAppStore";
import { formatMoney } from "../src/lib/moneyFormat";
import { getThisMonthSummary } from "../src/lib/periodSummary";
import {
  getCurrentPeriod,
  getPeriodLabel,
  getSpendingInPeriod,
} from "@money-shepherd/domain";
import type { Envelope } from "@money-shepherd/domain";
import { Card } from "../src/ui/components/Card";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../src/ui/tokens";

type EnvelopeSpending = {
  envelope: Envelope;
  spentCents: number;
};

export default function PeriodSummaryScreen() {
  const state = useAppStore((s) => s.state);

  const period = useMemo(
    () => getCurrentPeriod(new Date().toISOString()),
    [],
  );

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

  const givingCents = useMemo(() => {
    if (!state) return 0;
    const givingEnvelopes = state.budget.envelopes.filter((e) => e.type === "giving");
    if (givingEnvelopes.length === 0) return 0;
    const assignments = Object.values(state.inbox.assignmentsByTransactionId);
    return givingEnvelopes.reduce(
      (sum, env) => sum + getSpendingInPeriod(state.transactions, assignments, env.id, period).cents,
      0,
    );
  }, [state, period]);

  const envelopeBreakdown = useMemo((): EnvelopeSpending[] => {
    if (!state || !monthSummary) return [];
    return state.budget.envelopes
      .map((env) => ({
        envelope: env,
        spentCents: monthSummary.spentByEnvelope[env.id] ?? 0,
      }))
      .filter((item) => item.spentCents > 0)
      .sort((a, b) => b.spentCents - a.spentCents);
  }, [state, monthSummary]);

  if (!state || !monthSummary) {
    return (
      <View style={styles.center}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: getPeriodLabel(period) }} />

      <FlatList
        data={envelopeBreakdown}
        keyExtractor={(item) => item.envelope.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Totals card */}
            <Card style={styles.totalsCard}>
              <TotalRow
                label="Income"
                cents={monthSummary.incomeCents}
                color={Color.success}
                prefix="+"
              />
              <TotalRow
                label="Spending"
                cents={monthSummary.spendingCents}
                color={Color.error}
                prefix="-"
              />
              {givingCents > 0 && (
                <TotalRow
                  label="Giving"
                  cents={givingCents}
                  color={Color.giving}
                  prefix=""
                />
              )}
              <View style={styles.netDivider} />
              <TotalRow
                label="Net"
                cents={Math.abs(monthSummary.netCents)}
                color={monthSummary.netCents >= 0 ? Color.success : Color.error}
                prefix={monthSummary.netCents >= 0 ? "+" : "-"}
                bold
              />
            </Card>

            {/* Breakdown header */}
            {envelopeBreakdown.length > 0 && (
              <Text style={styles.sectionTitle}>Spending by Envelope</Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownNameRow}>
              <Text style={styles.breakdownName} numberOfLines={1}>
                {item.envelope.name}
              </Text>
              {item.envelope.type === "giving" && (
                <View style={styles.givingBadge}>
                  <Text style={styles.givingBadgeText}>GIVING</Text>
                </View>
              )}
            </View>
            <Text style={styles.breakdownAmount}>
              ${formatMoney(item.spentCents)}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No spending this month yet.</Text>
        }
      />
    </View>
  );
}

function TotalRow({
  label,
  cents,
  color,
  prefix,
  bold,
}: {
  label: string;
  cents: number;
  color: string;
  prefix: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, bold && styles.totalLabelBold]}>{label}</Text>
      <Text style={[styles.totalValue, { color }, bold && styles.totalValueBold]}>
        {prefix}${formatMoney(cents)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Color.surface },
  content: { paddingBottom: Spacing.bottomPad },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Totals card
  totalsCard: {
    marginTop: Spacing.base,
    marginHorizontal: Spacing.base,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: FontSize.body,
    color: Color.textMid,
  },
  totalLabelBold: {
    fontWeight: FontWeight.bold,
    color: Color.textDark,
  },
  totalValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  totalValueBold: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
  },
  netDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Color.borderLight,
  },

  // Section
  sectionTitle: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: Color.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    marginHorizontal: Spacing.base,
  },

  // Breakdown rows
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
  },
  breakdownNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flex: 1,
  },
  breakdownName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    color: Color.textDark,
    flexShrink: 1,
  },
  givingBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    backgroundColor: Color.givingSurface,
  },
  givingBadgeText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: Color.giving,
    letterSpacing: 0.5,
  },
  breakdownAmount: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Color.error,
    marginLeft: Spacing.md,
  },

  // Empty
  emptyText: {
    fontSize: FontSize.body,
    color: Color.textMuted,
    textAlign: "center",
    marginTop: Spacing.xl,
  },
});
