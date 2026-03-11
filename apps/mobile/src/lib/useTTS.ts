import { useCallback, useEffect, useRef, useState } from "react";
// eslint-disable-next-line import/no-unresolved
import * as Speech from "expo-speech";

export type TTSState = {
  currentMessageId: string | null;
  isPlaying: boolean;
  isPaused: boolean;
};

const INITIAL_STATE: TTSState = {
  currentMessageId: null,
  isPlaying: false,
  isPaused: false,
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

  // Clean up on unmount
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const speakMessage = useCallback((id: string, text: string) => {
    Speech.stop();
    setState({ currentMessageId: id, isPlaying: true, isPaused: false });
    Speech.speak(stripMarkdown(text), {
      onDone: () => setState(INITIAL_STATE),
      onStopped: () => setState(INITIAL_STATE),
    });
  }, []);

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
