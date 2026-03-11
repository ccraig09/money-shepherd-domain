import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../tokens";
import { useThemedStyles } from "../ThemeProvider";

/** Maps toolName → context-aware follow-up suggestions. */
const FOLLOW_UPS: Record<string, string[]> = {
  create_envelope: [
    "Set a goal for it",
    "Allocate funds to it",
  ],
  rename_envelope: [
    "How does my budget look now?",
  ],
  delete_envelope: [
    "How does my budget look now?",
    "Where should I reallocate?",
  ],
  set_envelope_goal: [
    "Allocate funds toward this goal",
    "Show my budget overview",
  ],
  transfer_funds: [
    "Show my budget overview",
    "Transfer more funds",
  ],
  allocate_to_envelope: [
    "How much is left to assign?",
    "Show my budget overview",
  ],
  set_envelope_type: [
    "Show my budget overview",
  ],
};

const DEFAULT_FOLLOW_UPS = [
  "How does my budget look now?",
  "What should I adjust?",
];

type Props = {
  toolName: string;
  onSelect: (question: string) => void;
};

/**
 * Context-aware follow-up suggestion chips shown after an action is executed.
 * Renders 1–3 pill chips based on the action that was just completed.
 */
export function FollowUpChips({ toolName, onSelect }: Props) {
  const styles = useThemedStyles(createStyles);
  const suggestions = FOLLOW_UPS[toolName] ?? DEFAULT_FOLLOW_UPS;

  return (
    <View style={styles.container}>
      {suggestions.map((s) => (
        <Pressable
          key={s}
          onPress={() => onSelect(s)}
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          accessibilityLabel={s}
          accessibilityRole="button"
        >
          <Text style={styles.chipText}>{s}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: Spacing.base + 28 + Spacing.sm, // align with bubble (avatar + gap)
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    chip: {
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: c.primarySurface,
    },
    chipPressed: {
      backgroundColor: c.primary,
    },
    chipText: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.medium,
      color: c.primary,
    },
  });
