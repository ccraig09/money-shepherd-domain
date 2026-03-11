import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../tokens";
import { useThemedStyles, useTheme } from "../ThemeProvider";

export type ActionPreview = {
  id: string;
  title: string;
  description: string;
  /** e.g. "create-envelope", "move-money", "set-goal", "adjust-budget" */
  actionType: string;
};

type Props = {
  action: ActionPreview;
  onConfirm: (action: ActionPreview) => void;
  onDismiss: (action: ActionPreview) => void;
  disabled?: boolean;
};

/**
 * Action card rendered inside chat — shows a proposed budget action
 * with Confirm / Dismiss buttons. Designed to feel like a warm suggestion,
 * not a cold confirmation dialog.
 */
export function ActionCard({ action, onConfirm, onDismiss, disabled }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>✦</Text>
        </View>
        <Text style={styles.title}>{action.title}</Text>
      </View>
      <Text style={styles.description}>{action.description}</Text>
      <View style={styles.actions}>
        <Pressable
          onPress={() => onConfirm(action)}
          style={[styles.confirmBtn, disabled && styles.btnDisabled]}
          disabled={disabled}
          accessibilityLabel={`Confirm: ${action.title}`}
        >
          <Text style={styles.confirmText}>Confirm</Text>
        </Pressable>
        <Pressable
          onPress={() => onDismiss(action)}
          style={styles.dismissBtn}
          disabled={disabled}
          accessibilityLabel={`Dismiss: ${action.title}`}
        >
          <Text style={styles.dismissText}>No thanks</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    container: {
      marginHorizontal: Spacing.base,
      marginBottom: Spacing.md,
      marginLeft: 36 + Spacing.sm, // offset past avatar
      backgroundColor: c.primarySurface,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: c.borderWarning,
      padding: Spacing.base,
      gap: Spacing.sm,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    iconCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    iconText: {
      fontSize: 12,
      color: c.textOnColor,
    },
    title: {
      fontSize: FontSize.body,
      fontWeight: FontWeight.semibold,
      color: c.textDark,
      flex: 1,
    },
    description: {
      fontSize: FontSize.small,
      color: c.textMid,
      lineHeight: 18,
    },
    actions: {
      flexDirection: "row",
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    confirmBtn: {
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
      backgroundColor: c.primary,
    },
    confirmText: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.semibold,
      color: c.textOnColor,
    },
    dismissBtn: {
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: c.borderLight,
      backgroundColor: c.surface,
    },
    dismissText: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.medium,
      color: c.textMuted,
    },
    btnDisabled: {
      opacity: 0.5,
    },
  });
