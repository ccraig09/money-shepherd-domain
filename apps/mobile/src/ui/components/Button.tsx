import React from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../tokens";

type Variant = "primary" | "secondary" | "destructive" | "outline";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

const bgMap: Record<Variant, string> = {
  primary: Color.primary,
  secondary: Color.surfaceLight,
  destructive: Color.error,
  outline: "transparent",
};

const textMap: Record<Variant, string> = {
  primary: Color.textOnColor,
  secondary: Color.textDark,
  destructive: Color.textOnColor,
  outline: Color.primary,
};

const borderMap: Record<Variant, string | undefined> = {
  primary: undefined,
  secondary: undefined,
  destructive: undefined,
  outline: Color.primary,
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
}: Props) {
  const bg = bgMap[variant];
  const textColor = textMap[variant];
  const border = borderMap[variant];

  const containerStyle: ViewStyle[] = [
    styles.base,
    { backgroundColor: bg },
    border ? { borderWidth: 1, borderColor: border } : undefined,
    disabled ? styles.disabled : undefined,
    style,
  ].filter(Boolean) as ViewStyle[];

  const labelStyle: TextStyle[] = [
    styles.label,
    { color: textColor },
    disabled ? styles.labelDisabled : undefined,
  ].filter(Boolean) as TextStyle[];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={containerStyle}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text style={labelStyle}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  disabled: {
    opacity: 0.5,
  },
  labelDisabled: {
    opacity: 0.7,
  },
});
