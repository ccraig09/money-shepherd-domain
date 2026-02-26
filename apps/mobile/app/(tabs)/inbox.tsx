import React, { useMemo } from "react";
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
import { HelpTooltip } from "../../src/ui/components/HelpTooltip";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../../src/ui/tokens";
import { suggestEnvelope, type Transaction, type EnvelopeSuggestion } from "@money-shepherd/domain";

export default function InboxScreen() {
  const state = useAppStore((s) => s.state);

  const inboxItems = useMemo(() => {
    if (!state) return [];
    const txById = Object.fromEntries(
      state.transactions.map((tx) => [tx.id, tx]),
    );
    return state.inbox.unassignedTransactionIds
      .map((id) => txById[id])
      .filter((tx): tx is Transaction => tx !== undefined && tx.amount.cents < 0);
  }, [state]);

  const suggestions = useMemo(() => {
    if (!state) return new Map<string, EnvelopeSuggestion>();
    const payeeMappings = state.payeeMappings ?? {};
    const rules = state.assignmentRules ?? [];
    const envelopeNames = Object.fromEntries(
      state.budget.envelopes.map((e) => [e.id, e.name]),
    );
    const result = new Map<string, EnvelopeSuggestion>();
    for (const tx of inboxItems) {
      const suggestion = suggestEnvelope({
        description: tx.description,
        payeeMappings,
        rules,
      });
      if (suggestion && Object.hasOwn(envelopeNames, suggestion.envelopeId)) {
        result.set(tx.id, suggestion);
      }
    }
    return result;
  }, [state, inboxItems]);

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

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
        <HelpTooltip
          title="Inbox"
          body="Transactions that haven't been assigned to an envelope yet. Assign them so every dollar has a job."
        />
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
          <View style={styles.nextActions}>
            <Text style={styles.nextLabel}>Next:</Text>
            <Pressable onPress={() => router.push("/add-transaction")} accessibilityRole="link">
              <Text style={styles.nextLink}>Add income to allocate</Text>
            </Pressable>
            <Text style={styles.nextSep}>or</Text>
            <Pressable onPress={() => router.push("/(tabs)/envelopes")} accessibilityRole="link">
              <Text style={styles.nextLink}>view your Envelopes</Text>
            </Pressable>
          </View>
        </Card>
      ) : (
        <FlatList
          data={inboxItems}
          keyExtractor={(tx) => tx.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isExpense = item.amount.cents < 0;
            const desc = item.description || "Manual transaction";
            const suggestion = suggestions.get(item.id);
            const suggestedEnvelopeName = suggestion
              ? state.budget.envelopes.find((e) => e.id === suggestion.envelopeId)?.name
              : undefined;
            return (
              <Pressable
                style={styles.row}
                onPress={() => {
                  router.push({
                    pathname: "/assign-transaction",
                    params: {
                      transactionId: item.id,
                      ...(suggestion && { suggestedEnvelopeId: suggestion.envelopeId }),
                    },
                  });
                }}
                accessibilityLabel={`Assign ${desc}${suggestedEnvelopeName ? `, suggested: ${suggestedEnvelopeName}` : ""}`}
                accessibilityRole="button"
              >
                <View style={styles.rowMain}>
                  <View style={styles.descRow}>
                    <Text style={styles.rowDescription} numberOfLines={1}>
                      {desc}
                    </Text>
                    {item.id.startsWith("plaid-") && (
                      <View style={styles.bankBadge} accessibilityLabel="Bank transaction">
                        <Text style={styles.bankBadgeText}>Bank</Text>
                      </View>
                    )}
                  </View>
                  {suggestion && suggestedEnvelopeName && (
                    <View
                      style={[
                        styles.suggestionBadge,
                        suggestion.confidence === "high"
                          ? styles.suggestionBadgeHigh
                          : styles.suggestionBadgeMedium,
                      ]}
                      accessibilityLabel={`Suggested: ${suggestedEnvelopeName}`}
                    >
                      <Text style={styles.suggestionBadgeText}>
                        → {suggestedEnvelopeName}
                      </Text>
                    </View>
                  )}
                  <View style={styles.metaRow}>
                    <Text style={styles.rowAccountName} numberOfLines={1}>
                      {accountName(item.accountId)}
                    </Text>
                    <Text style={styles.rowAccountDate}>
                      {" · "}{formatDate(item.postedAt)}
                    </Text>
                    {(() => {
                      const creatorName = item.createdByUserId
                        ? (state.users?.find((u) => u.id === item.createdByUserId)?.displayName ?? null)
                        : null;
                      return creatorName ? (
                        <Text style={styles.metaAttribution}>
                          {" · by "}{creatorName}
                        </Text>
                      ) : null;
                    })()}
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
  nextActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.sm,
  },
  nextLabel: { fontSize: FontSize.small, color: Color.textMuted },
  nextLink: { fontSize: FontSize.small, color: Color.primary, fontWeight: FontWeight.semibold },
  nextSep: { fontSize: FontSize.small, color: Color.textMuted },
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
  bankBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    backgroundColor: Color.surfaceLight,
    borderWidth: 1,
    borderColor: Color.borderLight,
  },
  bankBadgeText: { fontSize: 10, fontWeight: FontWeight.semibold, color: Color.textMuted },
  suggestionBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    marginTop: 2,
  },
  suggestionBadgeHigh: {
    backgroundColor: Color.successSurface,
    borderWidth: 1,
    borderColor: Color.success,
  },
  suggestionBadgeMedium: {
    backgroundColor: Color.primarySurface,
    borderWidth: 1,
    borderColor: Color.primary,
  },
  suggestionBadgeText: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    color: Color.primary,
  },
  metaRow: { flexDirection: "row", alignItems: "center" },
  rowAccountName: { fontSize: FontSize.caption, color: Color.textMuted, flexShrink: 1 },
  rowAccountDate: { fontSize: FontSize.caption, color: Color.textMuted, flexShrink: 0 },
  metaAttribution: { fontSize: FontSize.caption, color: Color.textMuted, flexShrink: 0 },
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
