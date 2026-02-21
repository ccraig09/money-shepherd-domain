import { buildAccountPickerList } from "../accountStatus";
import { Money } from "@money-shepherd/domain";
import type { Account } from "@money-shepherd/domain";
import type { PlaidTokenData } from "../../infra/local/secureTokens";

function acct(id: string, name = id): Account {
  return { id, name, balance: Money.fromCents(0) };
}

function token(
  itemId: string,
  accountIds?: string[],
  accountIdMap?: Record<string, string>,
): PlaidTokenData {
  return {
    accessToken: `tok-${itemId}`,
    itemId,
    institutionName: `Bank ${itemId}`,
    accountIds,
    accountIdMap,
  };
}

describe("buildAccountPickerList", () => {
  it("marks manual accounts as connected and non-plaid", () => {
    const items = buildAccountPickerList(
      [acct("manual-1")],
      [],
    );
    expect(items).toHaveLength(1);
    expect(items[0].isPlaid).toBe(false);
    expect(items[0].isConnected).toBe(true);
  });

  it("marks Plaid account as connected when token has matching accountIds", () => {
    const items = buildAccountPickerList(
      [acct("plaid-abc123")],
      [token("item1", ["abc123"])],
    );
    expect(items[0].isPlaid).toBe(true);
    expect(items[0].isConnected).toBe(true);
  });

  it("marks Plaid account as disconnected when no token matches", () => {
    const items = buildAccountPickerList(
      [acct("plaid-abc123")],
      [token("item1", ["other"])],
    );
    expect(items[0].isPlaid).toBe(true);
    expect(items[0].isConnected).toBe(false);
  });

  it("treats tokens without accountIds as pre-migration (no accounts connected)", () => {
    const items = buildAccountPickerList(
      [acct("plaid-abc123")],
      [token("item1")],
    );
    expect(items[0].isConnected).toBe(false);
  });

  it("sorts manual → connected Plaid → disconnected Plaid", () => {
    const items = buildAccountPickerList(
      [
        acct("plaid-disconn"),
        acct("manual-1"),
        acct("plaid-conn"),
      ],
      [token("item1", ["conn"])],
    );

    expect(items.map((i) => i.account.id)).toEqual([
      "manual-1",
      "plaid-conn",
      "plaid-disconn",
    ]);
  });

  it("returns empty array for empty inputs", () => {
    expect(buildAccountPickerList([], [])).toEqual([]);
  });

  it("handles multiple tokens each covering different accounts", () => {
    const items = buildAccountPickerList(
      [acct("plaid-a"), acct("plaid-b"), acct("plaid-c")],
      [
        token("item1", ["a"]),
        token("item2", ["b"]),
      ],
    );

    const connected = items.filter((i) => i.isConnected);
    const disconnected = items.filter((i) => !i.isConnected);
    expect(connected.map((i) => i.account.id)).toEqual(["plaid-a", "plaid-b"]);
    expect(disconnected.map((i) => i.account.id)).toEqual(["plaid-c"]);
  });

  describe("accountIdMap support", () => {
    it("marks Plaid account as connected via accountIdMap", () => {
      const items = buildAccountPickerList(
        [acct("plaid-old-id")],
        [token("item1", undefined, { "new-plaid-id": "plaid-old-id" })],
      );
      expect(items[0].isPlaid).toBe(true);
      expect(items[0].isConnected).toBe(true);
    });

    it("prefers accountIdMap over legacy accountIds", () => {
      const items = buildAccountPickerList(
        [acct("plaid-old-id")],
        [token("item1", ["wrong-id"], { "new-plaid-id": "plaid-old-id" })],
      );
      // accountIdMap maps to plaid-old-id which is correct
      expect(items[0].isConnected).toBe(true);
    });

    it("falls back to legacy accountIds when accountIdMap is absent", () => {
      const items = buildAccountPickerList(
        [acct("plaid-abc123")],
        [token("item1", ["abc123"])],
      );
      expect(items[0].isConnected).toBe(true);
    });
  });
});
