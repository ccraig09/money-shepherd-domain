import React, { useRef } from "react";
import { Animated, Pressable, Text, StyleSheet } from "react-native";
import { type ColorTokens } from "../tokens";
import { useThemedStyles } from "../ThemeProvider";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  onPress: () => void;
};

/**
 * Floating Action Button — 48px gold circle with sparkle icon.
 * Positioned above the floating tab bar, right-aligned.
 * Parent is responsible for absolute positioning via style override.
 */
export function FAB({ onPress }: Props) {
  const styles = useThemedStyles(createStyles);
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.fab, { transform: [{ scale }] }]}
      accessibilityLabel="Open chat"
      accessibilityRole="button"
    >
      <Text style={styles.icon}>✦</Text>
    </AnimatedPressable>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    fab: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: c.primary,
      shadowOpacity: 0.35,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    icon: {
      fontSize: 20,
      color: "#fff",
    },
  });
