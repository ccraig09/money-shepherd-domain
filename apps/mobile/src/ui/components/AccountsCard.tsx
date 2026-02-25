import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Card } from "./Card";
import { SectionHeader } from "./SectionHeader";
import { Spacing, FontSize, FontWeight, Color, Radius } from "../tokens";
import { formatMoney } from "../../lib/moneyFormat";
import type { Account } from "@money-shepherd/domain";

type Props = {
  accounts: Account[];
};

function isPlaidAccount(account: Account): boolean {
  return account.id.startsWith("plaid-");
}

function isCashAccount(account: Account): boolean {
  return !account.accountType || account.accountType === "depository" || account.accountType === "investment";
}

function isDebtAccount(account: Account): boolean {
  return account.accountType === "credit" || account.accountType === "loan";
}

export function AccountsCard({ accounts }: Props) {
  if (accounts.length === 0) return null;

  const cashAccounts = accounts.filter(isCashAccount);
  const debtAccounts = accounts.filter(isDebtAccount);

  const cashTotal = cashAccounts.reduce((sum, a) => sum + a.balance.cents, 0);
  const debtTotal = debtAccounts.reduce((sum, a) => sum + a.balance.cents, 0);
  const netTotal = cashTotal + debtTotal;
  const netNegative = netTotal < 0;

  return (
    <>
      <SectionHeader title="Accounts" />
      <Card>
        {/* Cash section */}
        {cashAccounts.length > 0 && (
          <>
            <View style={styles.groupHeader}>
              <Text style={styles.groupLabel}>Cash</Text>
              <Text style={styles.groupAmount}>${formatMoney(cashTotal)}</Text>
            </View>
            {cashAccounts.map((account) => (
              <AccountRow key={account.id} account={account} />
            ))}
          </>
        )}

        {/* Debt section */}
        {debtAccounts.length > 0 && (
          <>
            <View style={styles.groupHeader}>
              <Text style={styles.groupLabel}>Debt</Text>
              <Text style={[styles.groupAmount, styles.debtAmount]}>
                ${formatMoney(debtTotal)}
              </Text>
            </View>
            {debtAccounts.map((account) => (
              <AccountRow key={account.id} account={account} />
            ))}
          </>
        )}

        {/* Net total — only show when both sections exist */}
        {cashAccounts.length > 0 && debtAccounts.length > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Net Total</Text>
            <Text
              style={[styles.totalAmount, netNegative && styles.totalAmountNegative]}
            >
              ${formatMoney(netTotal)}
            </Text>
          </View>
        )}

        {/* Single-section total */}
        {(cashAccounts.length === 0 || debtAccounts.length === 0) && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text
              style={[styles.totalAmount, netNegative && styles.totalAmountNegative]}
            >
              ${formatMoney(netTotal)}
            </Text>
          </View>
        )}
      </Card>
    </>
  );
}

function AccountRow({ account }: { account: Account }) {
  const plaid = isPlaidAccount(account);
  const negative = account.balance.cents < 0;

  return (
    <View style={styles.accountRow}>
      <View style={styles.accountInfo}>
        <Text style={styles.accountName} numberOfLines={1}>
          {account.name}
        </Text>
        <View style={[styles.badge, plaid ? styles.badgePlaid : styles.badgeManual]}>
          <Text
            style={[styles.badgeText, plaid ? styles.badgeTextPlaid : styles.badgeTextManual]}
          >
            {plaid ? "Plaid" : "Manual"}
          </Text>
        </View>
      </View>
      <Text style={[styles.accountBalance, negative && styles.accountBalanceNegative]}>
        ${formatMoney(account.balance.cents)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Color.surfaceLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
  },
  groupLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Color.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  groupAmount: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
    color: Color.success,
  },
  debtAmount: {
    color: Color.error,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Color.surfaceLight,
  },
  totalLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: Color.textMid,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  totalAmount: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: Color.textDark,
  },
  totalAmountNegative: {
    color: Color.error,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
  },
  accountInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.sm,
  },
  accountName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    color: Color.textDark,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgePlaid: {
    backgroundColor: Color.primarySurface,
  },
  badgeManual: {
    backgroundColor: Color.surfaceLight,
  },
  badgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  badgeTextPlaid: {
    color: Color.primaryDark,
  },
  badgeTextManual: {
    color: Color.textMuted,
  },
  accountBalance: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Color.success,
    marginLeft: Spacing.md,
  },
  accountBalanceNegative: {
    color: Color.error,
  },
});
