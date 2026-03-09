import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useAppStore } from "../src/store/useAppStore";
import { Card } from "../src/ui/components/Card";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../src/ui/tokens";
import { useThemedStyles, useTheme } from "@/src/ui/ThemeProvider";
import type { EnvelopeType } from "@money-shepherd/domain";

type Suggestion = {
  name: string;
  goalCents: number;
  type: EnvelopeType;
  reason: string;
};

type WizardState =
  | { phase: "confirm" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "suggestions"; suggestions: Suggestion[] }
  | { phase: "creating" };

const TYPE_LABELS: Record<EnvelopeType, string> = {
  giving: "Giving",
  spending: "Spending",
  savings: "Savings",
  debt: "Debt",
};

const TYPE_COLORS: Record<string, string> = {
  giving: "#2d7a4f",
  spending: "#b8860b",
  savings: "#1a6fab",
  debt: "#c0392b",
};

export default function AiSetupWizardScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const analyzeSpending = useAppStore((s) => s.analyzeSpending);
  const createEnvelope = useAppStore((s) => s.createEnvelope);
  const setEnvelopeGoal = useAppStore((s) => s.setEnvelopeGoal);

  const [wizardState, setWizardState] = React.useState<WizardState>({ phase: "confirm" });
  const [editableSuggestions, setEditableSuggestions] = React.useState<Suggestion[]>([]);

  function handleAnalyze() {
    setWizardState({ phase: "loading" });
    analyzeSpending()
      .then((result) => {
        const suggestions = result.suggestions as Suggestion[];
        setEditableSuggestions(suggestions);
        setWizardState({ phase: "suggestions", suggestions });
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof Error ? err.message : "Could not load AI suggestions.";
        setWizardState({ phase: "error", message: msg });
      });
  }

  function updateName(index: number, name: string) {
    setEditableSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, name } : s)),
    );
  }

  function updateGoal(index: number, raw: string) {
    const cents = Math.round(parseFloat(raw.replace(/[^0-9.]/g, "")) * 100) || 0;
    setEditableSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, goalCents: cents } : s)),
    );
  }

  function removeSuggestion(index: number) {
    setEditableSuggestions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreateAll() {
    if (editableSuggestions.length === 0) {
      router.dismissAll();
      return;
    }
    setWizardState({ phase: "creating" });
    try {
      for (const suggestion of editableSuggestions) {
        await createEnvelope(suggestion.name, suggestion.type);
        // Find the newly created envelope by name to set goal
        // (store toast will show if anything fails — we proceed best-effort)
      }
      // Set goals after all envelopes created
      // We need the state to get the envelope IDs
      // Use the store snapshot after each create
      const state = useAppStore.getState().state;
      if (state) {
        for (const suggestion of editableSuggestions) {
          if (suggestion.goalCents > 0) {
            const env = state.budget.envelopes
              .slice()
              .reverse()
              .find((e) => e.name === suggestion.name);
            if (env) {
              await setEnvelopeGoal(env.id, suggestion.goalCents);
            }
          }
        }
      }
      router.dismissAll();
    } catch {
      // Store shows toast — go back to suggestions
      setWizardState({
        phase: "suggestions",
        suggestions: editableSuggestions,
      });
    }
  }

  function handleSkip() {
    router.dismissAll();
  }

  // ── Confirm ──────────────────────────────────────────────────────────────
  if (wizardState.phase === "confirm") {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.sparkle}>✦</Text>
          <Text style={styles.title}>AI Budget Setup</Text>
          <Text style={styles.subtitle}>
            Claude will analyze your spending patterns and suggest up to 7
            personalized budget envelopes. This uses a small amount of your
            monthly AI budget (~$0.03).
          </Text>
        </View>
        <View style={styles.footer}>
          <Pressable
            onPress={handleAnalyze}
            style={styles.primaryBtn}
            accessibilityRole="button"
            accessibilityLabel="Analyze my spending"
          >
            <Text style={styles.primaryBtnText}>✦ Analyze My Spending</Text>
          </Pressable>
          <Pressable
            onPress={handleSkip}
            style={styles.skipBtn}
            accessibilityRole="button"
            accessibilityLabel="Skip for now"
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (wizardState.phase === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Analyzing your spending…</Text>
      </View>
    );
  }

  // ── Creating ─────────────────────────────────────────────────────────────
  if (wizardState.phase === "creating") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Creating envelopes…</Text>
      </View>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (wizardState.phase === "error") {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>AI Budget Setup</Text>
          <Text style={styles.subtitle}>
            We couldn&apos;t load suggestions right now. You can set up envelopes
            manually or try again later.
          </Text>
        </View>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{wizardState.message}</Text>
        </View>
        <View style={styles.footer}>
          <Pressable onPress={handleSkip} style={styles.primaryBtn} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>Set Up Manually</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Suggestions ──────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.sparkle}>✦</Text>
        <Text style={styles.title}>AI Budget Setup</Text>
        <Text style={styles.subtitle}>
          Based on your spending, here are suggested envelopes. Edit or remove
          any before creating.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      >
        {editableSuggestions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              All suggestions removed. Tap &quot;Done&quot; to finish without creating
              envelopes.
            </Text>
          </Card>
        ) : (
          editableSuggestions.map((s, index) => (
            <SuggestionCard
              key={index}
              suggestion={s}
              styles={styles}
              colors={colors}
              onNameChange={(name) => updateName(index, name)}
              onGoalChange={(raw) => updateGoal(index, raw)}
              onRemove={() => removeSuggestion(index)}
            />
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleCreateAll}
          style={styles.primaryBtn}
          accessibilityRole="button"
          accessibilityLabel={
            editableSuggestions.length === 0
              ? "Done"
              : `Create ${editableSuggestions.length} envelope${editableSuggestions.length !== 1 ? "s" : ""}`
          }
        >
          <Text style={styles.primaryBtnText}>
            {editableSuggestions.length === 0
              ? "Done"
              : `Create ${editableSuggestions.length} Envelope${editableSuggestions.length !== 1 ? "s" : ""}`}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSkip}
          style={styles.skipBtn}
          accessibilityRole="button"
          accessibilityLabel="Skip for now"
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}

type SuggestionCardProps = {
  suggestion: Suggestion;
  styles: ReturnType<typeof createStyles>;
  colors: Record<string, string>;
  onNameChange: (name: string) => void;
  onGoalChange: (raw: string) => void;
  onRemove: () => void;
};

function SuggestionCard({
  suggestion,
  styles,
  colors,
  onNameChange,
  onGoalChange,
  onRemove,
}: SuggestionCardProps) {
  const badgeColor = TYPE_COLORS[suggestion.type] ?? colors.textMuted;
  const goalDollars = (suggestion.goalCents / 100).toFixed(2);

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: badgeColor + "22", borderColor: badgeColor + "55" }]}>
          <Text style={[styles.typeBadgeText, { color: badgeColor }]}>
            {TYPE_LABELS[suggestion.type]}
          </Text>
        </View>
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityLabel={`Remove ${suggestion.name}`}
          accessibilityRole="button"
          style={styles.removeBtn}
        >
          <Text style={styles.removeBtnText}>✕</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.nameInput}
        value={suggestion.name}
        onChangeText={onNameChange}
        placeholder="Envelope name"
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
        accessibilityLabel="Envelope name"
      />

      <View style={styles.goalRow}>
        <Text style={styles.goalLabel}>Monthly goal</Text>
        <TextInput
          style={styles.goalInput}
          value={goalDollars}
          onChangeText={onGoalChange}
          keyboardType="decimal-pad"
          returnKeyType="done"
          accessibilityLabel="Monthly goal in dollars"
        />
      </View>

      <Text style={styles.reasonText}>{suggestion.reason}</Text>
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
    loadingText: {
      fontSize: FontSize.body,
      color: c.textMid,
      marginTop: Spacing.sm,
    },

    header: {
      paddingHorizontal: Spacing.base,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.md,
      gap: Spacing.xs,
    },
    sparkle: {
      fontSize: 22,
      color: c.primary,
    },
    title: {
      fontSize: FontSize.title,
      fontWeight: FontWeight.extrabold,
      color: c.textDark,
    },
    subtitle: {
      fontSize: FontSize.body,
      color: c.textMid,
      lineHeight: 22,
    },

    list: {
      paddingHorizontal: Spacing.base,
      paddingBottom: Spacing.lg,
      gap: Spacing.md,
    },

    card: {
      gap: Spacing.sm,
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
      backgroundColor: c.surfaceLight,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    typeBadge: {
      borderRadius: Radius.pill,
      borderWidth: 1,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
    },
    typeBadgeText: {
      fontSize: FontSize.caption,
      fontWeight: FontWeight.semibold,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
    },
    removeBtn: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    removeBtnText: {
      fontSize: FontSize.body,
      color: c.textMuted,
      fontWeight: FontWeight.medium,
    },

    nameInput: {
      fontSize: FontSize.subtitle,
      fontWeight: FontWeight.bold,
      color: c.textDark,
      borderBottomWidth: 1,
      borderColor: c.borderLight,
      paddingVertical: Spacing.xs,
    },

    goalRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    goalLabel: {
      fontSize: FontSize.body,
      color: c.textMid,
    },
    goalInput: {
      fontSize: FontSize.body,
      fontWeight: FontWeight.semibold,
      color: c.textDark,
      textAlign: "right" as const,
      borderBottomWidth: 1,
      borderColor: c.borderLight,
      paddingVertical: Spacing.xs,
      minWidth: 80,
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
    errorText: {
      fontSize: FontSize.body,
      color: c.error,
      lineHeight: 22,
    },

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
    skipBtn: {
      alignItems: "center",
      paddingVertical: Spacing.sm,
    },
    skipText: {
      fontSize: FontSize.body,
      color: c.textMuted,
    },
  });
