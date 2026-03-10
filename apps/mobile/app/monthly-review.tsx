import React from "react";
import {
  View,
  Text,
  ScrollView,
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
import type {
  MonthlyReviewResponse,
  EnvelopeHighlight,
  BudgetAdjustment,
} from "../src/infra/firebase/aiTypes";

type ScreenState =
  | { phase: "confirm" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "review"; data: MonthlyReviewResponse }
  | { phase: "applying"; data: MonthlyReviewResponse; index: number };

export default function MonthlyReviewScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  const fetchMonthlyReview = useAppStore((s) => s.fetchMonthlyReview);
  const setEnvelopeGoal = useAppStore((s) => s.setEnvelopeGoal);
  const state = useAppStore((s) => s.state);

  const [screenState, setScreenState] = React.useState<ScreenState>({ phase: "confirm" });
  const [appliedIndices, setAppliedIndices] = React.useState<Set<number>>(new Set());

  // Build envelopeId lookup by name (adjustments reference names, not IDs)
  const envelopeIdByName = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of state?.budget.envelopes ?? []) {
      map[e.name.toLowerCase()] = e.id;
    }
    return map;
  }, [state]);

  function handleFetch() {
    setScreenState({ phase: "loading" });
    fetchMonthlyReview()
      .then((data) => {
        setScreenState({ phase: "review", data });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Could not load monthly review.";
        setScreenState({ phase: "error", message: msg });
      });
  }

  async function handleApplyAdjustment(adj: BudgetAdjustment, index: number) {
    if (screenState.phase !== "review") return;
    const envId = envelopeIdByName[adj.envelopeName.toLowerCase()];
    if (!envId) return;

    setScreenState({ phase: "applying", data: screenState.data, index });
    try {
      await setEnvelopeGoal(envId, adj.suggestedGoalCents);
      setAppliedIndices((prev) => new Set(prev).add(index));
      setScreenState({ phase: "review", data: screenState.data });
    } catch {
      setScreenState({ phase: "review", data: screenState.data });
    }
  }

  // ── Confirm ─────────────────────────────────────────────
  if (screenState.phase === "confirm") {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.sparkle}>✦</Text>
          <Text style={styles.title}>Monthly Review</Text>
          <Text style={styles.subtitle}>
            Compare your spending with last month and get personalized
            adjustment suggestions. (~$0.02)
          </Text>
        </View>
        <View style={styles.footer}>
          <Pressable
            onPress={handleFetch}
            style={styles.primaryBtn}
            accessibilityRole="button"
            accessibilityLabel="Generate monthly review"
          >
            <Text style={styles.primaryBtnText}>✦ Generate Review</Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            style={styles.skipBtn}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.skipText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Loading ─────────────────────────────────────────────
  if (screenState.phase === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Reviewing your spending…</Text>
      </View>
    );
  }

  // ── Error ───────────────────────────────────────────────
  if (screenState.phase === "error") {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Monthly Review</Text>
          <Text style={styles.subtitle}>
            We couldn&apos;t generate your review right now. Please try again later.
          </Text>
        </View>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{screenState.message}</Text>
        </View>
        <View style={styles.footer}>
          <Pressable onPress={() => router.back()} style={styles.primaryBtn} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Review ──────────────────────────────────────────────
  const data = screenState.phase === "applying" ? screenState.data : screenState.data;
  const applyingIndex = screenState.phase === "applying" ? screenState.index : -1;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.sparkle}>✦</Text>
        <Text style={styles.title}>Monthly Review</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryText}>{data.summary}</Text>
        </Card>

        {/* Envelope Highlights */}
        {data.envelopeHighlights.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Highlights</Text>
            {data.envelopeHighlights.map((h, i) => (
              <HighlightRow key={`${h.envelopeName}-${i}`} highlight={h} styles={styles} colors={colors} />
            ))}
          </>
        )}

        {/* Adjustments */}
        {data.adjustments.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Suggested Adjustments</Text>
            {data.adjustments.map((adj, i) => {
              const isApplied = appliedIndices.has(i);
              const isApplying = applyingIndex === i;
              const envExists = !!envelopeIdByName[adj.envelopeName.toLowerCase()];
              return (
                <AdjustmentRow
                  key={`${adj.envelopeName}-${i}`}
                  adjustment={adj}
                  isApplied={isApplied}
                  isApplying={isApplying}
                  envExists={envExists}
                  onApply={() => handleApplyAdjustment(adj, i)}
                  styles={styles}
                  colors={colors}
                />
              );
            })}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => router.back()}
          style={styles.primaryBtn}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.primaryBtnText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────

function HighlightRow({
  highlight,
  styles,
  colors,
}: {
  highlight: EnvelopeHighlight;
  styles: ReturnType<typeof createStyles>;
  colors: ColorTokens;
}) {
  const statusColor =
    highlight.status === "over_budget"
      ? colors.error
      : highlight.status === "under_budget"
        ? colors.success
        : colors.textMuted;

  const statusLabel =
    highlight.status === "over_budget"
      ? "Over Budget"
      : highlight.status === "under_budget"
        ? "Under Budget"
        : "On Track";

  const deltaSign = highlight.deltaPercent >= 0 ? "+" : "";

  return (
    <Card style={styles.highlightCard}>
      <View style={styles.highlightHeader}>
        <Text style={styles.highlightName} numberOfLines={1}>
          {highlight.envelopeName}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
            {statusLabel}
          </Text>
        </View>
      </View>
      <View style={styles.highlightNumbers}>
        <View style={styles.highlightCol}>
          <Text style={styles.highlightLabel}>Last month</Text>
          <Text style={styles.highlightValue}>
            ${formatMoney(highlight.previousMonthCents)}
          </Text>
        </View>
        <View style={styles.highlightCol}>
          <Text style={styles.highlightLabel}>This month</Text>
          <Text style={styles.highlightValue}>
            ${formatMoney(highlight.currentMonthCents)}
          </Text>
        </View>
        <View style={styles.highlightCol}>
          <Text style={styles.highlightLabel}>Change</Text>
          <Text style={[styles.highlightDelta, { color: statusColor }]}>
            {deltaSign}{highlight.deltaPercent}%
          </Text>
        </View>
      </View>
    </Card>
  );
}

function AdjustmentRow({
  adjustment,
  isApplied,
  isApplying,
  envExists,
  onApply,
  styles,
  colors,
}: {
  adjustment: BudgetAdjustment;
  isApplied: boolean;
  isApplying: boolean;
  envExists: boolean;
  onApply: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ColorTokens;
}) {
  const isRaise = adjustment.suggestedGoalCents > adjustment.currentGoalCents;

  return (
    <Card style={styles.adjustCard}>
      <View style={styles.adjustHeader}>
        <Text style={styles.adjustName} numberOfLines={1}>
          {adjustment.envelopeName}
        </Text>
        <Text style={[styles.adjustDirection, { color: isRaise ? colors.error : colors.success }]}>
          {isRaise ? "Raise" : "Lower"} goal
        </Text>
      </View>
      <View style={styles.adjustGoals}>
        <Text style={styles.adjustGoalLabel}>
          ${formatMoney(adjustment.currentGoalCents)} → ${formatMoney(adjustment.suggestedGoalCents)}
        </Text>
      </View>
      <Text style={styles.adjustReason}>{adjustment.reason}</Text>
      {envExists && (
        <Pressable
          onPress={onApply}
          disabled={isApplied || isApplying}
          style={[
            styles.applyBtn,
            isApplied && styles.applyBtnApplied,
            isApplying && styles.applyBtnApplying,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            isApplied
              ? `Applied: ${adjustment.envelopeName} goal updated`
              : `Apply adjustment for ${adjustment.envelopeName}`
          }
        >
          {isApplying ? (
            <ActivityIndicator color={colors.textOnColor} size="small" />
          ) : (
            <Text style={[styles.applyBtnText, isApplied && styles.applyBtnTextApplied]}>
              {isApplied ? "Applied" : "Apply"}
            </Text>
          )}
        </Pressable>
      )}
    </Card>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.surface },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.md,
      backgroundColor: c.surface,
    },
    loadingText: { fontSize: FontSize.body, color: c.textMid, marginTop: Spacing.sm },

    header: {
      paddingHorizontal: Spacing.base,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.md,
      gap: Spacing.xs,
    },
    sparkle: { fontSize: 22, color: c.primary },
    title: {
      fontSize: FontSize.title,
      fontWeight: FontWeight.extrabold,
      color: c.textDark,
    },
    subtitle: { fontSize: FontSize.body, color: c.textMid, lineHeight: 22 },

    list: {
      paddingHorizontal: Spacing.base,
      paddingBottom: Spacing.lg,
      gap: Spacing.sm,
    },

    // Summary
    summaryCard: {
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.base,
      backgroundColor: c.primarySurface,
    },
    summaryText: {
      fontSize: FontSize.body,
      color: c.textDark,
      lineHeight: 22,
    },

    // Section label
    sectionLabel: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.semibold,
      color: c.textMuted,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
    },

    // Highlight cards
    highlightCard: {
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
      backgroundColor: c.surfaceLight,
      gap: Spacing.sm,
    },
    highlightHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    highlightName: {
      fontSize: FontSize.body,
      fontWeight: FontWeight.bold,
      color: c.textDark,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: Radius.sm,
    },
    statusBadgeText: {
      fontSize: FontSize.caption,
      fontWeight: FontWeight.bold,
      textTransform: "uppercase" as const,
      letterSpacing: 0.3,
    },
    highlightNumbers: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    highlightCol: { alignItems: "center", flex: 1 },
    highlightLabel: { fontSize: FontSize.caption, color: c.textMuted, marginBottom: 2 },
    highlightValue: { fontSize: FontSize.small, fontWeight: FontWeight.semibold, color: c.textDark },
    highlightDelta: { fontSize: FontSize.small, fontWeight: FontWeight.bold },

    // Adjustment cards
    adjustCard: {
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
      backgroundColor: c.surfaceLight,
      gap: Spacing.sm,
    },
    adjustHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    adjustName: {
      fontSize: FontSize.body,
      fontWeight: FontWeight.bold,
      color: c.textDark,
      flex: 1,
    },
    adjustDirection: {
      fontSize: FontSize.caption,
      fontWeight: FontWeight.bold,
      textTransform: "uppercase" as const,
    },
    adjustGoals: {
      flexDirection: "row",
      alignItems: "center",
    },
    adjustGoalLabel: {
      fontSize: FontSize.subtitle,
      fontWeight: FontWeight.semibold,
      color: c.textDark,
    },
    adjustReason: {
      fontSize: FontSize.small,
      color: c.textMuted,
      lineHeight: 20,
      fontStyle: "italic" as const,
    },
    applyBtn: {
      backgroundColor: c.primary,
      borderRadius: Radius.md,
      paddingVertical: Spacing.sm,
      alignItems: "center",
      minHeight: 36,
      justifyContent: "center",
    },
    applyBtnApplied: {
      backgroundColor: c.success,
    },
    applyBtnApplying: {
      opacity: 0.7,
    },
    applyBtnText: {
      color: c.textOnColor,
      fontSize: FontSize.small,
      fontWeight: FontWeight.bold,
    },
    applyBtnTextApplied: {
      color: c.textOnColor,
    },

    // Error
    errorBox: {
      margin: Spacing.base,
      padding: Spacing.base,
      borderRadius: Radius.md,
      backgroundColor: c.errorSurface,
    },
    errorText: { fontSize: FontSize.body, color: c.error, lineHeight: 22 },

    // Footer
    footer: {
      paddingHorizontal: Spacing.base,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.bottomPad,
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
    },
    primaryBtnText: {
      color: c.textOnColor,
      fontSize: FontSize.subtitle,
      fontWeight: FontWeight.bold,
    },
    skipBtn: { alignItems: "center", paddingVertical: Spacing.sm },
    skipText: { fontSize: FontSize.body, color: c.textMuted },
  });
