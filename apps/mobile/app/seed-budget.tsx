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
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../src/ui/tokens";
import { useThemedStyles, useTheme } from "@/src/ui/ThemeProvider";

export default function SeedBudgetScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  const state = useAppStore((s) => s.state);
  const seedBudgetFromBalances = useAppStore((s) => s.seedBudgetFromBalances);
  const [seeding, setSeeding] = React.useState(false);

  if (!state) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Only depository/manual accounts contribute to Available to Assign.
  // Credit/loan balances represent debt, not budgetable cash.
  const allDepository = state.accounts.filter(
    (a) => !a.accountType || a.accountType === "depository",
  );

  // Re-seed mode: budget already seeded, show only new (unseeded) accounts
  const seededIds = new Set(state.seededAccountIds ?? []);
  const isReseed = state.budgetSeeded === true && seededIds.size > 0;

  const accounts = isReseed
    ? allDepository.filter((a) => !seededIds.has(a.id))
    : allDepository;

  const newAccountsCents = accounts.reduce((sum, a) => sum + a.balance.cents, 0);
  const accountIds = accounts.map((a) => a.id);

  // First seed: Available = bank balances minus money already in envelopes.
  // The seed command marks historical income txs as applied so recompute
  // won't re-add them on top (prevents double-counting).
  const availableCents = state.budget.availableToAssign.cents;
  const totalInEnvelopes = state.budget.envelopes.reduce(
    (sum, e) => sum + e.balance.cents,
    0,
  );
  const allDepositoryTotal = allDepository.reduce((sum, a) => sum + a.balance.cents, 0);
  const correctedCents = newAccountsCents - totalInEnvelopes;
  // Re-seed recalculates from truth: all depository balances minus money in envelopes.
  const reseedCorrectedCents = Math.max(0, allDepositoryTotal - totalInEnvelopes);
  const isOvercounted = !isReseed && availableCents > newAccountsCents;
  const isOverAllocated = !isReseed && correctedCents < 0;

  async function handleSeed() {
    setSeeding(true);
    try {
      if (isReseed) {
        // Re-seed: recalculate from truth — all depository balances minus envelopes.
        // Never add additively; always recompute to prevent inflation.
        await seedBudgetFromBalances({
          totalCents: reseedCorrectedCents,
          accountIds: allDepository.map((a) => a.id),
        });
      } else {
        // First seed / reset: set Available to bank balances minus envelopes.
        // The command also marks income txs as applied (no double-counting).
        await seedBudgetFromBalances({
          totalCents: Math.max(0, correctedCents),
          accountIds,
        });
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

  const seedAmount = isReseed ? reseedCorrectedCents : Math.max(0, correctedCents);
  // Re-seed: allow if there are any depository accounts to reconcile (not just unseeded ones).
  // First-seed: require at least some account balance to seed from.
  const canSeed = isReseed
    ? reseedCorrectedCents >= 0 && allDepository.length > 0 && !seeding
    : seedAmount >= 0 && newAccountsCents > 0 && !isOverAllocated && !seeding;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {isReseed ? "New Accounts Connected" : "Seed Your Budget"}
        </Text>
        <Text style={styles.subtitle}>
          {isReseed
            ? "Add your new account balances to Available to Assign."
            : "Start budgeting with your real bank balances. This sets your Available to Assign so you can allocate money to envelopes."}
        </Text>
      </View>

      {/* Account breakdown */}
      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.listLabel}>
            {isReseed ? "New Accounts" : "Connected Accounts"}
          </Text>
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
          <Text style={styles.totalLabel}>
            {isReseed ? "New Account Balance" : "Combined Balance"}
          </Text>
          <Text style={styles.totalAmount}>${formatMoney(newAccountsCents)}</Text>
        </View>

        {!isReseed && totalInEnvelopes > 0 && (
          <View style={styles.deltaRow}>
            <Text style={styles.deltaLabel}>Already in Envelopes</Text>
            <Text style={styles.deltaValue}>
              ${formatMoney(totalInEnvelopes)}
            </Text>
          </View>
        )}

        {!isReseed && totalInEnvelopes > 0 && (
          <View style={[styles.totalRow, styles.seedRow]}>
            <Text style={styles.seedLabel}>Available to Assign</Text>
            <Text style={styles.seedAmount}>
              ${formatMoney(Math.max(0, correctedCents))}
            </Text>
          </View>
        )}

        {isOvercounted && (
          <Text style={styles.noteText}>
            Your Available to Assign was higher than your bank balances because
            income was counted alongside balances. This will reset it to match
            your actual balance.
          </Text>
        )}

        {isOverAllocated && (
          <Text style={styles.warningText}>
            You have more in envelopes (${formatMoney(totalInEnvelopes)}) than
            your bank balances (${formatMoney(newAccountsCents)}). De-allocate
            from envelopes before seeding.
          </Text>
        )}

        <Pressable
          onPress={handleSeed}
          disabled={!canSeed}
          style={[styles.seedBtn, !canSeed && styles.seedBtnDisabled]}
          accessibilityLabel={`${isReseed ? "Add" : isOvercounted ? "Reset to" : "Start with"} ${formatMoney(seedAmount)} dollars`}
          accessibilityRole="button"
        >
          {seeding ? (
            <ActivityIndicator color={colors.textOnColor} size="small" />
          ) : (
            <Text style={styles.seedBtnText}>
              {isReseed
                ? `Set Available to $${formatMoney(seedAmount)}`
                : isOvercounted
                  ? `Reset to $${formatMoney(seedAmount)}`
                  : `Start with $${formatMoney(seedAmount)}`}
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

const createStyles = (c: ColorTokens) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.surface },
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
    color: c.textDark,
  },
  subtitle: {
    fontSize: FontSize.body,
    color: c.textMid,
    lineHeight: 22,
  },

  list: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.md },
  listLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: c.textMuted,
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
    borderColor: c.borderLight,
  },
  accountInfo: { flex: 1, gap: 2 },
  accountName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    color: c.textDark,
  },
  accountNameMuted: { color: c.textMuted },
  accountBalance: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: c.success,
    marginLeft: Spacing.md,
  },
  accountBalanceMuted: { color: c.textMuted },

  emptyCard: {
    padding: Spacing.lg,
    alignItems: "center",
    backgroundColor: c.surfaceLight,
  },
  emptyText: {
    fontSize: FontSize.body,
    color: c.textMuted,
    textAlign: "center",
  },

  footer: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.bottomPad,
    borderTopWidth: 1,
    borderColor: c.borderLight,
    gap: Spacing.sm,
    backgroundColor: c.surfaceLight,
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
    color: c.textDark,
  },
  totalAmount: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: c.textDark,
  },
  deltaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  deltaLabel: {
    fontSize: FontSize.body,
    color: c.textMuted,
  },
  deltaValue: {
    fontSize: FontSize.body,
    color: c.textMuted,
  },
  seedRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  seedLabel: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: c.primary,
  },
  seedAmount: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: c.primary,
  },
  noteText: {
    fontSize: FontSize.small,
    color: c.textMuted,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: Spacing.sm,
  },
  warningText: {
    fontSize: FontSize.small,
    color: c.error,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: Spacing.sm,
  },
  seedBtn: {
    backgroundColor: c.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.sm,
    shadowColor: c.shadowColor,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  seedBtnDisabled: { opacity: 0.4 },
  seedBtnText: {
    color: c.textOnColor,
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  skipText: {
    fontSize: FontSize.body,
    color: c.textMuted,
  },
});
