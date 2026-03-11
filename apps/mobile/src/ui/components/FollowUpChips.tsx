import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../tokens";
import { useThemedStyles, useTheme } from "../ThemeProvider";
import type { ChatAction } from "../../infra/firebase/aiTypes";

type Chip = {
  label: string;
  message: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
};

/** Formats cents as dollars for chip labels */
const fmt = (cents: unknown) =>
  typeof cents === "number" ? `$${(cents / 100).toFixed(0)}` : "";

/**
 * Builds context-aware follow-up chips from the completed action.
 * Chips reference actual entity names so the AI can act on them immediately.
 */
function buildChips(action: ChatAction): Chip[] {
  const { toolName, toolInput: input } = action;
  const name = (input.name as string) ?? "";

  switch (toolName) {
    case "create_envelope":
      return [
        {
          label: `Set a goal for ${name}`,
          message: `Set a goal for my ${name} envelope`,
          icon: "flag",
        },
        {
          label: `Fund ${name}`,
          message: `Allocate funds to my ${name} envelope`,
          icon: "account-balance-wallet",
        },
      ];

    case "set_envelope_goal": {
      const goal = fmt(input.goalCents);
      return [
        {
          label: goal ? `Fund ${goal} toward it` : "Allocate funds toward this goal",
          message: "Allocate funds toward the goal I just set",
          icon: "account-balance-wallet",
        },
        {
          label: "Budget overview",
          message: "How does my budget look now?",
          icon: "pie-chart",
        },
      ];
    }

    case "transfer_funds":
      return [
        {
          label: "Budget overview",
          message: "How does my budget look after that transfer?",
          icon: "pie-chart",
        },
        {
          label: "Transfer more",
          message: "I want to transfer more funds between envelopes",
          icon: "swap-horiz",
        },
      ];

    case "allocate_to_envelope":
      return [
        {
          label: "What's left to assign?",
          message: "How much do I have left to assign?",
          icon: "account-balance-wallet",
        },
        {
          label: "Budget overview",
          message: "Show me my budget overview",
          icon: "pie-chart",
        },
      ];

    case "rename_envelope":
      return [
        {
          label: "Budget overview",
          message: "How does my budget look now?",
          icon: "pie-chart",
        },
      ];

    case "delete_envelope":
      return [
        {
          label: "Where should I reallocate?",
          message: "Where should I reallocate the freed-up funds?",
          icon: "swap-horiz",
        },
        {
          label: "Budget overview",
          message: "How does my budget look now?",
          icon: "pie-chart",
        },
      ];

    case "set_envelope_type":
      return [
        {
          label: "Budget overview",
          message: "How does my budget look now?",
          icon: "pie-chart",
        },
      ];

    default:
      return [
        {
          label: "Budget overview",
          message: "How does my budget look now?",
          icon: "pie-chart",
        },
        {
          label: "What should I adjust?",
          message: "What should I adjust in my budget?",
          icon: "tune",
        },
      ];
  }
}

type Props = {
  /** The action that was just executed */
  action: ChatAction;
  onSelect: (message: string) => void;
};

/**
 * Context-aware follow-up suggestion chips shown after an action is executed.
 * Each chip includes a small icon + label, and sends a pre-composed message
 * that gives the AI enough context to act immediately.
 */
export function FollowUpChips({ action, onSelect }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const chips = buildChips(action);

  return (
    <View style={styles.container}>
      {chips.map((chip) => (
        <Pressable
          key={chip.label}
          onPress={() => onSelect(chip.message)}
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          accessibilityLabel={chip.label}
          accessibilityRole="button"
        >
          {chip.icon && (
            <MaterialIcons
              name={chip.icon}
              size={14}
              color={colors.primary}
              style={styles.chipIcon}
            />
          )}
          <Text style={styles.chipText}>{chip.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: Spacing.base + 28 + Spacing.sm, // align with bubble (avatar + gap)
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: c.primarySurface,
    },
    chipPressed: {
      backgroundColor: c.primary,
    },
    chipIcon: {
      marginRight: Spacing.xs,
    },
    chipText: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.medium,
      color: c.primary,
    },
  });
