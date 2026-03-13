import React from "react";
import { View, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { Spacing, Radius, Shadow, type ColorTokens } from "../tokens";
import { useThemedStyles } from "../ThemeProvider";

type Props = {
  children: React.ReactNode;
  /** When provided, the card becomes pressable. */
  onPress?: () => void;
  /** Gold top border accent for hero cards. */
  hero?: boolean;
  /** Optional padding (no default — existing consumers control their own). */
  padding?: number;
  accessibilityLabel?: string;
  style?: ViewStyle | ViewStyle[];
};

/**
 * Standard surface card: rounded corners, warm white background, shadow.
 * Pass `onPress` to make it pressable. Pass `hero` for gold top border accent.
 */
export function Card({ children, onPress, hero, padding, accessibilityLabel, style }: Props) {
  const styles = useThemedStyles(createStyles);

  const cardStyles: ViewStyle[] = [
    styles.card,
    hero ? styles.hero : undefined,
    padding != null ? { padding } : undefined,
    style,
  ].filter(Boolean) as ViewStyle[];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [...cardStyles, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyles}>{children}</View>;
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  card: {
    marginHorizontal: Spacing.base,
    borderRadius: Radius.xl,
    backgroundColor: c.cardSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
    ...Shadow.md,
  },
  hero: {
    borderTopWidth: 2,
    borderTopColor: c.primary,
  },
  pressed: {
    opacity: 0.85,
  },
});
