import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Spacing, Radius, FontSize, FontWeight, Color, LineHeight } from "../tokens";
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

const SEVERITY_COLOR: Record<Insight["severity"], string> = {
  warning: Color.warning,
  info: Color.primary,
  success: Color.success,
};

const SEVERITY_BG: Record<Insight["severity"], string> = {
  warning: Color.warningSurface,
  info: Color.primarySurface,
  success: Color.successSurface,
};

export function InsightCard({ insight, onDismiss }: Props) {
  const iconColor = SEVERITY_COLOR[insight.severity];
  const bgColor = SEVERITY_BG[insight.severity];

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

const styles = StyleSheet.create({
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
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: Color.textOnColor,
    fontSize: 12,
    fontWeight: FontWeight.bold,
  },
  title: {
    flex: 1,
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: Color.textMid,
    letterSpacing: 0.3,
  },
  dismiss: {
    fontSize: 22,
    lineHeight: 22,
    color: Color.textMuted,
    fontWeight: FontWeight.medium,
  },
  message: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
    color: Color.textDark,
    fontWeight: FontWeight.medium,
  },
});
