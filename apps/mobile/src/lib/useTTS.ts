import { useCallback, useEffect, useRef, useState } from "react";
// eslint-disable-next-line import/no-unresolved
import * as Speech from "expo-speech";
import { loadVoiceId } from "../infra/local/voicePreference";

export type TTSState = {
  currentMessageId: string | null;
  isPlaying: boolean;
  isPaused: boolean;
  /** 1-based index of current message in assistant message list */
  currentIndex: number;
  /** Total number of assistant messages */
  totalMessages: number;
};

const INITIAL_STATE: TTSState = {
  currentMessageId: null,
  isPlaying: false,
  isPaused: false,
  currentIndex: 0,
  totalMessages: 0,
};

/** Strip **bold** and *italic* markdown markers before speaking */
function stripMarkdown(text: string): string {
  return text.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");
}

/**
 * Hook wrapping expo-speech for per-message TTS playback.
 * Accepts the ordered list of assistant message IDs + content for skip navigation.
 */
export function useTTS(
  assistantMessages: { id: string; content: string }[],
) {
  const [state, setState] = useState<TTSState>(INITIAL_STATE);
  const messagesRef = useRef(assistantMessages);
  messagesRef.current = assistantMessages;

  // Saved voice ID — loaded once on mount, kept in a ref so speakMessage sees it
  const voiceIdRef = useRef<string | undefined>(undefined);

  // Generation counter — prevents stale onStopped/onDone callbacks from
  // resetting state after a skip (stop old → speak new race condition).
  const genRef = useRef(0);

  // Load saved voice preference on mount; clean up on unmount
  useEffect(() => {
    loadVoiceId().then((id) => {
      voiceIdRef.current = id ?? undefined;
    });
    return () => {
      genRef.current += 1;
      Speech.stop();
    };
  }, []);

  /** Ref to speakByIndex so onDone can auto-advance without stale closures */
  const speakByIndexRef = useRef<(idx: number) => void>(() => {});

  const speakMessage = useCallback((id: string, text: string) => {
    genRef.current += 1;
    const gen = genRef.current;
    const msgs = messagesRef.current;
    const idx = msgs.findIndex((m) => m.id === id);
    Speech.stop();
    setState({
      currentMessageId: id,
      isPlaying: true,
      isPaused: false,
      currentIndex: idx + 1,
      totalMessages: msgs.length,
    });
    Speech.speak(stripMarkdown(text), {
      ...(voiceIdRef.current ? { voice: voiceIdRef.current } : {}),
      onDone: () => {
        if (genRef.current !== gen) return;
        // Auto-advance to next assistant message
        const nextIdx = idx + 1;
        if (nextIdx < messagesRef.current.length) {
          speakByIndexRef.current(nextIdx);
        } else {
          setState(INITIAL_STATE);
        }
      },
      onStopped: () => { if (genRef.current === gen) setState(INITIAL_STATE); },
    });
  }, []);

  const speakByIndex = useCallback((idx: number) => {
    const msgs = messagesRef.current;
    if (idx < 0 || idx >= msgs.length) return;
    speakMessage(msgs[idx].id, msgs[idx].content);
  }, [speakMessage]);

  // Keep ref in sync for auto-advance callback
  speakByIndexRef.current = speakByIndex;

  const play = useCallback(
    (messageId: string) => {
      const msg = messagesRef.current.find((m) => m.id === messageId);
      if (!msg) return;
      speakMessage(msg.id, msg.content);
    },
    [speakMessage],
  );

  const pause = useCallback(() => {
    Speech.pause();
    setState((prev) => ({ ...prev, isPlaying: false, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    Speech.resume();
    setState((prev) => ({ ...prev, isPlaying: true, isPaused: false }));
  }, []);

  const stop = useCallback(() => {
    genRef.current += 1;
    Speech.stop();
    setState(INITIAL_STATE);
  }, []);

  const skipNext = useCallback(() => {
    const msgs = messagesRef.current;
    const idx = msgs.findIndex((m) => m.id === state.currentMessageId);
    if (idx < 0 || idx >= msgs.length - 1) return;
    const next = msgs[idx + 1];
    speakMessage(next.id, next.content);
  }, [state.currentMessageId, speakMessage]);

  const skipPrev = useCallback(() => {
    const msgs = messagesRef.current;
    const idx = msgs.findIndex((m) => m.id === state.currentMessageId);
    if (idx <= 0) return;
    const prev = msgs[idx - 1];
    speakMessage(prev.id, prev.content);
  }, [state.currentMessageId, speakMessage]);

  return { ttsState: state, play, pause, resume, stop, skipNext, skipPrev };
}
