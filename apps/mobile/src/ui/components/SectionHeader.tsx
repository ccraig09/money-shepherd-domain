import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Spacing, FontSize, FontWeight, Color } from "../tokens";

type Props = {
  title: string;
  /** Optional right-side text action. */
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Uppercase section label with an optional right-side text action.
 * Matches the repeated pattern across Dashboard, Envelopes, and Transactions.
 */
export function SectionHeader({ title, actionLabel, onAction }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: Color.textMid,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  action: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: Color.primary,
  },
});
