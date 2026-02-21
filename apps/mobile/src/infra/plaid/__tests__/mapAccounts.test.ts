import { Money } from "@money-shepherd/domain";
import type { Account } from "@money-shepherd/domain";
import { mapPlaidAccounts } from "../mapAccounts";
import type { PlaidAccountInfo } from "../plaidClient";

const CHECKING: PlaidAccountInfo = {
  plaidAccountId: "abc123",
  name: "Plaid Checking",
  officialName: "Plaid Gold Checking",
  type: "depository",
  subtype: "checking",
  mask: "0000",
};

const SAVINGS: PlaidAccountInfo = {
  plaidAccountId: "def456",
  name: "Plaid Saving",
  officialName: null,
  type: "depository",
  subtype: "savings",
  mask: "1111",
};

describe("mapPlaidAccounts", () => {
  it("creates domain accounts from Plaid accounts", () => {
    const result = mapPlaidAccounts([CHECKING, SAVINGS], "user-los", []);

    expect(result.accounts).toHaveLength(2);
    expect(result.accounts[0]).toEqual({
      id: "plaid-abc123",
      name: "Plaid Gold Checking",
      balance: Money.fromCents(0),
    });
    expect(result.accounts[1]).toEqual({
      id: "plaid-def456",
      name: "Plaid Saving",
      balance: Money.fromCents(0),
    });
  });

  it("uses name when officialName is null", () => {
    const result = mapPlaidAccounts([SAVINGS], "user-los", []);
    expect(result.accounts[0].name).toBe("Plaid Saving");
  });

  it("returns correct mappings with userId", () => {
    const result = mapPlaidAccounts([CHECKING], "user-los", []);

    expect(result.mappings).toEqual([
      {
        plaidAccountId: "abc123",
        internalAccountId: "plaid-abc123",
        userId: "user-los",
      },
    ]);
  });

  it("does not duplicate accounts on re-connect", () => {
    const existingAccounts: Account[] = [
      { id: "plaid-abc123", name: "Plaid Gold Checking", balance: Money.fromCents(5000) },
    ];

    const result = mapPlaidAccounts([CHECKING, SAVINGS], "user-los", existingAccounts);

    expect(result.accounts).toHaveLength(2);
    // Existing account preserved with its balance
    expect(result.accounts[0].balance.cents).toBe(5000);
    // New account added
    expect(result.accounts[1].id).toBe("plaid-def456");
  });

  it("preserves non-Plaid accounts in the merged result", () => {
    const manual: Account = {
      id: "acc-los",
      name: "Los Checking",
      balance: Money.fromCents(10000),
    };

    const result = mapPlaidAccounts([CHECKING], "user-los", [manual]);

    expect(result.accounts).toHaveLength(2);
    expect(result.accounts[0]).toEqual(manual);
    expect(result.accounts[1].id).toBe("plaid-abc123");
  });

  it("handles empty Plaid accounts list", () => {
    const result = mapPlaidAccounts([], "user-los", []);
    expect(result.accounts).toEqual([]);
    expect(result.mappings).toEqual([]);
    expect(result.accountIdMap).toEqual({});
  });

  it("returns accountIdMap mapping plaidAccountId to internalAccountId", () => {
    const result = mapPlaidAccounts([CHECKING, SAVINGS], "user-los", []);
    expect(result.accountIdMap).toEqual({
      abc123: "plaid-abc123",
      def456: "plaid-def456",
    });
  });

  describe("reconnect with different Plaid IDs", () => {
    it("reuses existing account when name matches (reconnect scenario)", () => {
      const existingAccounts: Account[] = [
        { id: "plaid-old-id-1", name: "Plaid Gold Checking", balance: Money.fromCents(5000) },
      ];

      const reconnectedChecking: PlaidAccountInfo = {
        ...CHECKING,
        plaidAccountId: "new-id-999", // Plaid assigned a new ID
      };

      const result = mapPlaidAccounts([reconnectedChecking], "user-los", existingAccounts);

      // Should reuse existing account, not create a duplicate
      expect(result.accounts).toHaveLength(1);
      expect(result.accounts[0].id).toBe("plaid-old-id-1");
      expect(result.accounts[0].balance.cents).toBe(5000);

      // accountIdMap maps new Plaid ID → old internal ID
      expect(result.accountIdMap["new-id-999"]).toBe("plaid-old-id-1");

      // mapping also uses the old internal ID
      expect(result.mappings[0].internalAccountId).toBe("plaid-old-id-1");
    });

    it("creates new account when no name match exists", () => {
      const existingAccounts: Account[] = [
        { id: "plaid-old-id-1", name: "Completely Different Name", balance: Money.fromCents(0) },
      ];

      const result = mapPlaidAccounts([CHECKING], "user-los", existingAccounts);

      expect(result.accounts).toHaveLength(2);
      expect(result.accountIdMap["abc123"]).toBe("plaid-abc123");
    });

    it("handles mix of matched and new accounts on reconnect", () => {
      const existingAccounts: Account[] = [
        { id: "plaid-old-checking", name: "Plaid Gold Checking", balance: Money.fromCents(5000) },
      ];

      const reconnectedChecking: PlaidAccountInfo = {
        ...CHECKING,
        plaidAccountId: "new-checking-id",
      };

      const result = mapPlaidAccounts(
        [reconnectedChecking, SAVINGS],
        "user-los",
        existingAccounts,
      );

      expect(result.accounts).toHaveLength(2);
      expect(result.accountIdMap["new-checking-id"]).toBe("plaid-old-checking");
      expect(result.accountIdMap["def456"]).toBe("plaid-def456");
    });
  });
});
