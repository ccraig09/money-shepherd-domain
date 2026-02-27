import React from "react";
import { View, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { Spacing, Radius, type ColorTokens } from "../tokens";
import { useThemedStyles } from "../ThemeProvider";

type Props = {
  children: React.ReactNode;
  /** When provided, the card becomes pressable. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle | ViewStyle[];
};

/**
 * Standard surface card: rounded corners, white background, hairline border.
 * Pass `onPress` to make it pressable. Pass `style` to override bg, padding, etc.
 */
export function Card({ children, onPress, accessibilityLabel, style }: Props) {
  const styles = useThemedStyles(createStyles);

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.card, style]}>{children}</View>;
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  card: {
    marginHorizontal: Spacing.base,
    borderRadius: Radius.xl,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.85,
  },
});
