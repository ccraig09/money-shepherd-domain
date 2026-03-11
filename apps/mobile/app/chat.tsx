import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import { ChatBubble, type ChatMessage } from "../src/ui/components/ChatBubble";
import { SuggestedChips } from "../src/ui/components/SuggestedChips";
import { FollowUpChips } from "../src/ui/components/FollowUpChips";
import { useAppStore } from "../src/store/useAppStore";
import type { ChatMessageEntry } from "../src/infra/firebase/aiTypes";
import {
  Spacing,
  Radius,
  FontSize,
  FontWeight,
  LineHeight,
  type ColorTokens,
} from "../src/ui/tokens";
import { useThemedStyles, useTheme } from "@/src/ui/ThemeProvider";
import { makeId } from "@/src/lib/id";
import {
  findResumableSession,
  saveSession,
  cleanupOldSessions,
  deriveTitle,
  loadSessionById,
} from "@/src/infra/local/chatSessions";
import type { ChatSession } from "@/src/infra/local/chatSessions";
import { useTTS } from "@/src/lib/useTTS";
import { FloatingTTSBar } from "@/src/ui/components/FloatingTTSBar";

export default function ChatScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const sessionRef = useRef<ChatSession | null>(null);

  // Read-only mode when viewing a past conversation from history
  const isReadOnly = !!sessionId;

  const sendChatMessage = useAppStore((s) => s.sendChatMessage);
  const executeChatAction = useAppStore((s) => s.executeChatAction);
  const appState = useAppStore((s) => s.state);

  // ── Session persistence ─────────────────────────────────

  // On mount: load specific session (read-only) or resume last (within 24h)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      cleanupOldSessions(); // fire-and-forget
      if (sessionId) {
        const session = await loadSessionById(sessionId);
        if (cancelled) return;
        if (session) {
          sessionRef.current = session;
          setMessages(session.messages as ChatMessage[]);
        }
      } else {
        const resumable = await findResumableSession();
        if (cancelled) return;
        if (resumable && resumable.messages.length > 0) {
          sessionRef.current = resumable;
          setMessages(resumable.messages as ChatMessage[]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Auto-save whenever messages change (debounced to coalesce rapid updates)
  useEffect(() => {
    if (messages.length === 0 || isReadOnly) return;
    const timeout = setTimeout(() => {
      const now = Date.now();
      if (!sessionRef.current) {
        sessionRef.current = {
          id: makeId("chat"),
          title: deriveTitle(messages),
          messages,
          createdAt: now,
          updatedAt: now,
        };
      } else {
        sessionRef.current = {
          ...sessionRef.current,
          title: deriveTitle(messages),
          messages,
          updatedAt: now,
        };
      }
      saveSession(sessionRef.current);
    }, 500);
    return () => clearTimeout(timeout);
  }, [messages, isReadOnly]);

  // ── New conversation ────────────────────────────────────

  const handleNewConversation = useCallback(() => {
    sessionRef.current = null;
    setMessages([]);
    setInputText("");
  }, []);

  // Build envelope ID → name lookup for ActionPreviewCard
  const envelopeLookup = useMemo(() => {
    const map = new Map<string, string>();
    if (appState?.budget?.envelopes) {
      for (const env of appState.budget.envelopes) {
        map.set(env.id, env.name);
      }
    }
    return map;
  }, [appState?.budget?.envelopes]);

  // ── TTS ────────────────────────────────────────────────
  const assistantMessages = useMemo(
    () =>
      messages
        .filter((m) => m.role === "assistant")
        .map((m) => ({ id: m.id, content: m.content })),
    [messages],
  );
  const { ttsState, play, pause, resume, stop, skipNext, skipPrev } =
    useTTS(assistantMessages);

  const currentSnippet = useMemo(() => {
    if (!ttsState.currentMessageId) return "";
    const msg = messages.find((m) => m.id === ttsState.currentMessageId);
    return msg?.content.slice(0, 80) ?? "";
  }, [ttsState.currentMessageId, messages]);

  // Stop TTS when starting a new conversation
  const handleNewConversationOrig = handleNewConversation;
  const handleNewConversationWithTTS = useCallback(() => {
    stop();
    handleNewConversationOrig();
  }, [stop, handleNewConversationOrig]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMsg: ChatMessage = {
        id: makeId("msg"),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInputText("");
      setIsTyping(true);

      try {
        // Build conversation history for the Cloud Function
        const history: ChatMessageEntry[] = updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const result = await sendChatMessage(history);

        const aiMsg: ChatMessage = {
          id: makeId("msg"),
          role: "assistant",
          content: result.reply,
          timestamp: Date.now(),
          action: result.action,
          actionStatus: result.action ? "pending" : undefined,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch {
        const errorMsg: ChatMessage = {
          id: makeId("msg"),
          role: "assistant",
          content: "Sorry, I wasn't able to respond right now. Please try again in a moment.",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsTyping(false);
      }
    },
    [messages, sendChatMessage],
  );

  const handleConfirmAction = useCallback(
    async (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg?.action) return;

      // Set executing state
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, actionStatus: "executing" as const } : m)),
      );

      try {
        await executeChatAction(msg.action);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, actionStatus: "executed" as const } : m)),
        );
      } catch {
        // Show error state — buttons remain for retry
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, actionStatus: "error" as const } : m)),
        );
      }
    },
    [messages, executeChatAction],
  );

  const handleCancelAction = useCallback(
    (messageId: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, actionStatus: "dismissed" as const } : m)),
      );
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

  // Show follow-up chips when last message is an executed action and we're not typing
  const lastMsg = messages[messages.length - 1];
  const showFollowUp =
    !isReadOnly &&
    !isTyping &&
    lastMsg?.role === "assistant" &&
    lastMsg.actionStatus === "executed" &&
    lastMsg.action?.toolName;

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
          <Pressable
            style={styles.historyLink}
            onPress={() => router.push("/chat-history")}
            accessibilityLabel="View past conversations"
          >
            <Text style={styles.historyLinkText}>View past conversations</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <ChatBubble
              message={item}
              onConfirmAction={handleConfirmAction}
              onCancelAction={handleCancelAction}
              envelopeLookup={envelopeLookup}
              onTTSPlay={play}
            />
          )}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          ListHeaderComponent={
            isReadOnly ? null : (
              <Pressable
                style={styles.newChatBtn}
                onPress={handleNewConversationWithTTS}
                accessibilityLabel="Start new conversation"
              >
                <Text style={styles.newChatBtnText}>+ New conversation</Text>
              </Pressable>
            )
          }
          ListFooterComponent={
            <>
              {isTyping && (
                <View style={styles.typingRow}>
                  <View style={styles.typingAvatar}>
                    <Text style={styles.typingAvatarText}>MS</Text>
                  </View>
                  <View style={styles.typingBubble}>
                    <Text style={styles.typingDots}>...</Text>
                  </View>
                </View>
              )}
              {showFollowUp && (
                <FollowUpChips
                  toolName={lastMsg.action!.toolName}
                  onSelect={handleChipSelect}
                />
              )}
            </>
          }
        />
      )}

      {/* Floating TTS bar — visible when playing/paused */}
      <FloatingTTSBar
        ttsState={ttsState}
        currentSnippet={currentSnippet}
        onPause={pause}
        onResume={resume}
        onSkipPrev={skipPrev}
        onSkipNext={skipNext}
        onStop={stop}
      />

      {/* Input bar — hidden in read-only mode */}
      {!isReadOnly && (
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
      )}
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

    // ── History link ──────────────────────────
    historyLink: {
      marginTop: Spacing.md,
    },
    historyLinkText: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.semibold,
      color: c.primary,
    },

    // ── Message list ───────────────────────────
    messageList: {
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
    },

    // ── New conversation button ────────────────
    newChatBtn: {
      alignSelf: "center",
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    newChatBtnText: {
      fontSize: FontSize.caption,
      fontWeight: FontWeight.semibold,
      color: c.primary,
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
