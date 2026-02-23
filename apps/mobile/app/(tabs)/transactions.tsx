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
              <ActivityIndicator size="small" color="#4f8ef7" />
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
            const meta = `${accountName(item.accountId)} · ${formatDate(item.postedAt)}`;
            return (
              <Pressable
                style={styles.row}
                onPress={() =>
                  router.push(
                    `/transaction/${item.id}` as any,
                  )
                }
                accessibilityLabel={`View ${desc}`}
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
                  <Text style={styles.rowAccount} numberOfLines={1}>
                    {meta}
                  </Text>
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
  title: { fontSize: 24, fontWeight: FontWeight.bold },
  lastSynced: { fontSize: FontSize.caption, color: "#999", marginTop: 2 },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  refreshBtn: {
    paddingHorizontal: 14,
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
    padding: 20,
    alignItems: "center",
    backgroundColor: Color.surfaceLight,
    gap: Spacing.sm,
  },
  emptyText: { fontSize: 17, fontWeight: FontWeight.semibold, color: Color.textDark, textAlign: "center" },
  emptyBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Color.primary,
  },
  emptyBtnText: { color: Color.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },
  list: { paddingVertical: Spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
  },
  rowMain: { flex: 1, gap: 2 },
  descRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowDescription: { fontSize: FontSize.body, fontWeight: FontWeight.medium, color: Color.textDark, flexShrink: 1 },
  noteDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Color.primary,
    flexShrink: 0,
  },
  rowAccount: { fontSize: FontSize.caption, color: Color.textMuted },
  rowAmount: { fontSize: FontSize.subtitle, fontWeight: FontWeight.semibold, minWidth: 80, textAlign: "right" },
  income: { color: Color.success },
  expense: { color: Color.error },
});
