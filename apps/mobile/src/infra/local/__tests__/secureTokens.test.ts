import {
  addPlaidToken,
  loadPlaidTokens,
  removePlaidToken,
  clearAllPlaidTokens,
  type PlaidTokenData,
} from "../secureTokens";

// Mock AsyncStorage with an in-memory map
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

beforeEach(() => {
  store.clear();
});

const CHASE: PlaidTokenData = {
  accessToken: "access-sandbox-chase-123",
  itemId: "item-chase-abc",
  institutionName: "Chase",
};

const WELLS: PlaidTokenData = {
  accessToken: "access-sandbox-wells-456",
  itemId: "item-wells-def",
  institutionName: "Wells Fargo",
};


describe("secureTokens (multi-item)", () => {
  describe("addPlaidToken + loadPlaidTokens", () => {
    it("stores and retrieves a single token", async () => {
      await addPlaidToken("user-los", CHASE);
      const tokens = await loadPlaidTokens("user-los");
      expect(tokens).toEqual([CHASE]);
    });

    it("appends a second bank without overwriting the first", async () => {
      await addPlaidToken("user-los", CHASE);
      await addPlaidToken("user-los", WELLS);
      const tokens = await loadPlaidTokens("user-los");
      expect(tokens).toEqual([CHASE, WELLS]);
    });

    it("replaces a token when re-connecting the same bank (same itemId)", async () => {
      await addPlaidToken("user-los", CHASE);
      const updatedChase = { ...CHASE, accessToken: "access-new-token" };
      await addPlaidToken("user-los", updatedChase);
      const tokens = await loadPlaidTokens("user-los");
      expect(tokens).toEqual([updatedChase]);
    });

    it("returns empty array when no tokens stored", async () => {
      const tokens = await loadPlaidTokens("user-los");
      expect(tokens).toEqual([]);
    });
  });

  describe("user isolation", () => {
    it("keeps tokens separate between users", async () => {
      await addPlaidToken("user-los", CHASE);
      await addPlaidToken("user-jackia", WELLS);

      expect(await loadPlaidTokens("user-los")).toEqual([CHASE]);
      expect(await loadPlaidTokens("user-jackia")).toEqual([WELLS]);
    });
  });

  describe("removePlaidToken", () => {
    it("removes a specific bank by itemId", async () => {
      await addPlaidToken("user-los", CHASE);
      await addPlaidToken("user-los", WELLS);
      await removePlaidToken("user-los", CHASE.itemId);

      const tokens = await loadPlaidTokens("user-los");
      expect(tokens).toEqual([WELLS]);
    });

    it("does not throw when removing a non-existent itemId", async () => {
      await addPlaidToken("user-los", CHASE);
      await expect(removePlaidToken("user-los", "no-such-item")).resolves.toBeUndefined();
      expect(await loadPlaidTokens("user-los")).toEqual([CHASE]);
    });
  });

  describe("clearAllPlaidTokens", () => {
    it("removes all tokens for a user", async () => {
      await addPlaidToken("user-los", CHASE);
      await addPlaidToken("user-los", WELLS);
      await clearAllPlaidTokens("user-los");
      expect(await loadPlaidTokens("user-los")).toEqual([]);
    });

    it("does not affect another user", async () => {
      await addPlaidToken("user-los", CHASE);
      await addPlaidToken("user-jackia", WELLS);
      await clearAllPlaidTokens("user-los");

      expect(await loadPlaidTokens("user-los")).toEqual([]);
      expect(await loadPlaidTokens("user-jackia")).toEqual([WELLS]);
    });
  });

  describe("migration from single-object format", () => {
    it("auto-migrates old single-object format to array on read", async () => {
      // Simulate old format: a single object, not an array
      store.set("plaid_token_user-los", JSON.stringify(CHASE));

      const tokens = await loadPlaidTokens("user-los");
      expect(tokens).toEqual([CHASE]);

      // Verify it was migrated in storage
      const raw = store.get("plaid_token_user-los");
      expect(JSON.parse(raw!)).toEqual([CHASE]);
    });
  });
});
