import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { useAppStore } from "@/src/store/useAppStore";
import { formatMoney } from "@/src/lib/moneyFormat";
import { Card } from "@/src/ui/components/Card";
import { HelpTooltip } from "@/src/ui/components/HelpTooltip";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "@/src/ui/tokens";
import { useThemedStyles } from "@/src/ui/ThemeProvider";
import { suggestEnvelope, detectRecurring, normalizePayee, isBnplTransaction, type Transaction, type EnvelopeSuggestion } from "@money-shepherd/domain";
import { Features } from "@/src/config/features";

export default function InboxScreen() {
  const styles = useThemedStyles(createStyles);
  const state = useAppStore((s) => s.state);
  const confirmAllSuggestions = useAppStore((s) => s.confirmAllSuggestions);
  const categorizeInbox = useAppStore((s) => s.categorizeInbox);
  const showToast = useAppStore((s) => s.showToast);
  const [aiLoading, setAiLoading] = useState(false);

  const inboxItems = useMemo(() => {
    if (!state) return [];
    const txById = Object.fromEntries(
      state.transactions.map((tx) => [tx.id, tx]),
    );
    return state.inbox.unassignedTransactionIds
      .map((id) => txById[id])
      .filter((tx): tx is Transaction => tx !== undefined && tx.amount.cents < 0);
  }, [state]);

  const recurringPatterns = useMemo(() => {
    if (!state) return [];
    const assignments = state.inbox.assignmentsByTransactionId;
    const txById = Object.fromEntries(
      state.transactions.map((tx) => [tx.id, tx]),
    );
    const history = Object.entries(assignments)
      .map(([txId, assignment]) => {
        const tx = txById[txId];
        if (!tx) return null;
        return {
          normalizedPayee: normalizePayee(tx.description),
          envelopeId: assignment.envelopeId,
          amountCents: tx.amount.cents,
          postedAt: tx.postedAt,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null && e.normalizedPayee !== "");
    return detectRecurring(history);
  }, [state]);

  const suggestions = useMemo(() => {
    if (!state) return new Map<string, EnvelopeSuggestion>();
    const payeeMappings = state.payeeMappings ?? {};
    const rules = state.assignmentRules ?? [];
    const aiMappings = state.aiPayeeMappings ?? {};
    const envelopeNames = Object.fromEntries(
      state.budget.envelopes.map((e) => [e.id, e.name]),
    );
    const result = new Map<string, EnvelopeSuggestion>();
    for (const tx of inboxItems) {
      const suggestion = suggestEnvelope({
        description: tx.description,
        payeeMappings,
        rules,
        recurringPatterns,
        aiMappings,
      });
      if (suggestion && Object.hasOwn(envelopeNames, suggestion.envelopeId)) {
        result.set(tx.id, suggestion);
      }
    }
    return result;
  }, [state, inboxItems, recurringPatterns]);

  const handleAiCategorize = useCallback(async () => {
    setAiLoading(true);
    try {
      const { mapped } = await categorizeInbox();
      if (mapped > 0) {
        showToast(`✦ AI mapped ${mapped} merchant${mapped === 1 ? "" : "s"}`, "success");
      } else {
        showToast("No new merchants to categorize", "info");
      }
    } catch {
      showToast("AI categorization failed", "error");
    } finally {
      setAiLoading(false);
    }
  }, [categorizeInbox, showToast]);

  // Count inbox items that have no suggestion yet (AI button is useful for these)
  const uncategorizedCount = useMemo(() => {
    return inboxItems.filter((tx) => !suggestions.has(tx.id)).length;
  }, [inboxItems, suggestions]);

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
        <View style={styles.headerLeft}>
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
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Close inbox"
          accessibilityRole="button"
        >
          <Text style={styles.closeBtn}>✕</Text>
        </Pressable>
      </View>

      {suggestions.size > 0 && (
        <Pressable
          style={styles.confirmAllBtn}
          onPress={() => {
            const assignments = Array.from(suggestions.entries()).map(
              ([txId, s]) => ({ transactionId: txId, envelopeId: s.envelopeId }),
            );
            confirmAllSuggestions(assignments);
          }}
        >
          <Text style={styles.confirmAllText}>
            Confirm All ({suggestions.size})
          </Text>
        </Pressable>
      )}

      {Features.AI_ADVISOR && uncategorizedCount > 0 && (
        <Pressable
          style={[styles.aiBtn, aiLoading && styles.aiBtnDisabled]}
          onPress={handleAiCategorize}
          disabled={aiLoading}
          accessibilityLabel="AI categorize unassigned transactions"
        >
          {aiLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.aiBtnText}>✦ AI Categorize ({uncategorizedCount})</Text>
          )}
        </Pressable>
      )}

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
            const isBnpl = isBnplTransaction(item.description ?? "");
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
                  {suggestion && suggestedEnvelopeName && (
                    <View
                      style={[
                        styles.suggestionBadge,
                        suggestion.confidence === "high"
                          ? styles.suggestionBadgeHigh
                          : suggestion.source === "ai"
                          ? styles.suggestionBadgeAi
                          : styles.suggestionBadgeMedium,
                      ]}
                      accessibilityLabel={`Suggested: ${suggestedEnvelopeName}`}
                    >
                      <Text style={styles.suggestionBadgeText}>
                        {suggestion.source === "ai" ? "✦ " : "→ "}{suggestedEnvelopeName}
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

const createStyles = (c: ColorTokens) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  closeBtn: {
    fontSize: FontSize.subtitle,
    color: c.textMid,
    fontWeight: FontWeight.semibold,
  },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold, color: c.textDark },
  badge: {
    backgroundColor: c.error,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: "center",
  },
  badgeText: { color: c.textOnColor, fontSize: FontSize.caption, fontWeight: FontWeight.bold },
  empty: {
    padding: Spacing.lg,
    alignItems: "center",
    backgroundColor: c.surfaceLight,
    gap: Spacing.sm,
  },
  emptyText: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, color: c.success },
  emptyHint: { fontSize: FontSize.body, color: c.textMuted, textAlign: "center" },
  nextActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.sm,
  },
  nextLabel: { fontSize: FontSize.small, color: c.textMuted },
  nextLink: { fontSize: FontSize.small, color: c.primary, fontWeight: FontWeight.semibold },
  nextSep: { fontSize: FontSize.small, color: c.textMuted },
  list: { paddingVertical: Spacing.sm },
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
  suggestionBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    marginTop: 2,
  },
  suggestionBadgeHigh: {
    backgroundColor: c.successSurface,
    borderWidth: 1,
    borderColor: c.success,
  },
  suggestionBadgeMedium: {
    backgroundColor: c.primarySurface,
    borderWidth: 1,
    borderColor: c.primary,
  },
  suggestionBadgeText: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    color: c.primary,
  },
  metaRow: { flexDirection: "row", alignItems: "center" },
  rowAccountName: { fontSize: FontSize.caption, color: c.textMuted, flexShrink: 1 },
  rowAccountDate: { fontSize: FontSize.caption, color: c.textMuted, flexShrink: 0 },
  metaAttribution: { fontSize: FontSize.caption, color: c.textMuted, flexShrink: 0 },
  rowRight: { alignItems: "flex-end", gap: Spacing.xs, marginLeft: Spacing.md, paddingTop: 2 },
  rowAmount: { fontSize: FontSize.subtitle, fontWeight: FontWeight.semibold },
  income: { color: c.success },
  expense: { color: c.error },
  assignHint: { fontSize: FontSize.caption, color: c.textMuted },
  infoBtn: {
    marginLeft: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceLight,
    marginTop: 2,
  },
  infoBtnText: { fontSize: FontSize.body, color: c.textMuted },
  confirmAllBtn: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: c.success,
    alignItems: "center",
  },
  confirmAllText: {
    color: c.textOnColor,
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
  },
  aiBtn: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: c.primary,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  aiBtnDisabled: {
    opacity: 0.6,
  },
  aiBtnText: {
    color: c.textOnColor,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  suggestionBadgeAi: {
    backgroundColor: c.primarySurface,
    borderWidth: 1,
    borderColor: c.primary,
  },
});
