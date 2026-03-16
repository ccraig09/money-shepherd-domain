import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  SectionList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppStore } from "../src/store/useAppStore";
import { formatMoney } from "../src/lib/moneyFormat";
import { Card } from "../src/ui/components/Card";
import {
  Spacing,
  Radius,
  FontSize,
  FontWeight,
  type ColorTokens,
} from "../src/ui/tokens";
import { useThemedStyles, useTheme } from "@/src/ui/ThemeProvider";
import {
  suggestEnvelope,
  detectRecurring,
  normalizePayee,
  type Transaction,
  type EnvelopeSuggestion,
} from "@money-shepherd/domain";

type GroupedSection = {
  envelopeId: string;
  envelopeName: string;
  totalCents: number;
  data: { tx: Transaction; suggestionSource: string }[];
};

export default function InboxReviewScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const state = useAppStore((s) => s.state);
  const confirmAllSuggestions = useAppStore((s) => s.confirmAllSuggestions);
  const showToast = useAppStore((s) => s.showToast);

  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [assigning, setAssigning] = useState(false);

  // ── Derive inbox items ────────────────────────────────────────────────
  const inboxItems = useMemo(() => {
    if (!state) return [];
    const txById = Object.fromEntries(
      state.transactions.map((tx) => [tx.id, tx]),
    );
    return state.inbox.unassignedTransactionIds
      .map((id) => txById[id])
      .filter(
        (tx): tx is Transaction => tx !== undefined && tx.amount.cents < 0,
      );
  }, [state]);

  // ── Recurring patterns ────────────────────────────────────────────────
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

  // ── Suggestions map ───────────────────────────────────────────────────
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

  // ── Group by envelope ─────────────────────────────────────────────────
  const sections: GroupedSection[] = useMemo(() => {
    if (!state) return [];
    const envelopeNames = Object.fromEntries(
      state.budget.envelopes.map((e) => [e.id, e.name]),
    );
    const groups = new Map<string, GroupedSection>();

    for (const tx of inboxItems) {
      const suggestion = suggestions.get(tx.id);
      if (!suggestion) continue;
      const { envelopeId, source } = suggestion;
      const name = envelopeNames[envelopeId] ?? "Unknown";

      if (!groups.has(envelopeId)) {
        groups.set(envelopeId, {
          envelopeId,
          envelopeName: name,
          totalCents: 0,
          data: [],
        });
      }
      const group = groups.get(envelopeId)!;
      group.totalCents += Math.abs(tx.amount.cents);
      group.data.push({ tx, suggestionSource: source });
    }

    return Array.from(groups.values()).sort(
      (a, b) => b.totalCents - a.totalCents,
    );
  }, [state, inboxItems, suggestions]);

  // ── Counts ────────────────────────────────────────────────────────────
  const totalCount = useMemo(
    () => sections.reduce((sum, s) => sum + s.data.length, 0),
    [sections],
  );
  const selectedCount = useMemo(
    () =>
      sections.reduce(
        (sum, s) =>
          sum + s.data.filter((d) => !excludedIds.has(d.tx.id)).length,
        0,
      ),
    [sections, excludedIds],
  );

  // ── Toggle handlers ───────────────────────────────────────────────────
  const toggleExclude = useCallback((txId: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  }, []);

  const toggleCollapse = useCallback((envelopeId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(envelopeId)) next.delete(envelopeId);
      else next.add(envelopeId);
      return next;
    });
  }, []);

  // ── Assign handlers ───────────────────────────────────────────────────
  const handleAssign = useCallback(
    async (onlySelected: boolean) => {
      setAssigning(true);
      try {
        const assignments: { transactionId: string; envelopeId: string }[] = [];
        for (const section of sections) {
          for (const { tx } of section.data) {
            if (onlySelected && excludedIds.has(tx.id)) continue;
            assignments.push({
              transactionId: tx.id,
              envelopeId: section.envelopeId,
            });
          }
        }
        if (assignments.length === 0) {
          showToast("No transactions to assign", "info");
          setAssigning(false);
          return;
        }
        await confirmAllSuggestions(assignments);
        const envCount = new Set(assignments.map((a) => a.envelopeId)).size;
        showToast(
          `Assigned ${assignments.length} transaction${assignments.length === 1 ? "" : "s"} to ${envCount} envelope${envCount === 1 ? "" : "s"}`,
          "success",
        );
        router.back();
      } catch {
        showToast("Assignment failed — try again", "error");
        setAssigning(false);
      }
    },
    [sections, excludedIds, confirmAllSuggestions, showToast],
  );

  // ── Loading / empty ───────────────────────────────────────────────────
  if (!state) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Review Assignments</Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.closeBtn}>✕</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            No AI suggestions to review. Run AI Categorize in the inbox first.
          </Text>
        </View>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Review Assignments</Text>
          <Text style={styles.subtitle}>
            {totalCount} transaction{totalCount === 1 ? "" : "s"} across{" "}
            {sections.length} envelope{sections.length === 1 ? "" : "s"}
          </Text>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.closeBtn}>✕</Text>
        </Pressable>
      </View>

      {/* Grouped list */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.tx.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => {
          const isCollapsed = collapsedGroups.has(section.envelopeId);
          const groupSelectedCount = section.data.filter(
            (d) => !excludedIds.has(d.tx.id),
          ).length;
          return (
            <Pressable
              onPress={() => toggleCollapse(section.envelopeId)}
              style={styles.groupHeader}
            >
              <View style={styles.groupHeaderLeft}>
                <Text style={styles.chevron}>
                  {isCollapsed ? "▸" : "▾"}
                </Text>
                <View>
                  <Text style={styles.groupName}>
                    {section.envelopeName}
                  </Text>
                  <Text style={styles.groupMeta}>
                    {groupSelectedCount}/{section.data.length} selected ·{" "}
                    ${formatMoney(section.totalCents)}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        renderItem={({ item, section }) => {
          if (collapsedGroups.has(section.envelopeId)) return null;
          const isExcluded = excludedIds.has(item.tx.id);
          const date = new Date(item.tx.postedAt).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric" },
          );
          return (
            <Pressable
              onPress={() => toggleExclude(item.tx.id)}
              style={[styles.txRow, isExcluded && styles.txRowExcluded]}
            >
              <View style={styles.checkbox}>
                <Text style={styles.checkboxIcon}>
                  {isExcluded ? "☐" : "☑"}
                </Text>
              </View>
              <View style={styles.txInfo}>
                <Text
                  style={[
                    styles.txName,
                    isExcluded && styles.txNameExcluded,
                  ]}
                  numberOfLines={1}
                >
                  {item.tx.description}
                </Text>
                <Text style={styles.txDate}>{date}</Text>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  isExcluded && styles.txAmountExcluded,
                ]}
              >
                ${formatMoney(Math.abs(item.tx.amount.cents))}
              </Text>
            </Pressable>
          );
        }}
        renderSectionFooter={({ section }) => {
          if (collapsedGroups.has(section.envelopeId)) return null;
          return <View style={styles.groupDivider} />;
        }}
      />

      {/* Footer buttons */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.base) }]}>
        {excludedIds.size > 0 ? (
          <Pressable
            onPress={() => handleAssign(true)}
            disabled={assigning || selectedCount === 0}
            style={[
              styles.primaryBtn,
              (assigning || selectedCount === 0) && styles.btnDisabled,
            ]}
          >
            {assigning ? (
              <ActivityIndicator color={colors.textOnColor} size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>
                Assign Selected ({selectedCount})
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={() => handleAssign(false)}
            disabled={assigning}
            style={[styles.primaryBtn, assigning && styles.btnDisabled]}
          >
            {assigning ? (
              <ActivityIndicator color={colors.textOnColor} size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>
                Assign All ({totalCount})
              </Text>
            )}
          </Pressable>
        )}
        <Pressable
          onPress={() => router.back()}
          style={styles.cancelBtn}
          disabled={assigning}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.surface },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: Spacing.lg,
    },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.base,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderLight,
    },
    title: {
      fontSize: FontSize.title,
      fontWeight: FontWeight.extrabold,
      color: c.textDark,
    },
    subtitle: {
      fontSize: FontSize.small,
      color: c.textMuted,
      marginTop: 2,
    },
    closeBtn: {
      fontSize: 20,
      color: c.textMuted,
      paddingHorizontal: Spacing.xs,
      paddingVertical: Spacing.xs,
    },

    // List
    list: {
      paddingHorizontal: Spacing.base,
      paddingBottom: Spacing.lg,
    },

    // Group header
    groupHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: Spacing.md,
      paddingTop: Spacing.lg,
    },
    groupHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      flex: 1,
    },
    chevron: {
      fontSize: 16,
      color: c.textMuted,
      width: 16,
    },
    groupName: {
      fontSize: FontSize.subtitle,
      fontWeight: FontWeight.bold,
      color: c.textDark,
    },
    groupMeta: {
      fontSize: FontSize.caption,
      color: c.textMuted,
      marginTop: 1,
    },

    // Transaction row
    txRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderLight,
      gap: Spacing.sm,
    },
    txRowExcluded: {
      opacity: 0.45,
    },
    checkbox: {
      width: 24,
      alignItems: "center",
    },
    checkboxIcon: {
      fontSize: 18,
      color: c.primary,
    },
    txInfo: {
      flex: 1,
    },
    txName: {
      fontSize: FontSize.body,
      fontWeight: FontWeight.medium,
      color: c.textDark,
    },
    txNameExcluded: {
      textDecorationLine: "line-through",
    },
    txDate: {
      fontSize: FontSize.caption,
      color: c.textMuted,
      marginTop: 1,
    },
    txAmount: {
      fontSize: FontSize.body,
      fontWeight: FontWeight.semibold,
      color: c.textDark,
    },
    txAmountExcluded: {
      color: c.textMuted,
    },

    // Group divider
    groupDivider: {
      height: Spacing.sm,
    },

    // Empty
    emptyText: {
      fontSize: FontSize.body,
      color: c.textMuted,
      textAlign: "center",
      lineHeight: 22,
    },

    // Footer
    footer: {
      paddingHorizontal: Spacing.base,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderColor: c.borderLight,
      gap: Spacing.sm,
      backgroundColor: c.surfaceLight,
    },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.md,
      alignItems: "center",
      shadowColor: c.shadowColor,
      shadowOpacity: 0.06,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 2,
    },
    primaryBtnText: {
      color: c.textOnColor,
      fontSize: FontSize.subtitle,
      fontWeight: FontWeight.bold,
    },
    btnDisabled: {
      opacity: 0.4,
    },
    cancelBtn: {
      alignItems: "center",
      paddingVertical: Spacing.sm,
    },
    cancelBtnText: {
      fontSize: FontSize.body,
      color: c.textMuted,
    },
  });
