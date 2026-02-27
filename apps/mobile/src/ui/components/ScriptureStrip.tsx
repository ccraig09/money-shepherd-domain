import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { getDailyVerse } from "../../lib/dailyVerse";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../tokens";
import { useThemedStyles } from "../ThemeProvider";

export function ScriptureStrip() {
  const styles = useThemedStyles(createStyles);
  const verse = getDailyVerse();

  return (
    <View style={styles.container}>
      <Text style={styles.verseText} numberOfLines={3}>
        {`\u201C${verse.text}\u201D`}
      </Text>
      <Text style={styles.reference}>— {verse.reference}</Text>
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    backgroundColor: c.primarySurface,
    borderRadius: Radius.lg,
    borderLeftWidth: 3,
    borderLeftColor: c.primary,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  verseText: {
    fontSize: FontSize.small,
    fontStyle: "italic",
    color: c.textDark,
    lineHeight: 20,
  },
  reference: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: c.primary,
    marginTop: 2,
  },
});
