import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../tokens";
import { useThemedStyles } from "../ThemeProvider";

const SUGGESTED_QUESTIONS = [
  "How am I doing this month?",
  "Can I afford…?",
  "What should I adjust?",
  "Explain my spending",
];

type Props = {
  onSelect: (question: string) => void;
};

/**
 * Horizontal row of suggested question chips for the chat empty state.
 * Tapping sends the question into the chat input.
 */
export function SuggestedChips({ onSelect }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      {SUGGESTED_QUESTIONS.map((q) => (
        <Pressable
          key={q}
          onPress={() => onSelect(q)}
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          accessibilityLabel={q}
          accessibilityRole="button"
        >
          <Text style={styles.chipText}>{q}</Text>
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
      paddingHorizontal: Spacing.base,
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
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
