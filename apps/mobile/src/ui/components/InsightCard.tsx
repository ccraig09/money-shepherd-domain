import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Spacing, Radius, FontSize, FontWeight, LineHeight, type ColorTokens } from "../tokens";
import { useThemedStyles, useTheme } from "../ThemeProvider";
import type { Insight } from "@money-shepherd/domain";

type Props = {
  insight: Insight;
  onDismiss: () => void;
};

const SEVERITY_ICON: Record<Insight["severity"], string> = {
  warning: "!",
  info: "i",
  success: "\u2713",
};

export function InsightCard({ insight, onDismiss }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  const severityColor: Record<Insight["severity"], string> = {
    warning: colors.warning,
    info: colors.primary,
    success: colors.success,
  };

  const severityBg: Record<Insight["severity"], string> = {
    warning: colors.warningSurface,
    info: colors.primarySurface,
    success: colors.successSurface,
  };

  const iconColor = severityColor[insight.severity];
  const bgColor = severityBg[insight.severity];

  return (
    <View style={[styles.card, { backgroundColor: bgColor }]}>
      <View style={styles.header}>
        <View style={[styles.iconBadge, { backgroundColor: iconColor }]}>
          <Text style={styles.iconText}>{SEVERITY_ICON[insight.severity]}</Text>
        </View>
        <Text style={styles.title}>Money Shepherd says...</Text>
        <Pressable
          onPress={onDismiss}
          hitSlop={12}
          accessibilityLabel="Dismiss insight"
          accessibilityRole="button"
        >
          <Text style={styles.dismiss}>{"\u00d7"}</Text>
        </Pressable>
      </View>
      <Text style={styles.message}>{insight.message}</Text>
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  card: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: c.textOnColor,
    fontSize: 14,
    fontWeight: FontWeight.bold,
  },
  title: {
    flex: 1,
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
    color: c.textDark,
    letterSpacing: 0.3,
  },
  dismiss: {
    fontSize: 22,
    lineHeight: 22,
    color: c.textMuted,
    fontWeight: FontWeight.medium,
  },
  message: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
    color: c.textDark,
    fontWeight: FontWeight.medium,
  },
});
