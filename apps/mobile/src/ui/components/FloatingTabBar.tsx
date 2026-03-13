import React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Radius, FontWeight, type ColorTokens } from "../tokens";
import { useThemedStyles, useTheme } from "../ThemeProvider";

/**
 * Floating pill tab bar — dark warm background, gold active pill highlight.
 * Drop-in replacement for the default tab bar via `<Tabs tabBar={...}>`.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];

        // Skip tabs without an icon (hidden via href: null, e.g. inbox, settings)
        if (!options.tabBarIcon) return null;

        const label = options.title ?? route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            if (process.env.EXPO_OS === "ios") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            navigation.navigate(route.name);
          }
        };

        const color = isFocused ? colors.primary : "#b5a898";

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={label}
            style={[styles.tab, isFocused && styles.tabActive]}
          >
            {options.tabBarIcon?.({
              focused: isFocused,
              color,
              size: 22,
            })}
            <Text style={[styles.label, { color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    container: {
      position: "absolute",
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      backgroundColor: "#2c2416",
      borderRadius: 24,
      paddingVertical: 8,
      shadowColor: "#2c2416",
      shadowOpacity: 0.25,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 6,
      paddingHorizontal: 4,
      borderRadius: Radius.xl,
      gap: 2,
    },
    tabActive: {
      backgroundColor: "rgba(184,134,11,0.2)",
    },
    label: {
      fontSize: 10,
      fontWeight: FontWeight.semibold,
    },
  });
