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
  info: { bg: "#e8f0fe", border: Color.primary, text: "#1a3a6e", action: Color.primary },
  warning: { bg: Color.warningSurface, border: "#f5a623", text: "#7a5c00", action: "#c27a00" },
  error: { bg: Color.errorSurface, border: Color.error, text: "#8b1a1a", action: Color.error },
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
