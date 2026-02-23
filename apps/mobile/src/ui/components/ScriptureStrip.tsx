import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { getDailyVerse } from "../../lib/dailyVerse";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../tokens";

export function ScriptureStrip() {
  const verse = getDailyVerse();
  const [prayed, setPrayed] = React.useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.verseText}>{`\u201C${verse.text}\u201D`}</Text>
        <Text style={styles.reference}>— {verse.reference}</Text>
      </View>
      <Pressable
        onPress={() => setPrayed(true)}
        style={[styles.prayBtn, prayed && styles.prayBtnDone]}
        accessibilityLabel={prayed ? "Prayed" : "Pray"}
        accessibilityRole="button"
        disabled={prayed}
      >
        <Text style={[styles.prayText, prayed && styles.prayTextDone]}>
          {prayed ? "Prayed" : "Pray"}
        </Text>
      </Pressable>
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
    padding: Spacing.base,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  body: { flex: 1, gap: Spacing.xs },
  verseText: {
    fontSize: FontSize.body,
    fontStyle: "italic",
    color: Color.textDark,
    lineHeight: 22,
  },
  reference: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: Color.primary,
    marginTop: 2,
  },
  prayBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.primary,
    alignSelf: "center",
  },
  prayBtnDone: {
    backgroundColor: Color.primary,
    borderColor: Color.primary,
  },
  prayText: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: Color.primary,
  },
  prayTextDone: {
    color: Color.textOnColor,
  },
});
