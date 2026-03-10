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

type Allocation = {
  envelopeId: string;
  envelopeName: string;
  amountCents: number;
  reason: string;
};

type ScreenState =
  | { phase: "confirm" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "suggestions"; allocations: Allocation[] }
  | { phase: "applying" };

export default function AiAllocateScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  const suggestAllocations = useAppStore((s) => s.suggestAllocations);
  const fillEnvelopes = useAppStore((s) => s.fillEnvelopes);
  const state = useAppStore((s) => s.state);

  const [screenState, setScreenState] = React.useState<ScreenState>({ phase: "confirm" });

  // Build a name lookup from current state
  const envelopeNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of state?.budget.envelopes ?? []) {
      map[e.id] = e.name;
    }
    return map;
  }, [state]);

  const availableCents = state?.budget.availableToAssign.cents ?? 0;

  function handleAnalyze() {
    setScreenState({ phase: "loading" });
    suggestAllocations()
      .then((result) => {
        const allocations: Allocation[] = result.allocations
          .filter((a) => envelopeNameById[a.envelopeId])
          .map((a) => ({
            envelopeId: a.envelopeId,
            envelopeName: envelopeNameById[a.envelopeId],
            amountCents: a.amountCents,
            reason: a.reason,
          }));
        setScreenState({ phase: "suggestions", allocations });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Could not load AI suggestions.";
        setScreenState({ phase: "error", message: msg });
      });
  }

  async function handleApplyAll(allocations: Allocation[]) {
    setScreenState({ phase: "applying" });
    try {
      await fillEnvelopes(
        allocations.map((a) => ({ envelopeId: a.envelopeId, amountCents: a.amountCents })),
      );
      router.back();
    } catch {
      setScreenState({ phase: "suggestions", allocations });
    }
  }

  // ── Confirm ───────────────────────────────────────────────────────────────
  if (screenState.phase === "confirm") {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.sparkle}>✦</Text>
          <Text style={styles.title}>AI Fill Envelopes</Text>
          <Text style={styles.subtitle}>
            Claude will suggest how to distribute{" "}
            <Text style={styles.highlight}>${formatMoney(availableCents)}</Text> across
            your envelopes based on goals and priorities. (~$0.01)
          </Text>
        </View>
        <View style={styles.footer}>
          <Pressable
            onPress={handleAnalyze}
            style={styles.primaryBtn}
            accessibilityRole="button"
            accessibilityLabel="Get AI allocation suggestions"
          >
            <Text style={styles.primaryBtnText}>✦ Suggest Allocations</Text>
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

  // ── Loading ───────────────────────────────────────────────────────────────
  if (screenState.phase === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Analyzing your envelopes…</Text>
      </View>
    );
  }

  // ── Applying ─────────────────────────────────────────────────────────────
  if (screenState.phase === "applying") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Filling envelopes…</Text>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (screenState.phase === "error") {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>AI Fill Envelopes</Text>
          <Text style={styles.subtitle}>
            We couldn&apos;t load suggestions right now. Please try again later.
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

  // ── Suggestions ───────────────────────────────────────────────────────────
  const { allocations } = screenState;
  const totalCents = allocations.reduce((sum, a) => sum + a.amountCents, 0);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.sparkle}>✦</Text>
        <Text style={styles.title}>AI Fill Envelopes</Text>
        <Text style={styles.subtitle}>
          Review the suggested allocations. Tap &quot;Apply All&quot; to fill your
          envelopes.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {allocations.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No suggestions returned — you may already be fully allocated.
            </Text>
          </Card>
        ) : (
          allocations.map((alloc) => (
            <Card key={alloc.envelopeId} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.envelopeName}>{alloc.envelopeName}</Text>
                <Text style={styles.amount}>${formatMoney(alloc.amountCents)}</Text>
              </View>
              <Text style={styles.reasonText}>{alloc.reason}</Text>
            </Card>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total to fill</Text>
          <Text style={styles.totalAmount}>${formatMoney(totalCents)}</Text>
        </View>
        <Pressable
          onPress={() => handleApplyAll(allocations)}
          style={[styles.primaryBtn, allocations.length === 0 && styles.primaryBtnDisabled]}
          disabled={allocations.length === 0}
          accessibilityRole="button"
          accessibilityLabel={`Apply ${allocations.length} allocation${allocations.length !== 1 ? "s" : ""}`}
        >
          <Text style={styles.primaryBtnText}>
            Apply {allocations.length} Allocation{allocations.length !== 1 ? "s" : ""}
          </Text>
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
    highlight: { fontWeight: FontWeight.bold, color: c.success },

    list: {
      paddingHorizontal: Spacing.base,
      paddingBottom: Spacing.lg,
      gap: Spacing.sm,
    },

    card: {
      gap: Spacing.xs,
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
      backgroundColor: c.surfaceLight,
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    envelopeName: {
      fontSize: FontSize.subtitle,
      fontWeight: FontWeight.bold,
      color: c.textDark,
      flex: 1,
    },
    amount: {
      fontSize: FontSize.subtitle,
      fontWeight: FontWeight.extrabold,
      color: c.success,
    },
    reasonText: {
      fontSize: FontSize.small,
      color: c.textMuted,
      lineHeight: 20,
      fontStyle: "italic" as const,
    },

    emptyCard: {
      padding: Spacing.lg,
      alignItems: "center",
      backgroundColor: c.surfaceLight,
    },
    emptyText: {
      fontSize: FontSize.body,
      color: c.textMuted,
      textAlign: "center",
      lineHeight: 22,
    },

    errorBox: {
      margin: Spacing.base,
      padding: Spacing.base,
      borderRadius: Radius.md,
      backgroundColor: c.errorSurface,
    },
    errorText: { fontSize: FontSize.body, color: c.error, lineHeight: 22 },

    footer: {
      paddingHorizontal: Spacing.base,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.bottomPad,
      borderTopWidth: 1,
      borderColor: c.borderLight,
      gap: Spacing.sm,
      backgroundColor: c.surfaceLight,
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: Spacing.xs,
    },
    totalLabel: { fontSize: FontSize.body, color: c.textMid, fontWeight: FontWeight.medium },
    totalAmount: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, color: c.textDark },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.md,
      alignItems: "center",
    },
    primaryBtnDisabled: { opacity: 0.4 },
    primaryBtnText: {
      color: c.textOnColor,
      fontSize: FontSize.subtitle,
      fontWeight: FontWeight.bold,
    },
    skipBtn: { alignItems: "center", paddingVertical: Spacing.sm },
    skipText: { fontSize: FontSize.body, color: c.textMuted },
  });
