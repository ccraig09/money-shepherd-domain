import {
  loadSessions,
  saveSession,
  deleteSession,
  findResumableSession,
  cleanupOldSessions,
  deriveTitle,
} from "../chatSessions";

// ── AsyncStorage mock ─────────────────────────────────────
const store = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    getItem: jest.fn((key: string) => {
      return Promise.resolve(store.get(key) ?? null);
    }),
    removeItem: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  },
}));

beforeEach(() => store.clear());

// ── Helpers ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeMsg(overrides: any) {
  return {
    role: "user",
    content: "Hello",
    timestamp: Date.now(),
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeSession(overrides: any) {
  const now = Date.now();
  return {
    title: "Test session",
    messages: [makeMsg({ id: "m1" })],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────

describe("chatSessions", () => {
  describe("saveSession + loadSessions round-trip", () => {
    it("saves and loads a session", async () => {
      const session = makeSession({ id: "s1" });
      await saveSession(session);
      const loaded = await loadSessions();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe("s1");
      expect(loaded[0].messages).toHaveLength(1);
    });

    it("upserts an existing session by ID", async () => {
      const session = makeSession({ id: "s1", title: "Original" });
      await saveSession(session);
      await saveSession({ ...session, title: "Updated", updatedAt: Date.now() + 1000 });
      const loaded = await loadSessions();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].title).toBe("Updated");
    });

    it("returns sessions sorted by updatedAt descending", async () => {
      await saveSession(makeSession({ id: "s1", updatedAt: 1000 }));
      await saveSession(makeSession({ id: "s2", updatedAt: 3000 }));
      await saveSession(makeSession({ id: "s3", updatedAt: 2000 }));
      const loaded = await loadSessions();
      expect(loaded.map((s) => s.id)).toEqual(["s2", "s3", "s1"]);
    });
  });

  describe("deleteSession", () => {
    it("removes a session by ID", async () => {
      await saveSession(makeSession({ id: "s1" }));
      await saveSession(makeSession({ id: "s2" }));
      await deleteSession("s1");
      const loaded = await loadSessions();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe("s2");
    });

    it("does nothing when deleting a non-existent ID", async () => {
      await saveSession(makeSession({ id: "s1" }));
      await deleteSession("nope");
      const loaded = await loadSessions();
      expect(loaded).toHaveLength(1);
    });
  });

  describe("findResumableSession", () => {
    it("returns the latest session if updated within 24h", async () => {
      await saveSession(makeSession({ id: "s1", updatedAt: Date.now() - 1000 }));
      const result = await findResumableSession();
      expect(result).not.toBeNull();
      expect(result!.id).toBe("s1");
    });

    it("returns null if the latest session is older than 24h", async () => {
      const over24h = Date.now() - 25 * 60 * 60 * 1000;
      await saveSession(makeSession({ id: "s1", updatedAt: over24h }));
      const result = await findResumableSession();
      expect(result).toBeNull();
    });

    it("returns null when no sessions exist", async () => {
      const result = await findResumableSession();
      expect(result).toBeNull();
    });
  });

  describe("cleanupOldSessions", () => {
    it("removes sessions older than 30 days", async () => {
      const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
      await saveSession(makeSession({ id: "old", updatedAt: old }));
      await saveSession(makeSession({ id: "recent", updatedAt: Date.now() }));

      const removed = await cleanupOldSessions();
      expect(removed).toBe(1);

      const loaded = await loadSessions();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe("recent");
    });

    it("returns 0 when nothing to clean", async () => {
      await saveSession(makeSession({ id: "s1", updatedAt: Date.now() }));
      const removed = await cleanupOldSessions();
      expect(removed).toBe(0);
    });
  });

  describe("deriveTitle", () => {
    it("uses first user message as title", () => {
      const msgs = [
        makeMsg({ id: "m1", role: "user", content: "How much did I spend?" }),
      ];
      expect(deriveTitle(msgs)).toBe("How much did I spend?");
    });

    it("truncates long messages to ~40 chars", () => {
      const long = "A".repeat(60);
      const msgs = [makeMsg({ id: "m1", role: "user", content: long })];
      const title = deriveTitle(msgs);
      expect(title.length).toBeLessThanOrEqual(40);
      expect(title.endsWith("...")).toBe(true);
    });

    it("returns fallback when no user message exists", () => {
      const msgs = [
        makeMsg({ id: "m1", role: "assistant", content: "Hi there!" }),
      ];
      expect(deriveTitle(msgs)).toBe("New conversation");
    });

    it("returns fallback for empty messages", () => {
      expect(deriveTitle([])).toBe("New conversation");
    });
  });
});
