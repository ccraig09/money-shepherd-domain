import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";
import { formatMoney } from "../../src/lib/moneyFormat";
import { formatTimeAgo } from "../../src/lib/timeAgo";
import { InlineNotice } from "../../src/ui/components/InlineNotice";
import { Card } from "../../src/ui/components/Card";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../../src/ui/tokens";

export default function TransactionsScreen() {
  const state = useAppStore((s) => s.state);
  const refreshFromPlaid = useAppStore((s) => s.refreshFromPlaid);
  const lastPlaidRefreshAt = useAppStore((s) => s.lastPlaidRefreshAt);
  const plaidSyncError = useAppStore((s) => s.plaidSyncError);
  const clearPlaidSyncError = useAppStore((s) => s.clearPlaidSyncError);
  const [refreshing, setRefreshing] = useState(false);

  // Re-render every 30s so "Xm ago" stays fresh
  const [, setTick] = useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await refreshFromPlaid();
    setRefreshing(false);
  }

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const accounts = state.accounts;
  const transactions = [...state.transactions].sort(
    (a, b) => b.postedAt.localeCompare(a.postedAt),
  );

  const assignedTxIds = new Set(
    Object.values(state.inbox.assignmentsByTransactionId).map((a) => a.transactionId),
  );

  function accountName(accountId: string): string {
    return accounts.find((a) => a.id === accountId)?.name ?? accountId;
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Transactions</Text>
          {lastPlaidRefreshAt && (
            <Text style={styles.lastSynced}>
              Last synced {formatTimeAgo(lastPlaidRefreshAt)}
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={handleRefresh}
            style={[styles.refreshBtn, refreshing && styles.refreshBtnDisabled]}
            accessibilityLabel="Refresh from Plaid"
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={Color.primary} />
            ) : (
              <Text style={styles.refreshBtnText}>↻ Sync</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push("/add-transaction")}
            style={styles.addBtn}
            accessibilityLabel="Add transaction"
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        </View>
      </View>

      {plaidSyncError && (
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

      {transactions.length === 0 ? (
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
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(tx) => tx.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isExpense = item.amount.cents < 0;
            const desc = item.description || "Manual transaction";
            const hasNote = !!state.transactionNotes?.[item.id];
            const isUnassigned = isExpense && !assignedTxIds.has(item.id);
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
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.rowAccountName} numberOfLines={1}>
                      {accountName(item.accountId)}
                    </Text>
                    <Text style={styles.rowAccountDate}>
                      {" · "}{formatDate(item.postedAt)}
                    </Text>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Color.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.border,
  },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold, color: Color.textDark },
  lastSynced: { fontSize: FontSize.caption, color: Color.textMuted, marginTop: 2 },
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
    borderColor: Color.primary,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtnDisabled: { opacity: 0.5 },
  refreshBtnText: { color: Color.primary, fontWeight: FontWeight.semibold, fontSize: FontSize.body },
  addBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Color.primary,
  },
  addBtnText: { color: Color.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },
  empty: {
    padding: Spacing.lg,
    alignItems: "center",
    backgroundColor: Color.surfaceLight,
    gap: Spacing.sm,
  },
  emptyText: { fontSize: FontSize.subtitle, fontWeight: FontWeight.semibold, color: Color.textDark, textAlign: "center" },
  emptyBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Color.primary,
  },
  emptyBtnText: { color: Color.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },
  list: { paddingVertical: Spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
  },
  rowMain: { flex: 1, gap: Spacing.xs, paddingRight: Spacing.sm },
  descRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  rowDescription: { fontSize: FontSize.body, fontWeight: FontWeight.medium, color: Color.textDark, flexShrink: 1 },
  noteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Color.primary,
    flexShrink: 0,
  },
  metaRow: { flexDirection: "row", alignItems: "center" },
  rowAccountName: { fontSize: FontSize.caption, color: Color.textMuted, flexShrink: 1 },
  rowAccountDate: { fontSize: FontSize.caption, color: Color.textMuted, flexShrink: 0 },
  unassignedBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Color.warningSurface,
    borderWidth: 1,
    borderColor: Color.borderWarning,
  },
  unassignedBadgeText: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold, color: Color.warning },
  rowAmount: { fontSize: FontSize.subtitle, fontWeight: FontWeight.semibold, minWidth: 80, textAlign: "right", paddingTop: 2 },
  income: { color: Color.success },
  expense: { color: Color.error },
});
