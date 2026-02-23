import React from "react";
import { View, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { Spacing, Radius, Color } from "../tokens";

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

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.base,
    borderRadius: Radius.xl,
    backgroundColor: Color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.85,
  },
});
