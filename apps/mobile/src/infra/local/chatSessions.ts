import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ChatAction } from "../firebase/aiTypes";

const KEY = "ms.chat_sessions_v1";

// ── Types ─────────────────────────────────────────────────

type ActionStatus = "pending" | "executing" | "executed" | "dismissed" | "error";

export type PersistedMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  action?: ChatAction;
  actionStatus?: ActionStatus;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: PersistedMessage[];
  createdAt: number;
  updatedAt: number;
};

// ── Helpers ───────────────────────────────────────────────

const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Auto-title from first user message, truncated to ~40 chars */
export function deriveTitle(messages: PersistedMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New conversation";
  const text = first.content.trim();
  if (text.length <= 40) return text;
  return text.slice(0, 37) + "...";
}

// ── Storage API ───────────────────────────────────────────

async function readAll(): Promise<ChatSession[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as ChatSession[]) : [];
}

async function writeAll(sessions: ChatSession[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(sessions));
}

/** Load all sessions, sorted by updatedAt descending (newest first). */
export async function loadSessions(): Promise<ChatSession[]> {
  const sessions = await readAll();
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Save or update a session. Upserts by session.id. */
export async function saveSession(session: ChatSession): Promise<void> {
  const sessions = await readAll();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.push(session);
  }
  await writeAll(sessions);
}

/** Delete a session by ID. */
export async function deleteSession(id: string): Promise<void> {
  const sessions = await readAll();
  await writeAll(sessions.filter((s) => s.id !== id));
}

/**
 * Find the most recent session eligible for auto-resume.
 * Returns it if updatedAt is within the last 24 hours, otherwise null.
 */
export async function findResumableSession(): Promise<ChatSession | null> {
  const sessions = await loadSessions(); // already sorted newest first
  if (sessions.length === 0) return null;
  const latest = sessions[0];
  if (Date.now() - latest.updatedAt < RESUME_WINDOW_MS) return latest;
  return null;
}

/**
 * Remove sessions older than 30 days.
 * Call on app launch or when opening the history screen.
 */
export async function cleanupOldSessions(): Promise<number> {
  const sessions = await readAll();
  const cutoff = Date.now() - RETENTION_MS;
  const kept = sessions.filter((s) => s.updatedAt >= cutoff);
  const removed = sessions.length - kept.length;
  if (removed > 0) await writeAll(kept);
  return removed;
}
