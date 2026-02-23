import React from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { useAppStore } from "../../store/useAppStore";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../tokens";

const VISIBLE_MS = 2500;
const FADE_MS = 250;

export function Toast() {
  const toast = useAppStore((s) => s.toast);
  const opacity = React.useRef(new Animated.Value(0)).current;
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function dismiss() {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(() => {
      useAppStore.setState({ toast: null });
    });
  }

  React.useEffect(() => {
    if (!toast) {
      opacity.setValue(0);
      return;
    }

    // Fade in
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();

    // Auto-dismiss after VISIBLE_MS
    timerRef.current = setTimeout(dismiss, VISIBLE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  if (!toast) return null;

  const variantStyle =
    toast.variant === "error"
      ? styles.variantError
      : toast.variant === "info"
        ? styles.variantInfo
        : styles.variantSuccess;

  const textStyle =
    toast.variant === "error"
      ? styles.textError
      : toast.variant === "info"
        ? styles.textInfo
        : styles.textSuccess;

  return (
    <Animated.View
      style={[styles.container, variantStyle, { opacity }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={dismiss}
        style={styles.inner}
        accessibilityLabel={toast.text}
        accessibilityRole="alert"
      >
        <Text style={[styles.text, textStyle]} numberOfLines={2}>
          {toast.text}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: Spacing.base,
    right: Spacing.base,
    zIndex: 9999,
    borderRadius: Radius.lg,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  inner: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  text: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  variantSuccess: {
    backgroundColor: Color.successSurface,
    borderLeftColor: Color.success,
  },
  variantError: {
    backgroundColor: Color.errorSurface,
    borderLeftColor: Color.error,
  },
  variantInfo: {
    backgroundColor: Color.primarySurface,
    borderLeftColor: Color.primary,
  },
  textSuccess: { color: Color.success },
  textError: { color: Color.error },
  textInfo: { color: Color.primary },
});
