import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Spacing, FontSize, FontWeight, type ColorTokens } from "../../src/ui/tokens";
import { useThemedStyles } from "@/src/ui/ThemeProvider";

export default function InsightsScreen() {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Insights</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
      padding: Spacing.xl,
    },
    title: {
      fontSize: FontSize.title,
      fontWeight: FontWeight.bold,
      color: c.textDark,
      marginBottom: Spacing.sm,
    },
    subtitle: {
      fontSize: FontSize.body,
      color: c.textMuted,
    },
  });
