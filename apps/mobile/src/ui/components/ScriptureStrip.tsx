import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { getDailyVerse } from "../../lib/dailyVerse";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../tokens";

export function ScriptureStrip() {
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

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    backgroundColor: Color.primarySurface,
    borderRadius: Radius.lg,
    borderLeftWidth: 3,
    borderLeftColor: Color.primary,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  verseText: {
    fontSize: FontSize.small,
    fontStyle: "italic",
    color: Color.textDark,
    lineHeight: 20,
  },
  reference: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Color.primary,
    marginTop: 2,
  },
});
