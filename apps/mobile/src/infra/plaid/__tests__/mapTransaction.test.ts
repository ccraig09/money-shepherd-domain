import {
  mapPlaidTransaction,
  mapPlaidTransactions,
  type PlaidTransaction,
} from "../mapTransaction";

const ACCOUNT_MAP: Record<string, string> = {
  "plaid-acc-001": "plaid-plaid-acc-001",
};

function makePlaidTx(overrides: Partial<PlaidTransaction> = {}): PlaidTransaction {
  return {
    transaction_id: "tx-abc-123",
    account_id: "plaid-acc-001",
    amount: 5.5,
    date: "2024-01-15",
    merchant_name: "Starbucks",
    name: "STARBUCKS #1234",
    ...overrides,
  };
}

describe("mapPlaidTransaction", () => {
  describe("sign convention", () => {
    it("negates a positive Plaid amount to a negative domain expense", () => {
      const tx = mapPlaidTransaction(makePlaidTx({ amount: 25.0 }), ACCOUNT_MAP);
      expect(tx.amount.cents).toBe(-2500);
    });

    it("negates a negative Plaid amount to a positive domain income", () => {
      const tx = mapPlaidTransaction(makePlaidTx({ amount: -100.0 }), ACCOUNT_MAP);
      expect(tx.amount.cents).toBe(10000);
    });

    it("handles zero amount", () => {
      const tx = mapPlaidTransaction(makePlaidTx({ amount: 0 }), ACCOUNT_MAP);
      expect(tx.amount.cents).toBe(0);
    });
  });

  describe("amount precision", () => {
    it("converts dollars to cents correctly for two-decimal amounts", () => {
      const tx = mapPlaidTransaction(makePlaidTx({ amount: 12.99 }), ACCOUNT_MAP);
      expect(tx.amount.cents).toBe(-1299);
    });

    it("handles single-decimal amounts", () => {
      const tx = mapPlaidTransaction(makePlaidTx({ amount: 5.5 }), ACCOUNT_MAP);
      expect(tx.amount.cents).toBe(-550);
    });
  });

  describe("description", () => {
    it("prefers merchant_name when available", () => {
      const tx = mapPlaidTransaction(
        makePlaidTx({ merchant_name: "Starbucks", name: "STARBUCKS #1234" }),
        ACCOUNT_MAP
      );
      expect(tx.description).toBe("Starbucks");
    });

    it("falls back to name when merchant_name is null", () => {
      const tx = mapPlaidTransaction(
        makePlaidTx({ merchant_name: null }),
        ACCOUNT_MAP
      );
      expect(tx.description).toBe("STARBUCKS #1234");
    });

    it("uses fallback when both merchant_name and name are null", () => {
      const tx = mapPlaidTransaction(
        makePlaidTx({ merchant_name: null, name: null }),
        ACCOUNT_MAP
      );
      expect(tx.description).toBe("Unknown transaction");
    });
  });

  describe("date mapping", () => {
    it("converts Plaid date to ISO string", () => {
      const tx = mapPlaidTransaction(makePlaidTx({ date: "2024-06-30" }), ACCOUNT_MAP);
      expect(tx.postedAt).toBe("2024-06-30T00:00:00.000Z");
    });
  });

  describe("ID and account mapping", () => {
    it("generates a stable ID from Plaid transaction_id", () => {
      const tx = mapPlaidTransaction(makePlaidTx({ transaction_id: "abc-999" }), ACCOUNT_MAP);
      expect(tx.id).toBe("plaid-tx-abc-999");
    });

    it("maps account_id via the account mapping table", () => {
      const tx = mapPlaidTransaction(makePlaidTx(), ACCOUNT_MAP);
      expect(tx.accountId).toBe("plaid-plaid-acc-001");
    });

    it("uses plaid-prefixed account_id when no mapping exists", () => {
      const tx = mapPlaidTransaction(
        makePlaidTx({ account_id: "unmapped-acc" }),
        ACCOUNT_MAP
      );
      expect(tx.accountId).toBe("plaid-unmapped-acc");
    });
  });
});

describe("mapPlaidTransactions", () => {
  it("maps a batch of transactions", () => {
    const plaidTxs = [
      makePlaidTx({ transaction_id: "tx-1", amount: 10.0 }),
      makePlaidTx({ transaction_id: "tx-2", amount: -50.0 }),
    ];

    const result = mapPlaidTransactions(plaidTxs, ACCOUNT_MAP);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("plaid-tx-tx-1");
    expect(result[0].amount.cents).toBe(-1000);
    expect(result[1].id).toBe("plaid-tx-tx-2");
    expect(result[1].amount.cents).toBe(5000);
  });

  it("returns empty array for empty input", () => {
    expect(mapPlaidTransactions([], ACCOUNT_MAP)).toEqual([]);
  });
});
