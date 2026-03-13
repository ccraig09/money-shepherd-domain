import React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ShepherdAvatar } from "./ShepherdAvatar";
import { useAppStore } from "@/src/store/useAppStore";
import { Spacing, FontSize, FontWeight, type ColorTokens } from "../tokens";
import { useThemedStyles, useTheme } from "../ThemeProvider";

type Props = {
  onInboxPress: () => void;
  onProfilePress: () => void;
};

/**
 * Persistent top bar — app icon + title left, inbox badge + profile avatar right.
 * Rendered above tab content on all tab screens.
 */
export function TopBar({ onInboxPress, onProfilePress }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const inboxCount = useAppStore(
    (s) => s.state?.inbox?.unassignedTransactionIds?.length ?? 0,
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 4 }]}>
      {/* Left: logo + title */}
      <View style={styles.left}>
        <ShepherdAvatar size={24} />
        <Text style={styles.title}>Money Shepherd</Text>
      </View>

      {/* Right: inbox icon + profile avatar */}
      <View style={styles.right}>
        <Pressable
          onPress={onInboxPress}
          hitSlop={8}
          accessibilityLabel={`Inbox${inboxCount > 0 ? `, ${inboxCount} items` : ""}`}
          accessibilityRole="button"
        >
          <IconSymbol name="tray.fill" size={22} color={colors.textMid} />
          {inboxCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {inboxCount > 99 ? "99+" : inboxCount}
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={onProfilePress}
          hitSlop={8}
          accessibilityLabel="Settings"
          accessibilityRole="button"
        >
          <ShepherdAvatar size={28} />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.base,
      paddingBottom: Spacing.sm,
      backgroundColor: c.surface,
    },
    left: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    title: {
      fontSize: FontSize.subtitle,
      fontWeight: FontWeight.bold,
      color: c.textDark,
    },
    right: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.base,
    },
    badge: {
      position: "absolute",
      top: -6,
      right: -8,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: c.error,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 3,
    },
    badgeText: {
      fontSize: 9,
      fontWeight: FontWeight.bold,
      color: "#fff",
    },
  });
