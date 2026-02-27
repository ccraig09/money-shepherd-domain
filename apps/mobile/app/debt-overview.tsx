import React, { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { useAppStore } from "../src/store/useAppStore";
import { formatMoney } from "../src/lib/moneyFormat";
import { Card } from "../src/ui/components/Card";
import { DebtProgressBar } from "../src/ui/components/DebtProgressBar";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../src/ui/tokens";

export default function DebtOverviewScreen() {
  const state = useAppStore((s) => s.state);

  const debtEnvelopes = useMemo(() => {
    if (!state) return [];
    return state.budget.envelopes
      .filter((e) => e.type === "debt")
      .sort((a, b) => (a.target?.cents ?? 0) - (b.target?.cents ?? 0));
  }, [state]);

  const totalDebtCents = useMemo(
    () => debtEnvelopes.reduce((sum, e) => sum + (e.target?.cents ?? 0), 0),
    [debtEnvelopes],
  );

  const totalSetAsideCents = useMemo(
    () => debtEnvelopes.reduce((sum, e) => sum + e.balance.cents, 0),
    [debtEnvelopes],
  );

  const progressPct = totalDebtCents > 0
    ? Math.min(100, Math.round((totalSetAsideCents / totalDebtCents) * 100))
    : 0;

  const milestoneText = useMemo(() => {
    if (progressPct >= 100) return "Debt free!";
    if (progressPct >= 75) return "Almost free!";
    if (progressPct >= 50) return "Halfway there!";
    if (progressPct >= 25) return "Quarter way!";
    return "Every dollar counts";
  }, [progressPct]);

  // Rough months-to-freedom estimate (only when all debts have goals)
  const monthsToFreedom = useMemo(() => {
    if (debtEnvelopes.length === 0) return null;
    const allHaveGoals = debtEnvelopes.every((e) => e.goal && e.goal.cents > 0);
    if (!allHaveGoals) return null;
    const totalMonthlyGoalCents = debtEnvelopes.reduce((sum, e) => sum + (e.goal?.cents ?? 0), 0);
    if (totalMonthlyGoalCents <= 0) return null;
    const remainingCents = Math.max(0, totalDebtCents - totalSetAsideCents);
    if (remainingCents === 0) return null;
    return Math.ceil(remainingCents / totalMonthlyGoalCents);
  }, [debtEnvelopes, totalDebtCents, totalSetAsideCents]);

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (debtEnvelopes.length === 0) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Debt Freedom</Text>
        </View>
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No debts tracked yet</Text>
          <Text style={styles.emptyBody}>
            Create an envelope with the Debt type to start tracking your payoff journey.
          </Text>
          <Pressable
            onPress={() => router.push("/create-envelope")}
            style={styles.emptyBtn}
            accessibilityLabel="Create debt envelope"
          >
            <Text style={styles.emptyBtnText}>Create Debt Envelope</Text>
          </Pressable>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Debt Freedom</Text>
        <Text style={styles.subtitle}>
          {debtEnvelopes.length} {debtEnvelopes.length === 1 ? "debt" : "debts"} — snowball order
        </Text>
      </View>

      {/* Summary card — progress-first */}
      <Card style={styles.summaryCard}>
        {totalDebtCents > 0 && (
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progressPct}%` }]}
            />
          </View>
        )}
        <Text style={styles.summaryHero}>{progressPct}% Paid Off</Text>
        <Text style={styles.summaryMilestone}>{milestoneText}</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatLabel}>Set aside</Text>
            <Text style={styles.summaryStatValueSuccess}>${formatMoney(totalSetAsideCents)}</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatLabel}>Remaining</Text>
            <Text style={styles.summaryStatValue}>
              ${formatMoney(Math.max(0, totalDebtCents - totalSetAsideCents))}
            </Text>
          </View>
        </View>

        <Text style={styles.summaryTotalCaption}>
          Total debt: ${formatMoney(totalDebtCents)}
        </Text>
      </Card>

      {monthsToFreedom !== null && (
        <Text style={styles.estimateText}>
          At your current pace: ~{monthsToFreedom} {monthsToFreedom === 1 ? "month" : "months"} to debt freedom
        </Text>
      )}

      {/* Debt list */}
      <Card style={styles.listCard}>
        <FlatList
          data={debtEnvelopes}
          keyExtractor={(e) => e.id}
          scrollEnabled={false}
          renderItem={({ item, index }) => {
            const targetCents = item.target?.cents ?? 0;
            const balanceCents = item.balance.cents;

            return (
              <Pressable
                style={styles.row}
                onPress={() =>
                  router.push({ pathname: "/envelope/[envelopeId]", params: { envelopeId: item.id } })
                }
                accessibilityLabel={`${item.name} debt envelope`}
                accessibilityRole="button"
              >
                <View style={styles.rowTop}>
                  <View style={styles.rowLeft}>
                    <View style={styles.orderBadge}>
                      <Text style={styles.orderText}>{index + 1}</Text>
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                      {targetCents > 0 && (
                        <Text style={styles.rowTarget}>
                          ${formatMoney(balanceCents)} of ${formatMoney(targetCents)}
                        </Text>
                      )}
                      {targetCents === 0 && (
                        <Text style={styles.rowTargetMissing}>No target set</Text>
                      )}
                    </View>
                  </View>
                </View>
                {targetCents > 0 ? (
                  <View style={styles.rowProgress}>
                    <DebtProgressBar paidCents={balanceCents} targetCents={targetCents} />
                  </View>
                ) : (
                  <Text style={styles.rowBalance}>${formatMoney(balanceCents)}</Text>
                )}
              </Pressable>
            );
          }}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Color.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.border,
  },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold, color: Color.textDark },
  subtitle: { fontSize: FontSize.small, color: Color.textMuted, marginTop: Spacing.xs },

  // Summary — progress-first
  summaryCard: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    alignItems: "center" as const,
  },
  summaryHero: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.extrabold,
    color: Color.primary,
    marginTop: Spacing.md,
  },
  summaryMilestone: {
    fontSize: FontSize.small,
    color: Color.textMuted,
    marginTop: Spacing.xs,
  },
  summaryRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignSelf: "stretch" as const,
    marginTop: Spacing.base,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
  },
  summaryStat: { alignItems: "center" as const, flex: 1 },
  summaryStatLabel: { fontSize: FontSize.small, color: Color.textMuted },
  summaryStatValue: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Color.textMid, marginTop: 2 },
  summaryStatValueSuccess: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Color.success, marginTop: 2 },
  summaryTotalCaption: {
    fontSize: FontSize.caption,
    color: Color.textMuted,
    marginTop: Spacing.md,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Color.borderLight,
    alignSelf: "stretch" as const,
    overflow: "hidden" as const,
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Color.primary,
  },
  estimateText: {
    fontSize: FontSize.small,
    color: Color.textMuted,
    textAlign: "center" as const,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
  },

  // Empty state
  emptyCard: {
    margin: Spacing.base,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.md,
  },
  emptyTitle: { fontSize: FontSize.subtitle, fontWeight: FontWeight.semibold, color: Color.textDark },
  emptyBody: { fontSize: FontSize.body, color: Color.textMuted, textAlign: "center" },
  emptyBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Color.debt,
  },
  emptyBtnText: { color: Color.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },

  // List
  listCard: { marginHorizontal: Spacing.base },
  row: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
    gap: Spacing.sm,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: Spacing.md },
  rowProgress: { marginLeft: 40 },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Color.debtSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  orderText: { fontSize: FontSize.small, fontWeight: FontWeight.bold, color: Color.debt },
  rowInfo: { flex: 1 },
  rowName: { fontSize: FontSize.body, fontWeight: FontWeight.medium, color: Color.textDark },
  rowTarget: { fontSize: FontSize.caption, color: Color.textMuted, marginTop: 2 },
  rowTargetMissing: { fontSize: FontSize.caption, color: Color.textSubtle, fontStyle: "italic", marginTop: 2 },
  rowBalance: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Color.textDark, marginLeft: 40 },
});
