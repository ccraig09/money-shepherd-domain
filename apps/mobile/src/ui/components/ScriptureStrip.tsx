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
      <View style={styles.accentBar} />
      <View style={styles.content}>
        <Text style={styles.verseText} numberOfLines={3}>
          {`\u201C${verse.text}\u201D`}
        </Text>
        <Text style={styles.reference}>— {verse.reference}</Text>
      </View>
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flexDirection: "row",
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    backgroundColor: c.primarySurface,
    borderRadius: Radius.lg,
    overflow: "hidden",
  },
  accentBar: {
    width: 3,
    backgroundColor: c.primary,
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
  },
  content: {
    flex: 1,
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
