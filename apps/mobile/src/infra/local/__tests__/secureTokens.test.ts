import {
  savePlaidToken,
  loadPlaidToken,
  clearPlaidToken,
  hasPlaidToken,
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

const LOS_TOKEN: PlaidTokenData = {
  accessToken: "access-sandbox-los-123",
  itemId: "item-los-abc",
  institutionName: "Chase",
};

const JACKIA_TOKEN: PlaidTokenData = {
  accessToken: "access-sandbox-jackia-456",
  itemId: "item-jackia-def",
  institutionName: "Wells Fargo",
};

describe("secureTokens", () => {
  describe("savePlaidToken + loadPlaidToken", () => {
    it("stores and retrieves token data for a user", async () => {
      await savePlaidToken("user-los", LOS_TOKEN);
      const loaded = await loadPlaidToken("user-los");
      expect(loaded).toEqual(LOS_TOKEN);
    });

    it("returns null when no token is stored", async () => {
      const loaded = await loadPlaidToken("user-los");
      expect(loaded).toBeNull();
    });
  });

  describe("user isolation", () => {
    it("keeps tokens separate between users", async () => {
      await savePlaidToken("user-los", LOS_TOKEN);
      await savePlaidToken("user-jackia", JACKIA_TOKEN);

      expect(await loadPlaidToken("user-los")).toEqual(LOS_TOKEN);
      expect(await loadPlaidToken("user-jackia")).toEqual(JACKIA_TOKEN);
    });

    it("clearing one user does not affect the other", async () => {
      await savePlaidToken("user-los", LOS_TOKEN);
      await savePlaidToken("user-jackia", JACKIA_TOKEN);

      await clearPlaidToken("user-los");

      expect(await loadPlaidToken("user-los")).toBeNull();
      expect(await loadPlaidToken("user-jackia")).toEqual(JACKIA_TOKEN);
    });
  });

  describe("clearPlaidToken", () => {
    it("removes the stored token", async () => {
      await savePlaidToken("user-los", LOS_TOKEN);
      await clearPlaidToken("user-los");
      expect(await loadPlaidToken("user-los")).toBeNull();
    });

    it("does not throw when clearing a non-existent token", async () => {
      await expect(clearPlaidToken("user-los")).resolves.toBeUndefined();
    });
  });

  describe("hasPlaidToken", () => {
    it("returns true when a token is stored", async () => {
      await savePlaidToken("user-los", LOS_TOKEN);
      expect(await hasPlaidToken("user-los")).toBe(true);
    });

    it("returns false when no token is stored", async () => {
      expect(await hasPlaidToken("user-los")).toBe(false);
    });

    it("returns false after clearing a token", async () => {
      await savePlaidToken("user-los", LOS_TOKEN);
      await clearPlaidToken("user-los");
      expect(await hasPlaidToken("user-los")).toBe(false);
    });
  });
});
