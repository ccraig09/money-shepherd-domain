import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../tokens";
import { useThemedStyles, useTheme } from "../ThemeProvider";

type Variant = "info" | "warning" | "error";

type Props = {
  variant: Variant;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function InlineNotice({ variant, message, actionLabel, onAction }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  const variantColors: Record<Variant, { bg: string; border: string; text: string; action: string }> = {
    info: { bg: colors.infoSurface, border: colors.primary, text: colors.infoText, action: colors.primary },
    warning: { bg: colors.warningSurface, border: colors.warning, text: colors.warningText, action: colors.warningAction },
    error: { bg: colors.errorSurface, border: colors.error, text: colors.errorText, action: colors.error },
  };

  const c = variantColors[variant];
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: c.bg, borderLeftColor: c.border },
      ]}
    >
      <Text style={[styles.message, { color: c.text }]}>{message}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} hitSlop={8} style={styles.actionWrap}>
          <Text style={[styles.action, { color: c.action }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    borderLeftWidth: 3,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginHorizontal: Spacing.base,
    marginVertical: Spacing.sm,
    gap: 6,
  },
  message: { fontSize: FontSize.small, lineHeight: 18 },
  actionWrap: { alignSelf: "flex-start" },
  action: { fontSize: FontSize.small, fontWeight: FontWeight.bold },
});
