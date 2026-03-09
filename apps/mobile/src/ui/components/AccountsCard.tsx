import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Card } from "./Card";
import { SectionHeader } from "./SectionHeader";
import { Spacing, FontSize, FontWeight, Radius, type ColorTokens } from "../tokens";
import { useThemedStyles } from "../ThemeProvider";
import { formatMoney } from "../../lib/moneyFormat";
import type { Account } from "@money-shepherd/domain";

type UserRef = { id: string; displayName: string };

type Props = {
  accounts: Account[];
  users?: UserRef[];
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

type OwnerGroup = {
  ownerId: string;
  label: string;
  accounts: Account[];
};

function groupByOwner(accounts: Account[], users?: UserRef[]): OwnerGroup[] {
  const byOwner = new Map<string, Account[]>();
  for (const account of accounts) {
    const key = account.ownerUserId ?? "__unknown__";
    const list = byOwner.get(key) ?? [];
    list.push(account);
    byOwner.set(key, list);
  }

  const userMap = new Map(users?.map((u) => [u.id, u.displayName]) ?? []);
  const groups: OwnerGroup[] = [];

  for (const [ownerId, accts] of byOwner) {
    if (ownerId === "__unknown__") continue;
    groups.push({
      ownerId,
      label: userMap.get(ownerId) ?? ownerId,
      accounts: accts,
    });
  }

  // Sort groups alphabetically by label
  groups.sort((a, b) => a.label.localeCompare(b.label));

  // Add unknown group at the end
  const unknownAccounts = byOwner.get("__unknown__");
  if (unknownAccounts) {
    groups.push({ ownerId: "__unknown__", label: "Other", accounts: unknownAccounts });
  }

  return groups;
}

export function AccountsCard({ accounts, users }: Props) {
  if (accounts.length === 0) return null;

  const ownerGroups = groupByOwner(accounts, users);
  const hasMultipleOwners = ownerGroups.length > 1;

  // If only one owner (or no ownerUserId set), render flat like before
  if (!hasMultipleOwners) {
    return (
      <>
        <SectionHeader title="Accounts" />
        <Card>
          <AccountTypeSection accounts={accounts} />
        </Card>
      </>
    );
  }

  return (
    <>
      <SectionHeader title="Accounts" />
      {ownerGroups.map((group) => (
        <OwnerSection key={group.ownerId} group={group} />
      ))}
    </>
  );
}

function OwnerSection({ group }: { group: OwnerGroup }) {
  const styles = useThemedStyles(createStyles);
  const [collapsed, setCollapsed] = useState(false);
  // Show cash total on the header (what matters day-to-day), net total only when expanded
  const cashTotal = group.accounts.filter(isCashAccount).reduce((sum, a) => sum + a.balance.cents, 0);

  return (
    <Card style={styles.ownerCard}>
      <Pressable
        style={styles.ownerHeader}
        onPress={() => setCollapsed((c) => !c)}
        accessibilityRole="button"
        accessibilityLabel={`${group.label}'s accounts, ${collapsed ? "expand" : "collapse"}`}
      >
        <Text style={styles.ownerLabel}>{group.label}</Text>
        <View style={styles.ownerRight}>
          <Text style={[styles.ownerTotal, cashTotal < 0 && styles.ownerTotalNegative]}>
            ${formatMoney(cashTotal)}
          </Text>
          <Text style={styles.chevron}>{collapsed ? "▸" : "▾"}</Text>
        </View>
      </Pressable>
      {!collapsed && <AccountTypeSection accounts={group.accounts} />}
    </Card>
  );
}

function AccountTypeSection({ accounts }: { accounts: Account[] }) {
  const styles = useThemedStyles(createStyles);

  const cashAccounts = accounts.filter(isCashAccount);
  const debtAccounts = accounts.filter(isDebtAccount);

  const cashTotal = cashAccounts.reduce((sum, a) => sum + a.balance.cents, 0);
  const debtTotal = debtAccounts.reduce((sum, a) => sum + a.balance.cents, 0);
  const netTotal = cashTotal + debtTotal;
  const netNegative = netTotal < 0;

  return (
    <>
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
    </>
  );
}

function AccountRow({ account }: { account: Account }) {
  const styles = useThemedStyles(createStyles);
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

const createStyles = (c: ColorTokens) => StyleSheet.create({
  ownerCard: {
    marginBottom: Spacing.sm,
  },
  ownerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
  },
  ownerLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: c.textDark,
  },
  ownerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  ownerTotal: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: c.success,
  },
  ownerTotalNegative: {
    color: c.error,
  },
  chevron: {
    fontSize: FontSize.body,
    color: c.textMuted,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: c.surfaceLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
  },
  groupLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: c.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  groupAmount: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
    color: c.success,
  },
  debtAmount: {
    color: c.error,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: c.surfaceLight,
  },
  totalLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: c.textMid,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  totalAmount: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: c.textDark,
  },
  totalAmountNegative: {
    color: c.error,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
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
    color: c.textDark,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgePlaid: {
    backgroundColor: c.primarySurface,
  },
  badgeManual: {
    backgroundColor: c.surfaceLight,
  },
  badgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  badgeTextPlaid: {
    color: c.primaryDark,
  },
  badgeTextManual: {
    color: c.textMuted,
  },
  accountBalance: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: c.success,
    marginLeft: Spacing.md,
  },
  accountBalanceNegative: {
    color: c.error,
  },
});
