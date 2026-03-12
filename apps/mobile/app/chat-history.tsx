import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  SectionList,
  Pressable,
  Animated,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  Spacing,
  FontSize,
  FontWeight,
  LineHeight,
  type ColorTokens,
} from "../src/ui/tokens";
import { useThemedStyles } from "@/src/ui/ThemeProvider";
import { ShepherdAvatar } from "@/src/ui/components/ShepherdAvatar";
import {
  loadSessions,
  deleteSession,
} from "@/src/infra/local/chatSessions";
import type { ChatSession } from "@/src/infra/local/chatSessions";

/** Format a relative time string: "Just now", "3m ago", "2h ago", "Yesterday", or date */
function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Strip **bold** and *italic* markdown markers */
function stripMarkdown(text: string): string {
  return text.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");
}

/** Extract first assistant message as preview */
function getPreview(session: ChatSession): string | null {
  const first = session.messages.find((m) => m.role === "assistant");
  return first ? stripMarkdown(first.content) : null;
}

/** Group sorted sessions into Today / This Week / Earlier */
function groupByTime(
  sessions: ChatSession[],
): { title: string; data: ChatSession[] }[] {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfWeek = startOfToday - 6 * 86_400_000;

  const today: ChatSession[] = [];
  const thisWeek: ChatSession[] = [];
  const earlier: ChatSession[] = [];

  for (const s of sessions) {
    if (s.updatedAt >= startOfToday) today.push(s);
    else if (s.updatedAt >= startOfWeek) thisWeek.push(s);
    else earlier.push(s);
  }

  return [
    { title: "Today", data: today },
    { title: "This Week", data: thisWeek },
    { title: "Earlier", data: earlier },
  ].filter((s) => s.data.length > 0);
}

export default function ChatHistoryScreen() {
  const styles = useThemedStyles(createStyles);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const loadData = useCallback(async () => {
    const all = await loadSessions();
    setSessions(all);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    },
    [],
  );

  const handleOpen = useCallback((session: ChatSession) => {
    router.push({ pathname: "/chat", params: { sessionId: session.id } });
  }, []);

  const renderRightActions = useCallback(
    (
      _progress: Animated.AnimatedInterpolation<number>,
      _drag: Animated.AnimatedInterpolation<number>,
      swipeable: Swipeable,
      sessionId: string,
    ) => (
      <Pressable
        style={styles.deleteAction}
        onPress={() => {
          swipeable.close();
          handleDelete(sessionId);
        }}
        accessibilityLabel="Delete conversation"
      >
        <Text style={styles.deleteActionText}>Delete</Text>
      </Pressable>
    ),
    [styles, handleDelete],
  );

  const sections = useMemo(() => groupByTime(sessions), [sessions]);

  if (sessions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No past conversations</Text>
        <Text style={styles.emptySubtitle}>
          Your chat history will appear here after you start a conversation.
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SectionList
        sections={sections}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Swipeable
            friction={2}
            rightThreshold={40}
            renderRightActions={(progress, drag, swipeable) =>
              renderRightActions(progress, drag, swipeable, item.id)
            }
          >
            <Pressable
              style={styles.row}
              onPress={() => handleOpen(item)}
              accessibilityLabel={`Open conversation: ${item.title}`}
            >
              <ShepherdAvatar size={36} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {getPreview(item) && (
                  <Text style={styles.rowPreview} numberOfLines={1}>
                    {getPreview(item)}
                  </Text>
                )}
                <Text style={styles.rowMeta}>
                  {item.messages.length} message{item.messages.length !== 1 ? "s" : ""} · {relativeTime(item.updatedAt)}
                </Text>
              </View>
              <Text style={styles.rowChevron}>›</Text>
            </Pressable>
          </Swipeable>
        )}
      />
    </GestureHandlerRootView>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.surface,
    },
    list: {
      paddingVertical: Spacing.sm,
    },

    // ── Section headers ─────────────────────────
    sectionHeader: {
      paddingHorizontal: Spacing.base,
      paddingTop: Spacing.base,
      paddingBottom: Spacing.xs,
      backgroundColor: c.surface,
    },
    sectionHeaderText: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.semibold,
      color: c.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    // ── Row ───────────────────────────────────
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
      backgroundColor: c.surface,
      gap: Spacing.md,
    },
    rowBody: {
      flex: 1,
      gap: 3,
    },
    rowTitle: {
      fontSize: FontSize.body,
      fontWeight: FontWeight.semibold,
      color: c.textDark,
    },
    rowPreview: {
      fontSize: FontSize.caption,
      fontStyle: "italic",
      color: c.textSubtle,
    },
    rowMeta: {
      fontSize: FontSize.caption,
      color: c.textMuted,
    },
    rowChevron: {
      fontSize: FontSize.subtitle,
      color: c.textMuted,
    },
    // ── Swipe delete action ───────────────────
    deleteAction: {
      backgroundColor: c.error,
      justifyContent: "center",
      alignItems: "center",
      width: 80,
    },
    deleteActionText: {
      color: "#fff",
      fontSize: FontSize.small,
      fontWeight: FontWeight.bold,
    },

    // ── Empty state ───────────────────────────
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Spacing.lg,
      gap: Spacing.sm,
      backgroundColor: c.surface,
    },
    emptyTitle: {
      fontSize: FontSize.subtitle,
      fontWeight: FontWeight.bold,
      color: c.textDark,
    },
    emptySubtitle: {
      fontSize: FontSize.body,
      lineHeight: LineHeight.body,
      color: c.textMuted,
      textAlign: "center",
      maxWidth: 280,
    },
  });
