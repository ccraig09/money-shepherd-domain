import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../tokens";
import { useThemedStyles } from "../ThemeProvider";
import type { TTSState } from "../../lib/useTTS";

type Props = {
  ttsState: TTSState;
  currentSnippet: string;
  onPause: () => void;
  onResume: () => void;
  onSkipPrev: () => void;
  onSkipNext: () => void;
  onStop: () => void;
};

/**
 * Floating TTS control bar — appears above the input bar when TTS is active.
 * Shows a truncated message snippet + prev/pause-resume/next/stop controls.
 */
export function FloatingTTSBar({
  ttsState,
  currentSnippet,
  onPause,
  onResume,
  onSkipPrev,
  onSkipNext,
  onStop,
}: Props) {
  const styles = useThemedStyles(createStyles);

  if (!ttsState.currentMessageId) return null;

  const isPlaying = ttsState.isPlaying;

  const { currentIndex, totalMessages } = ttsState;

  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <Text style={styles.snippet} numberOfLines={1}>
          {currentSnippet}
        </Text>
        {totalMessages > 1 && (
          <Text style={styles.progress}>{currentIndex} of {totalMessages}</Text>
        )}
      </View>
      <View style={styles.controls}>
        <Pressable onPress={onSkipPrev} style={styles.btn} accessibilityLabel="Previous message">
          <MaterialIcons name="skip-previous" size={22} color={styles.iconColor.color} />
        </Pressable>
        {isPlaying ? (
          <Pressable onPress={onPause} style={styles.btn} accessibilityLabel="Pause">
            <MaterialIcons name="pause" size={22} color={styles.iconColor.color} />
          </Pressable>
        ) : (
          <Pressable onPress={onResume} style={styles.btn} accessibilityLabel="Resume">
            <MaterialIcons name="play-arrow" size={22} color={styles.iconColor.color} />
          </Pressable>
        )}
        <Pressable onPress={onSkipNext} style={styles.btn} accessibilityLabel="Next message">
          <MaterialIcons name="skip-next" size={22} color={styles.iconColor.color} />
        </Pressable>
        <Pressable onPress={onStop} style={styles.btn} accessibilityLabel="Stop">
          <MaterialIcons name="close" size={20} color={styles.mutedColor.color} />
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
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.sm,
      backgroundColor: c.surfaceLight,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderLight,
      gap: Spacing.sm,
    },
    info: {
      flex: 1,
      gap: 2,
    },
    snippet: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.medium,
      color: c.textMid,
    },
    progress: {
      fontSize: FontSize.caption,
      color: c.textMuted,
    },
    controls: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
    },
    btn: {
      padding: Spacing.xs,
      borderRadius: Radius.sm,
    },
    // Pseudo-styles to pass colors to MaterialIcons
    iconColor: {
      color: c.primary,
    },
    mutedColor: {
      color: c.textMuted,
    },
  });
