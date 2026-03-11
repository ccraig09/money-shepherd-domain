import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Markdown from "react-native-markdown-display";
import { Spacing, Radius, FontSize, FontWeight, LineHeight, type ColorTokens } from "../tokens";
import { useThemedStyles, useTheme } from "../ThemeProvider";
import type { ChatAction } from "../../infra/firebase/aiTypes";
import { ActionPreviewCard } from "./ActionPreviewCard";
import type { TTSState } from "../../lib/useTTS";

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
  ttsState?: TTSState;
  onTTSPlay?: (messageId: string) => void;
  onTTSPause?: () => void;
  onTTSResume?: () => void;
  onTTSSkipPrev?: () => void;
  onTTSSkipNext?: () => void;
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
  ttsState,
  onTTSPlay,
  onTTSPause,
  onTTSResume,
  onTTSSkipPrev,
  onTTSSkipNext,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const isUser = message.role === "user";
  const isThisPlaying =
    ttsState?.currentMessageId === message.id && ttsState.isPlaying;
  const isThisPaused =
    ttsState?.currentMessageId === message.id && ttsState.isPaused;
  const isThisActive = isThisPlaying || isThisPaused;

  const mdStyles = React.useMemo(() => buildMarkdownStyles(colors), [colors]);

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
        {isUser ? (
          <Text style={[styles.text, styles.textUser]}>
            {message.content}
          </Text>
        ) : (
          <Markdown style={mdStyles}>{message.content}</Markdown>
        )}
        {message.action && (
          <ActionPreviewCard
            action={message.action}
            status={message.actionStatus ?? "pending"}
            onConfirm={() => onConfirmAction?.(message.id)}
            onCancel={() => onCancelAction?.(message.id)}
            envelopeLookup={envelopeLookup ?? new Map()}
          />
        )}
        {!isUser && onTTSPlay && (
          <View style={styles.ttsRow}>
            {isThisActive ? (
              <>
                <Pressable
                  onPress={onTTSSkipPrev}
                  style={styles.ttsBtn}
                  accessibilityLabel="Previous message"
                >
                  <MaterialIcons name="skip-previous" size={20} color={colors.primary} />
                </Pressable>
                {isThisPlaying ? (
                  <Pressable
                    onPress={onTTSPause}
                    style={styles.ttsBtn}
                    accessibilityLabel="Pause"
                  >
                    <MaterialIcons name="pause" size={20} color={colors.primary} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={onTTSResume}
                    style={styles.ttsBtn}
                    accessibilityLabel="Resume"
                  >
                    <MaterialIcons name="play-arrow" size={20} color={colors.primary} />
                  </Pressable>
                )}
                <Pressable
                  onPress={onTTSSkipNext}
                  style={styles.ttsBtn}
                  accessibilityLabel="Next message"
                >
                  <MaterialIcons name="skip-next" size={20} color={colors.primary} />
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => onTTSPlay(message.id)}
                style={styles.ttsBtn}
                accessibilityLabel="Listen to message"
              >
                <MaterialIcons name="volume-up" size={18} color={colors.textMuted} />
              </Pressable>
            )}
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
