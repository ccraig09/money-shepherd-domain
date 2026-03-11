import React from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Spacing, Radius, FontSize, FontWeight, LineHeight, type ColorTokens } from "../tokens";
import { useThemedStyles, useTheme } from "../ThemeProvider";
import type { ChatAction } from "../../infra/firebase/aiTypes";

type ActionStatus = "pending" | "executing" | "executed" | "dismissed" | "error";

type Props = {
  action: ChatAction;
  status: ActionStatus;
  onConfirm: () => void;
  onCancel: () => void;
  /** Envelope lookup for human-readable names */
  envelopeLookup: Map<string, string>;
};

/** Formats cents as dollars */
const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Human-readable label for a tool name */
const TOOL_LABELS: Record<string, string> = {
  create_envelope: "Create Envelope",
  rename_envelope: "Rename Envelope",
  delete_envelope: "Delete Envelope",
  set_envelope_goal: "Set Goal",
  transfer_funds: "Transfer",
  allocate_to_envelope: "Allocate Funds",
  set_envelope_type: "Change Type",
};

/**
 * Inline action preview card shown inside a chat bubble.
 * Displays a human-readable summary of the AI-suggested action
 * with Confirm and Cancel buttons.
 */
export function ActionPreviewCard({ action, status, onConfirm, onCancel, envelopeLookup }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  const label = TOOL_LABELS[action.toolName] ?? action.toolName;
  const details = buildDetails(action, envelopeLookup);

  if (status === "executed") {
    return (
      <View style={[styles.card, styles.cardExecuted]}>
        <Text style={styles.statusText}>Done</Text>
        <Text style={styles.label}>{label}</Text>
        {details.map((d, i) => (
          <Text key={i} style={styles.detail}>{d}</Text>
        ))}
      </View>
    );
  }

  if (status === "dismissed") {
    return (
      <View style={[styles.card, styles.cardDismissed]}>
        <Text style={styles.statusTextDismissed}>Cancelled</Text>
        <Text style={[styles.label, styles.labelDimmed]}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, status === "error" && styles.cardError]}>
      {status === "error" && (
        <Text style={styles.errorHint}>Something went wrong — try again?</Text>
      )}
      <Text style={styles.label}>{label}</Text>
      {details.map((d, i) => (
        <Text key={i} style={styles.detail}>{d}</Text>
      ))}

      <View style={styles.buttonRow}>
        {status === "executing" ? (
          <View style={styles.executingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.executingText}>Working on it...</Text>
          </View>
        ) : (
          <>
            <Pressable
              style={({ pressed }) => [styles.confirmBtn, pressed && styles.btnPressed]}
              onPress={onConfirm}
              accessibilityLabel={`Confirm ${label}`}
            >
              <Text style={styles.confirmBtnText}>Confirm</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
              onPress={onCancel}
              accessibilityLabel={`Cancel ${label}`}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function buildDetails(action: ChatAction, lookup: Map<string, string>): string[] {
  const input = action.toolInput;
  const envName = (id: unknown) => (typeof id === "string" ? lookup.get(id) ?? id : String(id));

  switch (action.toolName) {
    case "create_envelope":
      return [
        `Name: ${input.name}`,
        ...(input.type ? [`Type: ${input.type}`] : []),
      ];
    case "rename_envelope":
      return [
        `Envelope: ${envName(input.envelopeId)}`,
        `New name: ${input.name}`,
      ];
    case "delete_envelope":
      return [`Envelope: ${envName(input.envelopeId)}`];
    case "set_envelope_goal":
      return [
        `Envelope: ${envName(input.envelopeId)}`,
        `Goal: ${fmt(input.goalCents as number)}`,
      ];
    case "transfer_funds":
      return [
        `From: ${envName(input.fromEnvelopeId)}`,
        `To: ${envName(input.toEnvelopeId)}`,
        `Amount: ${fmt(input.amountCents as number)}`,
      ];
    case "allocate_to_envelope":
      return [
        `Envelope: ${envName(input.envelopeId)}`,
        `Amount: ${fmt(input.amountCents as number)}`,
      ];
    case "set_envelope_type":
      return [
        `Envelope: ${envName(input.envelopeId)}`,
        `New type: ${input.envelopeType}`,
      ];
    default:
      return Object.entries(input).map(([k, v]) => `${k}: ${v}`);
  }
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    card: {
      marginTop: Spacing.sm,
      backgroundColor: c.primarySurface,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.borderWarning,
      padding: Spacing.md,
      gap: Spacing.xs,
    },
    cardExecuted: {
      backgroundColor: c.successSurface,
      borderColor: c.success,
    },
    cardDismissed: {
      backgroundColor: c.surfaceLight,
      borderColor: c.borderLight,
    },
    cardError: {
      borderColor: c.error,
    },
    errorHint: {
      fontSize: FontSize.caption,
      fontWeight: FontWeight.semibold,
      color: c.error,
      marginBottom: Spacing.xs,
    },
    label: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.bold,
      color: c.textDark,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
    },
    labelDimmed: {
      color: c.textMuted,
    },
    detail: {
      fontSize: FontSize.body,
      lineHeight: LineHeight.body,
      color: c.textMid,
    },
    statusText: {
      fontSize: FontSize.caption,
      fontWeight: FontWeight.semibold,
      color: c.success,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
    },
    statusTextDismissed: {
      fontSize: FontSize.caption,
      fontWeight: FontWeight.semibold,
      color: c.textMuted,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
    },
    buttonRow: {
      flexDirection: "row",
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    confirmBtn: {
      flex: 1,
      backgroundColor: c.primary,
      borderRadius: Radius.md,
      paddingVertical: Spacing.sm,
      alignItems: "center",
    },
    confirmBtnText: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.bold,
      color: c.textOnColor,
    },
    cancelBtn: {
      flex: 1,
      backgroundColor: "transparent",
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: Spacing.sm,
      alignItems: "center",
    },
    cancelBtnText: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.semibold,
      color: c.textMuted,
    },
    btnPressed: {
      opacity: 0.7,
    },
    executingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      flex: 1,
      justifyContent: "center",
      paddingVertical: Spacing.sm,
    },
    executingText: {
      fontSize: FontSize.small,
      color: c.textMid,
      fontWeight: FontWeight.medium,
    },
  });
