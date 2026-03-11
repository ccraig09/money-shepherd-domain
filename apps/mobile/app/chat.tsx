import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { ChatBubble, type ChatMessage } from "../src/ui/components/ChatBubble";
import { SuggestedChips } from "../src/ui/components/SuggestedChips";
import {
  Spacing,
  Radius,
  FontSize,
  FontWeight,
  LineHeight,
  type ColorTokens,
} from "../src/ui/tokens";
import { useThemedStyles, useTheme } from "@/src/ui/ThemeProvider";

let nextId = 1;
function makeId() {
  return `msg-${nextId++}`;
}

/** Placeholder response while no Cloud Function exists (MS-30.2). */
function mockResponse(userText: string): string {
  const lower = userText.toLowerCase();
  if (lower.includes("how am i doing"))
    return "You're doing well this month! Your spending is on track with your budget goals. Keep it up — every dollar you manage wisely is a step toward your goals.";
  if (lower.includes("can i afford"))
    return "Let me think about that... Based on your current envelope balances and upcoming bills, I'd want to look at the specifics. What are you considering?";
  if (lower.includes("what should i adjust"))
    return "Looking at your envelopes, a few small tweaks could help. I'll be able to give you specific suggestions once the AI backend is connected in the next update.";
  if (lower.includes("explain my spending"))
    return "Your top spending categories this month are where most of your budget goes. Once the AI backend is live, I'll break this down with specific numbers and trends.";
  return "I hear you! The full AI advisor is coming soon — this is a preview of the chat experience. For now, I can show you how conversations will flow.";
}

export default function ChatScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMsg: ChatMessage = {
        id: makeId(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
      setIsTyping(true);

      // Simulate AI response delay
      setTimeout(() => {
        const aiMsg: ChatMessage = {
          id: makeId(),
          role: "assistant",
          content: mockResponse(trimmed),
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsTyping(false);
      }, 800 + Math.random() * 600);
    },
    [],
  );

  const handleChipSelect = useCallback(
    (question: string) => {
      sendMessage(question);
    },
    [sendMessage],
  );

  const isEmpty = messages.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      {isEmpty ? (
        <View style={styles.emptyState}>
          <View style={styles.shepherdIcon}>
            <Text style={styles.shepherdIconText}>MS</Text>
          </View>
          <Text style={styles.emptyTitle}>Ask Money Shepherd</Text>
          <Text style={styles.emptySubtitle}>
            Your personal budget advisor. Ask about your spending, get
            suggestions, or make changes — all through conversation.
          </Text>
          <View style={styles.chipsContainer}>
            <Text style={styles.chipsLabel}>Try asking:</Text>
            <SuggestedChips onSelect={handleChipSelect} />
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          ListFooterComponent={
            isTyping ? (
              <View style={styles.typingRow}>
                <View style={styles.typingAvatar}>
                  <Text style={styles.typingAvatarText}>MS</Text>
                </View>
                <View style={styles.typingBubble}>
                  <Text style={styles.typingDots}>...</Text>
                </View>
              </View>
            ) : null
          }
        />
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Ask anything about your budget..."
          placeholderTextColor={colors.textSubtle}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={() => sendMessage(inputText)}
          accessibilityLabel="Chat message input"
        />
        <Pressable
          onPress={() => sendMessage(inputText)}
          style={[
            styles.sendBtn,
            !inputText.trim() && styles.sendBtnDisabled,
          ]}
          disabled={!inputText.trim() || isTyping}
          accessibilityLabel="Send message"
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.surface,
    },

    // ── Empty state ────────────────────────────
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Spacing.lg,
      gap: Spacing.md,
    },
    shepherdIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.primarySurface,
      borderWidth: 2,
      borderColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.sm,
    },
    shepherdIconText: {
      fontSize: FontSize.subtitle,
      fontWeight: FontWeight.bold,
      color: c.primary,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: FontWeight.bold,
      color: c.textDark,
      textAlign: "center",
    },
    emptySubtitle: {
      fontSize: FontSize.body,
      lineHeight: LineHeight.body,
      color: c.textMuted,
      textAlign: "center",
      maxWidth: 300,
    },
    chipsContainer: {
      width: "100%",
      marginTop: Spacing.lg,
      gap: Spacing.sm,
    },
    chipsLabel: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.semibold,
      color: c.textMuted,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
      paddingHorizontal: Spacing.base,
    },

    // ── Message list ───────────────────────────
    messageList: {
      paddingTop: Spacing.base,
      paddingBottom: Spacing.sm,
    },

    // ── Typing indicator ───────────────────────
    typingRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: Spacing.base,
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    typingAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.primarySurface,
      borderWidth: 1,
      borderColor: c.borderLight,
      alignItems: "center",
      justifyContent: "center",
    },
    typingAvatarText: {
      fontSize: 10,
      fontWeight: FontWeight.bold,
      color: c.primary,
    },
    typingBubble: {
      backgroundColor: c.surfaceLight,
      borderRadius: Radius.hero,
      borderBottomLeftRadius: Radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderLight,
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.sm,
    },
    typingDots: {
      fontSize: FontSize.subtitle,
      color: c.textMuted,
      fontWeight: FontWeight.bold,
      letterSpacing: 2,
    },

    // ── Input bar ──────────────────────────────
    inputBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      paddingBottom: Spacing.base,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderLight,
      backgroundColor: c.surface,
      gap: Spacing.sm,
    },
    input: {
      flex: 1,
      fontSize: FontSize.body,
      color: c.textDark,
      backgroundColor: c.surfaceLight,
      borderRadius: Radius.hero,
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
      maxHeight: 100,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderLight,
    },
    sendBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    sendBtnDisabled: {
      backgroundColor: c.surfaceLight,
    },
    sendBtnText: {
      fontSize: FontSize.subtitle,
      fontWeight: FontWeight.bold,
      color: c.textOnColor,
    },
  });
