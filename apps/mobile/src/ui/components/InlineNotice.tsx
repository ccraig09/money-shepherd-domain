import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

type Variant = "info" | "warning" | "error";

type Props = {
  variant: Variant;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const COLORS: Record<Variant, { bg: string; border: string; text: string; action: string }> = {
  info: { bg: "#e8f0fe", border: "#4f8ef7", text: "#1a3a6e", action: "#4f8ef7" },
  warning: { bg: "#fff8e1", border: "#f5a623", text: "#7a5c00", action: "#c27a00" },
  error: { bg: "#fdecea", border: "#d94f4f", text: "#8b1a1a", action: "#d94f4f" },
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
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    gap: 6,
  },
  message: { fontSize: 13, lineHeight: 18 },
  actionWrap: { alignSelf: "flex-start" },
  action: { fontSize: 13, fontWeight: "700" },
});
