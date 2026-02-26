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

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Debt</Text>
        <Text style={styles.summaryAmount}>${formatMoney(totalDebtCents)}</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatLabel}>Set aside</Text>
            <Text style={styles.summaryStatValue}>${formatMoney(totalSetAsideCents)}</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatLabel}>Remaining</Text>
            <Text style={styles.summaryStatValue}>
              ${formatMoney(Math.max(0, totalDebtCents - totalSetAsideCents))}
            </Text>
          </View>
        </View>
        {totalDebtCents > 0 && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(100, Math.round((totalSetAsideCents / totalDebtCents) * 100))}%` },
              ]}
            />
          </View>
        )}
      </View>

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

  // Summary
  summaryCard: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    marginBottom: Spacing.base,
    backgroundColor: Color.debt,
    borderRadius: Radius.hero,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  summaryLabel: {
    fontSize: FontSize.small,
    color: "rgba(255,255,255,0.75)",
    fontWeight: FontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.extrabold,
    color: Color.textOnColor,
    marginTop: Spacing.xs,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.base,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.3)",
  },
  summaryStat: {},
  summaryStatLabel: { fontSize: FontSize.small, color: "rgba(255,255,255,0.75)" },
  summaryStatValue: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Color.textOnColor, marginTop: 2 },

  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginTop: Spacing.md,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Color.textOnColor,
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
