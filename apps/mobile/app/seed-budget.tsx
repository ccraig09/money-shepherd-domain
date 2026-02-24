import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useAppStore } from "../src/store/useAppStore";
import { formatMoney } from "../src/lib/moneyFormat";
import { Card } from "../src/ui/components/Card";
import { Spacing, Radius, FontSize, FontWeight, Color, Shadow } from "../src/ui/tokens";

export default function SeedBudgetScreen() {
  const state = useAppStore((s) => s.state);
  const seedBudgetFromBalances = useAppStore((s) => s.seedBudgetFromBalances);
  const [seeding, setSeeding] = React.useState(false);

  if (!state) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Color.primary} />
      </View>
    );
  }

  const accounts = state.accounts;
  const totalCents = accounts.reduce((sum, a) => sum + a.balance.cents, 0);
  const availableCents = state.budget.availableToAssign.cents;

  // If user already has funds allocated, show delta
  const hasDelta = availableCents > 0;
  const deltaCents = totalCents - availableCents;

  async function handleSeed() {
    setSeeding(true);
    try {
      if (hasDelta && deltaCents > 0) {
        // Already has some available — seed with the delta
        await seedBudgetFromBalances({ totalCents: deltaCents });
      } else {
        await seedBudgetFromBalances({ totalCents });
      }
      router.dismissAll();
    } catch {
      // Error handled by store — toast will show
      setSeeding(false);
    }
  }

  function handleSkip() {
    // Just dismiss — don't set budgetSeeded so the prompt returns
    // when more accounts are added or from the Dashboard nudge
    router.back();
  }

  const seedAmount = hasDelta ? deltaCents : totalCents;
  const canSeed = seedAmount > 0 && !seeding;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Seed Your Budget</Text>
        <Text style={styles.subtitle}>
          Start budgeting with your real bank balances. This sets your Available
          to Assign so you can allocate money to envelopes.
        </Text>
      </View>

      {/* Account breakdown */}
      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.listLabel}>Connected Accounts</Text>
        }
        renderItem={({ item }) => {
          const isZero = item.balance.cents === 0;
          return (
            <View style={styles.accountRow}>
              <View style={styles.accountInfo}>
                <Text
                  style={[styles.accountName, isZero && styles.accountNameMuted]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </View>
              <Text
                style={[
                  styles.accountBalance,
                  isZero && styles.accountBalanceMuted,
                ]}
              >
                ${formatMoney(item.balance.cents)}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No accounts connected yet. Connect a bank first.
            </Text>
          </Card>
        }
      />

      {/* Total + action */}
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Combined Balance</Text>
          <Text style={styles.totalAmount}>${formatMoney(totalCents)}</Text>
        </View>

        {hasDelta && (
          <View style={styles.deltaRow}>
            <Text style={styles.deltaLabel}>Already in Available</Text>
            <Text style={styles.deltaValue}>
              − ${formatMoney(availableCents)}
            </Text>
          </View>
        )}

        {hasDelta && (
          <View style={[styles.totalRow, styles.seedRow]}>
            <Text style={styles.seedLabel}>Amount to add</Text>
            <Text style={styles.seedAmount}>
              ${formatMoney(Math.max(0, deltaCents))}
            </Text>
          </View>
        )}

        <Pressable
          onPress={handleSeed}
          disabled={!canSeed}
          style={[styles.seedBtn, !canSeed && styles.seedBtnDisabled]}
          accessibilityLabel={`Start with ${formatMoney(seedAmount)} dollars`}
          accessibilityRole="button"
        >
          {seeding ? (
            <ActivityIndicator color={Color.textOnColor} size="small" />
          ) : (
            <Text style={styles.seedBtnText}>
              {seedAmount > 0
                ? `Start with $${formatMoney(seedAmount)}`
                : "Nothing to seed"}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={handleSkip}
          style={styles.skipBtn}
          accessibilityLabel="Skip for now"
          accessibilityRole="button"
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Color.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.extrabold,
    color: Color.textDark,
  },
  subtitle: {
    fontSize: FontSize.body,
    color: Color.textMid,
    lineHeight: 22,
  },

  list: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.md },
  listLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: Color.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },

  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
  },
  accountInfo: { flex: 1, gap: 2 },
  accountName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    color: Color.textDark,
  },
  accountNameMuted: { color: Color.textMuted },
  accountBalance: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Color.success,
    marginLeft: Spacing.md,
  },
  accountBalanceMuted: { color: Color.textMuted },

  emptyCard: {
    padding: Spacing.lg,
    alignItems: "center",
    backgroundColor: Color.surfaceLight,
  },
  emptyText: {
    fontSize: FontSize.body,
    color: Color.textMuted,
    textAlign: "center",
  },

  footer: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.bottomPad,
    borderTopWidth: 1,
    borderColor: Color.borderLight,
    gap: Spacing.sm,
    backgroundColor: Color.surfaceLight,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  totalLabel: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.semibold,
    color: Color.textDark,
  },
  totalAmount: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: Color.textDark,
  },
  deltaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  deltaLabel: {
    fontSize: FontSize.body,
    color: Color.textMuted,
  },
  deltaValue: {
    fontSize: FontSize.body,
    color: Color.textMuted,
  },
  seedRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: Color.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  seedLabel: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: Color.primary,
  },
  seedAmount: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: Color.primary,
  },
  seedBtn: {
    backgroundColor: Color.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.sm,
    ...Shadow.sm,
  },
  seedBtnDisabled: { opacity: 0.4 },
  seedBtnText: {
    color: Color.textOnColor,
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  skipText: {
    fontSize: FontSize.body,
    color: Color.textMuted,
  },
});
