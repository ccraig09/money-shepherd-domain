import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";
import { formatMoney } from "../../src/lib/moneyFormat";
import { Card } from "../../src/ui/components/Card";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../../src/ui/tokens";
import type { Transaction } from "@money-shepherd/domain";

export default function InboxScreen() {
  const state = useAppStore((s) => s.state);

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const txById = Object.fromEntries(
    state.transactions.map((tx) => [tx.id, tx]),
  );

  const inboxItems = state.inbox.unassignedTransactionIds
    .map((id) => txById[id])
    .filter((tx): tx is Transaction => tx !== undefined && tx.amount.cents < 0);

  const accounts = state.accounts;

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
        <Text style={styles.title}>Inbox</Text>
        {inboxItems.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{inboxItems.length}</Text>
          </View>
        )}
      </View>

      {inboxItems.length === 0 ? (
        <Card style={styles.empty}>
          <Text style={styles.emptyText}>Inbox is clear.</Text>
          <Text style={styles.emptyHint}>Assigned transactions will no longer appear here.</Text>
        </Card>
      ) : (
        <FlatList
          data={inboxItems}
          keyExtractor={(tx) => tx.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isExpense = item.amount.cents < 0;
            const desc = item.description || "Manual transaction";
            return (
              <Pressable
                style={styles.row}
                onPress={() => {
                  router.push({
                    pathname: "/assign-transaction",
                    params: { transactionId: item.id },
                  });
                }}
                accessibilityLabel={`Assign ${desc}`}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowDescription} numberOfLines={1}>
                    {desc}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.rowAccountName} numberOfLines={1}>
                      {accountName(item.accountId)}
                    </Text>
                    <Text style={styles.rowAccountDate}>
                      {" · "}{formatDate(item.postedAt)}
                    </Text>
                  </View>
                </View>
                <View style={styles.rowRight}>
                  <Text
                    style={[
                      styles.rowAmount,
                      isExpense ? styles.expense : styles.income,
                    ]}
                  >
                    {isExpense ? "-" : "+"}${formatMoney(Math.abs(item.amount.cents))}
                  </Text>
                  <Text style={styles.assignHint}>Tap to assign →</Text>
                </View>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push(
                      `/transaction/${item.id}` as any,
                    );
                  }}
                  style={styles.infoBtn}
                  accessibilityLabel={`Details for ${desc}`}
                  hitSlop={6}
                >
                  <Text style={styles.infoBtnText}>ⓘ</Text>
                </Pressable>
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
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.border,
  },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold, color: Color.textDark },
  badge: {
    backgroundColor: Color.error,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: "center",
  },
  badgeText: { color: Color.textOnColor, fontSize: FontSize.caption, fontWeight: FontWeight.bold },
  empty: {
    padding: Spacing.lg,
    alignItems: "center",
    backgroundColor: Color.surfaceLight,
    gap: Spacing.sm,
  },
  emptyText: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, color: Color.success },
  emptyHint: { fontSize: FontSize.body, color: Color.textMuted, textAlign: "center" },
  list: { paddingVertical: Spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
  },
  rowMain: { flex: 1, gap: Spacing.xs, paddingRight: Spacing.sm },
  rowDescription: { fontSize: FontSize.body, fontWeight: FontWeight.medium, color: Color.textDark },
  metaRow: { flexDirection: "row", alignItems: "center" },
  rowAccountName: { fontSize: FontSize.caption, color: Color.textMuted, flexShrink: 1 },
  rowAccountDate: { fontSize: FontSize.caption, color: Color.textMuted, flexShrink: 0 },
  rowRight: { alignItems: "flex-end", gap: Spacing.xs, marginLeft: Spacing.md, paddingTop: 2 },
  rowAmount: { fontSize: FontSize.subtitle, fontWeight: FontWeight.semibold },
  income: { color: Color.success },
  expense: { color: Color.error },
  assignHint: { fontSize: FontSize.caption, color: Color.textMuted },
  infoBtn: {
    marginLeft: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.surfaceLight,
    marginTop: 2,
  },
  infoBtnText: { fontSize: FontSize.body, color: Color.textMuted },
});
