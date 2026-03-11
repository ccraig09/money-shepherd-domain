import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Spacing, Radius, FontSize, FontWeight, LineHeight, type ColorTokens } from "../tokens";
import { useThemedStyles } from "../ThemeProvider";
import type { ChatAction } from "../../infra/firebase/aiTypes";
import { ActionPreviewCard } from "./ActionPreviewCard";

type ActionStatus = "pending" | "executing" | "executed" | "dismissed" | "error";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  action?: ChatAction;
  actionStatus?: ActionStatus;
};

type Props = {
  message: ChatMessage;
  onConfirmAction?: (messageId: string) => void;
  onCancelAction?: (messageId: string) => void;
  envelopeLookup?: Map<string, string>;
};

/**
 * Chat bubble — user messages right-aligned (primary tint),
 * assistant messages left-aligned (surface card style).
 * When the message includes an action, renders an ActionPreviewCard below the text.
 */
export function ChatBubble({ message, onConfirmAction, onCancelAction, envelopeLookup }: Props) {
  const styles = useThemedStyles(createStyles);
  const isUser = message.role === "user";

  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>MS</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text
          style={[
            styles.text,
            isUser ? styles.textUser : styles.textAssistant,
          ]}
        >
          {message.content}
        </Text>
        {message.action && (
          <ActionPreviewCard
            action={message.action}
            status={message.actionStatus ?? "pending"}
            onConfirm={() => onConfirmAction?.(message.id)}
            onCancel={() => onCancelAction?.(message.id)}
            envelopeLookup={envelopeLookup ?? new Map()}
          />
        )}
      </View>
    </View>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.base,
      gap: Spacing.sm,
    },
    rowUser: {
      justifyContent: "flex-end",
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.primarySurface,
      borderWidth: 1,
      borderColor: c.borderLight,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    avatarText: {
      fontSize: 10,
      fontWeight: FontWeight.bold,
      color: c.primary,
    },
    bubble: {
      maxWidth: "78%",
      borderRadius: Radius.hero,
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
    },
    bubbleUser: {
      backgroundColor: c.primary,
      borderBottomRightRadius: Radius.sm,
    },
    bubbleAssistant: {
      backgroundColor: c.surfaceLight,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderLight,
      borderBottomLeftRadius: Radius.sm,
    },
    text: {
      fontSize: FontSize.body,
      lineHeight: LineHeight.body,
    },
    textUser: {
      color: c.textOnColor,
    },
    textAssistant: {
      color: c.textDark,
    },
  });
