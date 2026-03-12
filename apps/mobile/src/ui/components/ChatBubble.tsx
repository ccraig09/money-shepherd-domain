import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Markdown from "react-native-markdown-display";
import { Spacing, Radius, FontSize, FontWeight, LineHeight, type ColorTokens } from "../tokens";
import { useThemedStyles, useTheme } from "../ThemeProvider";
import type { ChatAction } from "../../infra/firebase/aiTypes";
import { ActionPreviewCard } from "./ActionPreviewCard";
import { ShepherdAvatar } from "./ShepherdAvatar";

export type ActionStatus = "pending" | "executing" | "executed" | "dismissed" | "error";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  /** @deprecated Use `actions` */
  action?: ChatAction;
  /** @deprecated Use `actionStatuses` */
  actionStatus?: ActionStatus;
  /** Multi-step actions */
  actions?: ChatAction[];
  actionStatuses?: ActionStatus[];
};

type Props = {
  message: ChatMessage;
  onConfirmAction?: (messageId: string) => void;
  onCancelAction?: (messageId: string) => void;
  envelopeLookup?: Map<string, string>;
  /** When provided, shows a speaker icon on assistant bubbles to start TTS */
  onTTSPlay?: (messageId: string) => void;
};

/** Build markdown styles from theme colors */
function buildMarkdownStyles(c: { textDark: string }) {
  return StyleSheet.create({
    body: {
      fontSize: FontSize.body,
      lineHeight: LineHeight.body,
      color: c.textDark,
    },
    strong: {
      fontWeight: FontWeight.bold,
    },
    em: {
      fontStyle: "italic",
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 0,
    },
  });
}

/**
 * Chat bubble — user messages right-aligned (primary tint),
 * assistant messages left-aligned (surface card style).
 * When the message includes an action, renders an ActionPreviewCard below the text.
 * Assistant bubbles include a TTS speaker icon and inline controls when playing.
 */
export function ChatBubble({
  message,
  onConfirmAction,
  onCancelAction,
  envelopeLookup,
  onTTSPlay,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const isUser = message.role === "user";

  const mdStyles = React.useMemo(() => buildMarkdownStyles(colors), [colors]);

  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      {!isUser && <ShepherdAvatar size={28} />}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        {isUser ? (
          <Text style={[styles.text, styles.textUser]}>
            {message.content}
          </Text>
        ) : (
          <Markdown style={mdStyles}>{message.content}</Markdown>
        )}
        {(message.actions ?? (message.action ? [message.action] : [])).map((act, idx, arr) => {
          const statuses = message.actionStatuses ?? (message.actionStatus ? [message.actionStatus] : []);
          return (
            <ActionPreviewCard
              key={`${act.toolName}-${idx}`}
              action={act}
              status={statuses[idx] ?? "pending"}
              onConfirm={() => onConfirmAction?.(message.id)}
              onCancel={() => onCancelAction?.(message.id)}
              envelopeLookup={envelopeLookup ?? new Map()}
              stepLabel={arr.length > 1 ? `Step ${idx + 1} of ${arr.length}` : undefined}
            />
          );
        })}
        {!isUser && onTTSPlay && (
          <View style={styles.ttsRow}>
            <Pressable
              onPress={() => onTTSPlay(message.id)}
              style={styles.ttsBtn}
              accessibilityLabel="Listen to message"
            >
              <MaterialIcons name="volume-up" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
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

    // ── TTS controls ──────────────────────────
    ttsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderLight,
    },
    ttsBtn: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.sm,
    },
  });
