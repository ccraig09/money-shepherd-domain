import React from "react";
import { Pressable, Text, StyleSheet, type ViewStyle } from "react-native";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../tokens";
import { useThemedStyles } from "../ThemeProvider";

type Props = {
  label: string;
  active: boolean;
  onPress: () => void;
  /** Optional count displayed after the label. */
  count?: number;
  style?: ViewStyle;
};

export function FilterChip({ label, active, onPress, count, style }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? styles.active : styles.inactive, style]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={count != null ? `${label} ${count}` : label}
    >
      <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
        {label}
        {count != null ? ` ${count}` : ""}
      </Text>
    </Pressable>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  chip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    alignSelf: "flex-start",
  },
  inactive: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderLight,
  },
  active: {
    backgroundColor: c.filterChipActive,
    borderWidth: 1.5,
    borderColor: c.filterChipActiveBorder,
  },
  label: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
  },
  labelInactive: {
    color: c.textMid,
  },
  labelActive: {
    color: c.primary,
  },
});
