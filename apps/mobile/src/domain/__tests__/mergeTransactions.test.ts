import { Money } from "@money-shepherd/domain";
import type { Transaction } from "@money-shepherd/domain";
import { mergeTransactions } from "../mergeTransactions";

function makeTx(id: string, postedAt: string, cents = -1000): Transaction {
  return {
    id,
    accountId: "plaid-acc-001",
    amount: Money.fromCents(cents),
    description: "Test transaction",
    postedAt,
  };
}

describe("mergeTransactions", () => {
  describe("basic merging", () => {
    it("returns incoming transactions when existing list is empty", () => {
      const incoming = [makeTx("tx-1", "2024-01-15T00:00:00.000Z")];
      const result = mergeTransactions([], incoming);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("tx-1");
    });

    it("appends new transactions to existing ones", () => {
      const existing = [makeTx("tx-old", "2024-01-10T00:00:00.000Z")];
      const incoming = [makeTx("tx-new", "2024-01-15T00:00:00.000Z")];
      const result = mergeTransactions(existing, incoming);
      expect(result).toHaveLength(2);
    });
  });

  describe("deduplication", () => {
    it("does not duplicate a transaction already in existing", () => {
      const existing = [makeTx("tx-1", "2024-01-15T00:00:00.000Z")];
      const incoming = [makeTx("tx-1", "2024-01-15T00:00:00.000Z")];
      const result = mergeTransactions(existing, incoming);
      expect(result).toHaveLength(1);
    });

    it("is idempotent — merging same batch 3 times produces same result", () => {
      const batch = [
        makeTx("tx-1", "2024-01-15T00:00:00.000Z"),
        makeTx("tx-2", "2024-01-14T00:00:00.000Z"),
      ];
      const first = mergeTransactions([], batch);
      const second = mergeTransactions(first, batch);
      const third = mergeTransactions(second, batch);
      expect(third).toHaveLength(2);
      expect(third.map((t: Transaction) => t.id)).toEqual(first.map((t: Transaction) => t.id));
    });

    it("deduplicates when incoming contains mix of new and existing", () => {
      const existing = [makeTx("tx-1", "2024-01-15T00:00:00.000Z")];
      const incoming = [
        makeTx("tx-1", "2024-01-15T00:00:00.000Z"), // already exists
        makeTx("tx-2", "2024-01-16T00:00:00.000Z"), // new
      ];
      const result = mergeTransactions(existing, incoming);
      expect(result).toHaveLength(2);
    });
  });

  describe("ordering", () => {
    it("sorts result by postedAt descending (newest first)", () => {
      const existing = [makeTx("tx-old", "2024-01-10T00:00:00.000Z")];
      const incoming = [
        makeTx("tx-newer", "2024-01-20T00:00:00.000Z"),
        makeTx("tx-middle", "2024-01-15T00:00:00.000Z"),
      ];
      const result = mergeTransactions(existing, incoming);
      expect(result[0].id).toBe("tx-newer");
      expect(result[1].id).toBe("tx-middle");
      expect(result[2].id).toBe("tx-old");
    });
  });

  describe("preservation", () => {
    it("preserves manual transactions alongside imported ones", () => {
      const manual = [makeTx("manual-tx-abc", "2024-01-12T00:00:00.000Z")];
      const imported = [makeTx("plaid-tx-xyz", "2024-01-15T00:00:00.000Z")];
      const result = mergeTransactions(manual, imported);
      expect(result).toHaveLength(2);
      const ids = result.map((t: Transaction) => t.id);
      expect(ids).toContain("manual-tx-abc");
      expect(ids).toContain("plaid-tx-xyz");
    });

    it("returns empty array when both lists are empty", () => {
      expect(mergeTransactions([], [])).toEqual([]);
    });
  });

  describe("fingerprint dedup (reconnect scenario)", () => {
    it("deduplicates plaid-tx with different IDs but same fingerprint", () => {
      const existing = [
        makeTx("plaid-tx-old-001", "2024-01-15T00:00:00.000Z", -2500),
      ];
      const incoming = [
        makeTx("plaid-tx-new-999", "2024-01-15T00:00:00.000Z", -2500),
      ];
      const result = mergeTransactions(existing, incoming);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("plaid-tx-old-001");
    });

    it("does not fingerprint-dedup manual transactions", () => {
      const existing = [
        makeTx("manual-001", "2024-01-15T00:00:00.000Z", -2500),
      ];
      const incoming = [
        makeTx("manual-002", "2024-01-15T00:00:00.000Z", -2500),
      ];
      const result = mergeTransactions(existing, incoming);
      expect(result).toHaveLength(2);
    });

    it("allows plaid-tx with same date but different amount", () => {
      const existing = [
        makeTx("plaid-tx-old-001", "2024-01-15T00:00:00.000Z", -2500),
      ];
      const incoming = [
        makeTx("plaid-tx-new-999", "2024-01-15T00:00:00.000Z", -5000),
      ];
      const result = mergeTransactions(existing, incoming);
      expect(result).toHaveLength(2);
    });
  });
});
