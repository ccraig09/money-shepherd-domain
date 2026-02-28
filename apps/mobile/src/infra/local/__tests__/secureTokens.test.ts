import {
  addPlaidToken,
  loadPlaidTokens,
  removePlaidToken,
  clearAllPlaidTokens,
} from "../secureTokens";
import type { PlaidTokenData } from "../secureTokens";

// In-memory stores for SecureStore and AsyncStorage
const secureStoreMap = new Map<string, string>();
const asyncStorageMap = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn((key: string, value: string) => {
    secureStoreMap.set(key, value);
    return Promise.resolve();
  }),
  getItemAsync: jest.fn((key: string) => {
    return Promise.resolve(secureStoreMap.get(key) ?? null);
  }),
  deleteItemAsync: jest.fn((key: string) => {
    secureStoreMap.delete(key);
    return Promise.resolve();
  }),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    setItem: jest.fn((key: string, value: string) => {
      asyncStorageMap.set(key, value);
      return Promise.resolve();
    }),
    getItem: jest.fn((key: string) => {
      return Promise.resolve(asyncStorageMap.get(key) ?? null);
    }),
    removeItem: jest.fn((key: string) => {
      asyncStorageMap.delete(key);
      return Promise.resolve();
    }),
  },
}));

beforeEach(() => {
  secureStoreMap.clear();
  asyncStorageMap.clear();
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

describe("secureTokens (SecureStore backend)", () => {
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

    it("stores each token as a separate SecureStore key", async () => {
      await addPlaidToken("user-los", CHASE);
      await addPlaidToken("user-los", WELLS);

      // Index key contains both itemIds
      const indexRaw = secureStoreMap.get("plaid_idx_user-los");
      expect(JSON.parse(indexRaw!)).toEqual(["item-chase-abc", "item-wells-def"]);

      // Each token stored separately
      expect(secureStoreMap.has("plaid_tok_user-los_item-chase-abc")).toBe(true);
      expect(secureStoreMap.has("plaid_tok_user-los_item-wells-def")).toBe(true);
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

    it("cleans up the per-item SecureStore key on remove", async () => {
      await addPlaidToken("user-los", CHASE);
      await removePlaidToken("user-los", CHASE.itemId);

      expect(secureStoreMap.has("plaid_tok_user-los_item-chase-abc")).toBe(false);
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

    it("cleans up all SecureStore keys on clear", async () => {
      await addPlaidToken("user-los", CHASE);
      await addPlaidToken("user-los", WELLS);
      await clearAllPlaidTokens("user-los");

      expect(secureStoreMap.has("plaid_idx_user-los")).toBe(false);
      expect(secureStoreMap.has("plaid_tok_user-los_item-chase-abc")).toBe(false);
      expect(secureStoreMap.has("plaid_tok_user-los_item-wells-def")).toBe(false);
    });

    it("does not affect another user", async () => {
      await addPlaidToken("user-los", CHASE);
      await addPlaidToken("user-jackia", WELLS);
      await clearAllPlaidTokens("user-los");

      expect(await loadPlaidTokens("user-los")).toEqual([]);
      expect(await loadPlaidTokens("user-jackia")).toEqual([WELLS]);
    });
  });

  describe("migration from AsyncStorage", () => {
    it("migrates array format from AsyncStorage to SecureStore on first read", async () => {
      asyncStorageMap.set("plaid_token_user-los", JSON.stringify([CHASE, WELLS]));

      const tokens = await loadPlaidTokens("user-los");
      expect(tokens).toEqual([CHASE, WELLS]);

      // Old key removed
      expect(asyncStorageMap.has("plaid_token_user-los")).toBe(false);

      // Data now in SecureStore
      expect(secureStoreMap.has("plaid_idx_user-los")).toBe(true);
      expect(secureStoreMap.has("plaid_tok_user-los_item-chase-abc")).toBe(true);
      expect(secureStoreMap.has("plaid_tok_user-los_item-wells-def")).toBe(true);
    });

    it("migrates single-object format from AsyncStorage", async () => {
      asyncStorageMap.set("plaid_token_user-los", JSON.stringify(CHASE));

      const tokens = await loadPlaidTokens("user-los");
      expect(tokens).toEqual([CHASE]);

      expect(asyncStorageMap.has("plaid_token_user-los")).toBe(false);
      expect(secureStoreMap.has("plaid_tok_user-los_item-chase-abc")).toBe(true);
    });

    it("does not re-migrate once data is in SecureStore", async () => {
      // First read triggers migration
      asyncStorageMap.set("plaid_token_user-los", JSON.stringify([CHASE]));
      await loadPlaidTokens("user-los");

      // Put something back in AsyncStorage (should be ignored)
      asyncStorageMap.set("plaid_token_user-los", JSON.stringify([WELLS]));

      // Second read uses SecureStore, not AsyncStorage
      const tokens = await loadPlaidTokens("user-los");
      expect(tokens).toEqual([CHASE]);
    });

    it("returns empty array when neither storage has data", async () => {
      const tokens = await loadPlaidTokens("user-los");
      expect(tokens).toEqual([]);
    });
  });
});
