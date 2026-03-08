import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  SectionList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";
import { formatMoney } from "../../src/lib/moneyFormat";
import { formatTimeAgo } from "../../src/lib/timeAgo";
import { groupByDate } from "../../src/lib/dateGroup";
import { InlineNotice } from "../../src/ui/components/InlineNotice";
import { Card } from "../../src/ui/components/Card";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../../src/ui/tokens";
import { useThemedStyles, useTheme } from "@/src/ui/ThemeProvider";
import { Features } from "../../src/config/features";
import { isBnplTransaction } from "@money-shepherd/domain";

export default function TransactionsScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const state = useAppStore((s) => s.state);
  const refreshFromPlaid = useAppStore((s) => s.refreshFromPlaid);
  const lastPlaidRefreshAt = useAppStore((s) => s.lastPlaidRefreshAt);
  const plaidSyncError = useAppStore((s) => s.plaidSyncError);
  const clearPlaidSyncError = useAppStore((s) => s.clearPlaidSyncError);
  const showToast = useAppStore((s) => s.showToast);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Re-render every 30s so "Xm ago" stays fresh
  const [, setTick] = useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    const slowTimer = setTimeout(() => {
      showToast("Plaid sync is taking longer than usual. Try again later.", "info");
    }, 15_000);
    try {
      const result = await refreshFromPlaid();
      if (result.shouldSeedBudget) {
        setTimeout(() => router.push("/seed-budget"), 300);
      }
    } finally {
      clearTimeout(slowTimer);
      setRefreshing(false);
    }
  }

  const accounts = state?.accounts ?? [];
  function accountName(accountId: string): string {
    return accounts.find((a) => a.id === accountId)?.name ?? accountId;
  }

  const sections = useMemo(() => {
    if (!state) return [];
    let txs = [...state.transactions];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      txs = txs.filter((tx) => {
        const desc = (tx.description || "").toLowerCase();
        const acct = accountName(tx.accountId).toLowerCase();
        return desc.includes(q) || acct.includes(q);
      });
    }

    const sorted = txs.sort(
      (a, b) => b.postedAt.localeCompare(a.postedAt),
    );
    return groupByDate(sorted);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, searchQuery]);

  const assignedTxIds = useMemo(
    () => {
      if (!state) return new Set<string>();
      return new Set(
        Object.values(state.inbox.assignmentsByTransactionId).map((a) => a.transactionId),
      );
    },
    [state],
  );

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Transactions</Text>
          {Features.PLAID && lastPlaidRefreshAt && (
            <Text style={styles.lastSynced}>
              Last synced {formatTimeAgo(lastPlaidRefreshAt)}
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {Features.PLAID && (
            <Pressable
              onPress={handleRefresh}
              style={[styles.refreshBtn, refreshing && styles.refreshBtnDisabled]}
              accessibilityLabel="Refresh from Plaid"
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.refreshBtnSyncing}>Syncing…</Text>
                </>
              ) : (
                <Text style={styles.refreshBtnText}>↻ Sync</Text>
              )}
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push("/add-transaction")}
            style={styles.addBtn}
            accessibilityLabel="Add transaction"
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        </View>
      </View>

      {Features.PLAID && plaidSyncError && (
        <InlineNotice
          variant={plaidSyncError.category === "not-connected" ? "info" : plaidSyncError.category === "unknown" ? "error" : "warning"}
          message={plaidSyncError.message}
          actionLabel={plaidSyncError.cta}
          onAction={() => {
            clearPlaidSyncError();
            if (plaidSyncError.category === "network" || plaidSyncError.category === "unknown") {
              handleRefresh();
            } else {
              router.push("/settings/connect-accounts");
            }
          }}
        />
      )}

      {/* Search bar */}
      {state.transactions.length > 0 && (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search transactions..."
            placeholderTextColor={colors.textSubtle}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            returnKeyType="search"
            accessibilityLabel="Search transactions"
          />
        </View>
      )}

      {state.transactions.length === 0 ? (
        <Card style={styles.empty}>
          <Text style={styles.emptyText}>No transactions yet.</Text>
          <Pressable
            onPress={() => router.push("/add-transaction")}
            style={styles.emptyBtn}
            accessibilityLabel="Add your first transaction"
          >
            <Text style={styles.emptyBtnText}>Add your first transaction</Text>
          </Pressable>
        </Card>
      ) : sections.length === 0 && searchQuery.trim() ? (
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>No transactions match your search.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(tx) => tx.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const isExpense = item.amount.cents < 0;
            const desc = item.description || "Manual transaction";
            const hasNote = !!state.transactionNotes?.[item.id];
            const isUnassigned = isExpense && !assignedTxIds.has(item.id);
            const assignment = state.inbox.assignmentsByTransactionId[item.id];
            const assignedByName = assignment
              ? (state.users?.find((u) => u.id === assignment.assignedByUserId)?.displayName ?? null)
              : null;
            const createdByName = !assignedByName && item.createdByUserId
              ? (state.users?.find((u) => u.id === item.createdByUserId)?.displayName ?? null)
              : null;
            const attributionName = assignedByName ?? createdByName;
            const isBnpl = isBnplTransaction(item.description ?? "");
            return (
              <Pressable
                style={styles.row}
                onPress={() =>
                  router.push(
                    `/transaction/${item.id}` as any,
                  )
                }
                accessibilityLabel={`View ${desc}`}
                accessibilityRole="button"
              >
                <View style={styles.rowMain}>
                  <View style={styles.descRow}>
                    <Text style={styles.rowDescription} numberOfLines={1}>
                      {desc}
                    </Text>
                    {hasNote && (
                      <View style={styles.noteDot} accessibilityLabel="Has note" />
                    )}
                    {item.isPending && (
                      <View style={styles.pendingBadge} accessibilityLabel="Pending transaction">
                        <Text style={styles.pendingBadgeText}>Pending</Text>
                      </View>
                    )}
                    {item.id.startsWith("plaid-") && !item.isPending && (
                      <View style={styles.bankBadge} accessibilityLabel="Bank transaction">
                        <Text style={styles.bankBadgeText}>Bank</Text>
                      </View>
                    )}
                    {isBnpl && (
                      <View style={styles.bnplBadge} accessibilityLabel="Buy now pay later">
                        <Text style={styles.bnplBadgeText}>BNPL</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.rowAccountName} numberOfLines={1}>
                      {accountName(item.accountId)}
                    </Text>
                    {attributionName && (
                      <Text style={styles.metaAttribution}>
                        {" · by "}{attributionName}
                      </Text>
                    )}
                  </View>
                  {isUnassigned && (
                    <View style={styles.unassignedBadge} accessibilityLabel="Unassigned">
                      <Text style={styles.unassignedBadgeText}>Unassigned</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.rowAmount,
                    isExpense ? styles.expense : styles.income,
                    item.isPending && styles.pendingAmount,
                  ]}
                >
                  {isExpense ? "-" : "+"}${formatMoney(Math.abs(item.amount.cents))}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold, color: c.textDark },
  lastSynced: { fontSize: FontSize.caption, color: c.textMuted, marginTop: 2 },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  refreshBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: c.primary,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtnDisabled: { opacity: 0.5 },
  refreshBtnText: { color: c.primary, fontWeight: FontWeight.semibold, fontSize: FontSize.body },
  refreshBtnSyncing: { color: c.primary, fontSize: FontSize.caption, marginTop: 2 },
  addBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: c.primary,
  },
  addBtnText: { color: c.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },
  empty: {
    padding: Spacing.lg,
    alignItems: "center",
    backgroundColor: c.surfaceLight,
    gap: Spacing.sm,
  },
  emptyText: { fontSize: FontSize.subtitle, fontWeight: FontWeight.semibold, color: c.textDark, textAlign: "center" },
  emptyBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: c.primary,
  },
  emptyBtnText: { color: c.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },
  // Search
  searchBar: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
  },
  searchInput: {
    backgroundColor: c.surfaceLight,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.body,
    color: c.textDark,
  },
  noResults: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.xl,
  },
  noResultsText: {
    fontSize: FontSize.body,
    color: c.textMuted,
  },

  list: { paddingBottom: Spacing.bottomPad },

  // Section headers
  sectionHeader: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.xs,
    backgroundColor: c.surface,
  },
  sectionHeaderText: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: c.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },

  // Rows
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
  },
  rowMain: { flex: 1, gap: Spacing.xs, paddingRight: Spacing.sm },
  descRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  rowDescription: { fontSize: FontSize.body, fontWeight: FontWeight.medium, color: c.textDark, flexShrink: 1 },
  noteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.primary,
    flexShrink: 0,
  },
  metaRow: { flexDirection: "row", alignItems: "center" },
  rowAccountName: { fontSize: FontSize.caption, color: c.textMuted, flexShrink: 1 },
  metaAttribution: { fontSize: FontSize.caption, color: c.textMuted, flexShrink: 0 },
  pendingBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    backgroundColor: c.surfaceLight,
    borderWidth: 1,
    borderColor: c.borderLight,
    borderStyle: "dashed" as const,
  },
  pendingBadgeText: { fontSize: 10, fontWeight: FontWeight.semibold, color: c.textMuted },
  pendingAmount: { opacity: 0.5 },
  bankBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    backgroundColor: c.surfaceLight,
    borderWidth: 1,
    borderColor: c.borderLight,
  },
  bankBadgeText: { fontSize: 10, fontWeight: FontWeight.semibold, color: c.textMuted },
  bnplBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    backgroundColor: c.debtSurface,
    borderWidth: 1,
    borderColor: c.debt,
  },
  bnplBadgeText: { fontSize: 10, fontWeight: FontWeight.semibold, color: c.debt },
  unassignedBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: c.warningSurface,
    borderWidth: 1,
    borderColor: c.borderWarning,
  },
  unassignedBadgeText: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold, color: c.warning },
  rowAmount: { fontSize: FontSize.subtitle, fontWeight: FontWeight.semibold, minWidth: 80, textAlign: "right", paddingTop: 2, flexShrink: 0 },
  income: { color: c.success },
  expense: { color: c.error },
});
