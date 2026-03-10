import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Card } from "./Card";
import { Spacing, FontSize, FontWeight, type ColorTokens } from "../tokens";
import { useThemedStyles } from "../ThemeProvider";

type Props = {
  onPress: () => void;
};

export function MonthlyReviewCard({ onPress }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <Card style={styles.card}>
      <Pressable
        onPress={onPress}
        style={styles.inner}
        accessibilityLabel="View monthly spending review"
        accessibilityRole="button"
      >
        <View style={styles.row}>
          <Text style={styles.sparkle}>✦</Text>
          <View style={styles.textCol}>
            <Text style={styles.title}>Monthly Review</Text>
            <Text style={styles.subtitle}>
              See how your spending compares to last month
            </Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </View>
      </Pressable>
    </Card>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    card: {
      marginHorizontal: Spacing.base,
      marginBottom: Spacing.base,
      padding: 0,
      overflow: "hidden" as const,
    },
    inner: {
      flexDirection: "row",
      alignItems: "center",
      padding: Spacing.base,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: Spacing.md,
    },
    sparkle: { fontSize: 20, color: c.primary },
    textCol: { flex: 1, gap: 2 },
    title: {
      fontSize: FontSize.body,
      fontWeight: FontWeight.bold,
      color: c.textDark,
    },
    subtitle: {
      fontSize: FontSize.small,
      color: c.textMuted,
      lineHeight: 18,
    },
    arrow: {
      fontSize: FontSize.subtitle,
      color: c.textMuted,
    },
  });
