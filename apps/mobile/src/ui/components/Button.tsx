import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../tokens";
import { useThemedStyles, useTheme } from "../ThemeProvider";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = "primary" | "secondary" | "destructive" | "outline";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const bgMap: Record<Variant, string> = {
    primary: colors.primary,
    secondary: colors.primarySurface,
    destructive: colors.error,
    outline: "transparent",
  };

  const textMap: Record<Variant, string> = {
    primary: colors.textOnColor,
    secondary: colors.primary,
    destructive: colors.textOnColor,
    outline: colors.primary,
  };

  const borderMap: Record<Variant, string | undefined> = {
    primary: undefined,
    secondary: undefined,
    destructive: undefined,
    outline: colors.primary,
  };

  const hasShadow = variant === "primary" || variant === "destructive";

  const bg = bgMap[variant];
  const textColor = textMap[variant];
  const border = borderMap[variant];

  const containerStyle: ViewStyle[] = [
    styles.base,
    { backgroundColor: bg },
    hasShadow ? styles.shadow : undefined,
    border ? { borderWidth: 1.5, borderColor: border } : undefined,
    disabled ? styles.disabled : undefined,
    style,
  ].filter(Boolean) as ViewStyle[];

  const labelStyle: TextStyle[] = [
    styles.label,
    { color: textColor },
    disabled ? styles.labelDisabled : undefined,
  ].filter(Boolean) as TextStyle[];

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled || loading}
      style={[containerStyle, { transform: [{ scale }] }]}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text style={labelStyle}>{label}</Text>
      )}
    </AnimatedPressable>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  base: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  shadow: {
    shadowColor: c.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
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
