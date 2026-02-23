import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../tokens";

type Variant = "info" | "warning" | "error";

type Props = {
  variant: Variant;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const COLORS: Record<Variant, { bg: string; border: string; text: string; action: string }> = {
  info: { bg: Color.infoSurface, border: Color.primary, text: Color.infoText, action: Color.primary },
  warning: { bg: Color.warningSurface, border: Color.warning, text: Color.warningText, action: Color.warningAction },
  error: { bg: Color.errorSurface, border: Color.error, text: Color.errorText, action: Color.error },
};

export function InlineNotice({ variant, message, actionLabel, onAction }: Props) {
  const c = COLORS[variant];
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

const styles = StyleSheet.create({
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
