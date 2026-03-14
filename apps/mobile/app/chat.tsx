import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ChatBubble, type ChatMessage } from "../src/ui/components/ChatBubble";
import { ShepherdAvatar } from "../src/ui/components/ShepherdAvatar";
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

const HEADER_H = 52;
const DOT_SIZE = 8;
const DOT_COLOR = "#b8860b"; // dark gold

function TypingDots() {
  const y0 = useSharedValue(0);
  const y1 = useSharedValue(0);
  const y2 = useSharedValue(0);

  const bounce = withRepeat(
    withSequence(
      withTiming(-6, { duration: 280, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 280, easing: Easing.in(Easing.quad) }),
      withTiming(0, { duration: 160 }), // brief pause before next cycle
    ),
    -1,
    false,
  );

  useEffect(() => {
    y0.value = bounce;
    y1.value = withDelay(150, bounce);
    y2.value = withDelay(300, bounce);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s0 = useAnimatedStyle(() => ({ transform: [{ translateY: y0.value }] }));
  const s1 = useAnimatedStyle(() => ({ transform: [{ translateY: y1.value }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateY: y2.value }] }));

  return (
    <View style={dotStyles.row}>
      <Reanimated.View style={[dotStyles.dot, s0]} />
      <Reanimated.View style={[dotStyles.dot, s1]} />
      <Reanimated.View style={[dotStyles.dot, s2]} />
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: DOT_COLOR,
  },
});

export default function ChatScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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

        const actions = result.actions ?? (result.action ? [result.action] : undefined);
        const aiMsg: ChatMessage = {
          id: makeId("msg"),
          role: "assistant",
          content: result.reply,
          timestamp: Date.now(),
          actions,
          actionStatuses: actions ? actions.map(() => "pending" as const) : undefined,
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
      const actions = msg?.actions ?? (msg?.action ? [msg.action] : []);
      if (actions.length === 0) return;

      // Execute each action sequentially, updating per-action status
      for (let i = 0; i < actions.length; i++) {
        // Mark current action as executing
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId) return m;
            const statuses = [...(m.actionStatuses ?? [])];
            statuses[i] = "executing";
            return { ...m, actionStatuses: statuses };
          }),
        );

        try {
          await executeChatAction(actions[i]);
          // Mark current action as executed
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== messageId) return m;
              const statuses = [...(m.actionStatuses ?? [])];
              statuses[i] = "executed";
              return { ...m, actionStatuses: statuses };
            }),
          );
        } catch {
          // Mark current action as error, remaining as pending (stop execution)
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== messageId) return m;
              const statuses = [...(m.actionStatuses ?? [])];
              statuses[i] = "error";
              return { ...m, actionStatuses: statuses };
            }),
          );
          return; // Stop executing remaining actions
        }
      }
    },
    [messages, executeChatAction],
  );

  const handleCancelAction = useCallback(
    (messageId: string) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const statuses = (m.actionStatuses ?? []).map(() => "dismissed" as const);
          return { ...m, actionStatuses: statuses };
        }),
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

  // Show follow-up chips when last message has all actions executed and we're not typing
  const lastMsg = messages[messages.length - 1];
  const lastActions = lastMsg?.actions ?? (lastMsg?.action ? [lastMsg.action] : []);
  const lastStatuses = lastMsg?.actionStatuses ?? (lastMsg?.actionStatus ? [lastMsg.actionStatus] : []);
  const allExecuted = lastStatuses.length > 0 && lastStatuses.every((s) => s === "executed");
  const lastExecutedAction = allExecuted ? lastActions[lastActions.length - 1] : undefined;
  const showFollowUp =
    !isReadOnly &&
    !isTyping &&
    lastMsg?.role === "assistant" &&
    allExecuted &&
    lastExecutedAction;

  return (
    <View style={styles.root}>
      {/* Custom header — replaces native Stack header */}
      <View style={[styles.chatHeader, { paddingTop: insets.top }]}>
        <ShepherdAvatar size={28} />
        <Text style={styles.chatTitle}>Money Shepherd</Text>
        <Pressable
          onPress={() => router.push("/chat-history")}
          hitSlop={8}
          style={styles.closeBtn}
          accessibilityLabel="View chat history"
          accessibilityRole="button"
        >
          <MaterialIcons name="history" size={24} color={colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.closeBtn}
          accessibilityLabel="Close chat"
          accessibilityRole="button"
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.messageArea}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={insets.top + HEADER_H}
      >
        {isEmpty ? (
          <View style={styles.emptyState}>
            <ShepherdAvatar size={56} />
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
                    <ShepherdAvatar size={28} />
                    <View style={styles.typingBubble}>
                      <TypingDots />
                    </View>
                  </View>
                )}
                {showFollowUp && lastExecutedAction && (
                  <FollowUpChips
                    action={lastExecutedAction}
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
    </View>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.surface,
    },

    // ── Modal header ───────────────────────────
    chatHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.base,
      paddingBottom: Spacing.sm,
      minHeight: HEADER_H,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderLight,
      gap: Spacing.sm,
    },
    chatTitle: {
      flex: 1,
      fontSize: FontSize.subtitle,
      fontWeight: FontWeight.semibold,
      color: c.textDark,
    },
    closeBtn: {
      padding: Spacing.xs,
    },
    closeBtnText: {
      fontSize: 18,
      color: c.textMuted,
    },
    messageArea: {
      flex: 1,
    },

    // ── Empty state ────────────────────────────
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Spacing.lg,
      gap: Spacing.md,
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
      letterSpacing: 0,
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
