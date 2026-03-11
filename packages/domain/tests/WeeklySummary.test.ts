import { Money } from "../src/models/Money";
import { Transaction } from "../src/models/Transaction";
import { Envelope } from "../src/models/Envelope";
import { TransactionAssignment } from "../src/models/TransactionAssignment";
import { getWeeklySummary, WeeklySummary } from "../src/logic/weeklySummary";

// ─── Helpers ────────────────────────────────────────────────

function tx(
  id: string,
  cents: number,
  postedAt: string,
  description = "Store",
): Transaction {
  return {
    id,
    accountId: "acct-1",
    amount: Money.fromCents(cents),
    description,
    postedAt,
  };
}

function env(id: string, name: string, goalCents = 0): Envelope {
  return {
    id,
    name,
    balance: Money.fromCents(1000),
    goal: goalCents > 0 ? Money.fromCents(goalCents) : undefined,
  };
}

function assign(txId: string, envId: string): TransactionAssignment {
  return {
    transactionId: txId,
    envelopeId: envId,
    assignedByUserId: "user-1",
    assignedAt: "2026-03-01T00:00:00Z",
  };
}

const NOW = "2026-03-10";

// ─── Tests ──────────────────────────────────────────────────

describe("getWeeklySummary", () => {
  it("returns zero summary when no transactions exist", () => {
    const result = getWeeklySummary([], {}, [], NOW);
    expect(result.totalSpentCents).toBe(0);
    expect(result.topEnvelopes).toEqual([]);
    expect(result.unassignedSpentCents).toBe(0);
  });

  it("sums expenses from the last 7 days only", () => {
    const transactions = [
      tx("t1", -5000, "2026-03-09"), // within week
      tx("t2", -3000, "2026-03-04"), // within week (exactly 7 days back from 03-10)
      tx("t3", -2000, "2026-03-03"), // outside week (8 days back)
      tx("t4", -1000, "2026-03-10"), // today — within week
    ];
    const envelopes = [env("e1", "Groceries")];
    const assignments: Record<string, TransactionAssignment> = {
      t1: assign("t1", "e1"),
      t2: assign("t2", "e1"),
      t3: assign("t3", "e1"),
      t4: assign("t4", "e1"),
    };

    const result = getWeeklySummary(transactions, assignments, envelopes, NOW);
    // t1 (5000) + t2 (3000) + t4 (1000) = 9000; t3 is outside window
    expect(result.totalSpentCents).toBe(9000);
  });

  it("groups spending by envelope and sorts descending", () => {
    const transactions = [
      tx("t1", -8000, "2026-03-08"),
      tx("t2", -3000, "2026-03-08"),
      tx("t3", -5000, "2026-03-09"),
    ];
    const envelopes = [
      env("e1", "Dining"),
      env("e2", "Groceries"),
    ];
    const assignments: Record<string, TransactionAssignment> = {
      t1: assign("t1", "e1"),
      t2: assign("t2", "e2"),
      t3: assign("t3", "e2"),
    };

    const result = getWeeklySummary(transactions, assignments, envelopes, NOW);
    expect(result.topEnvelopes).toHaveLength(2);
    // Groceries: 3000 + 5000 = 8000, Dining: 8000 → tied, sorted by name
    expect(result.topEnvelopes[0].spentCents).toBe(8000);
    expect(result.topEnvelopes[1].spentCents).toBe(8000);
  });

  it("tracks unassigned expenses separately", () => {
    const transactions = [
      tx("t1", -4000, "2026-03-08"),
      tx("t2", -2000, "2026-03-09"),
    ];
    const envelopes = [env("e1", "Dining")];
    const assignments: Record<string, TransactionAssignment> = {
      t1: assign("t1", "e1"),
      // t2 is unassigned
    };

    const result = getWeeklySummary(transactions, assignments, envelopes, NOW);
    expect(result.totalSpentCents).toBe(6000);
    expect(result.topEnvelopes).toHaveLength(1);
    expect(result.topEnvelopes[0].spentCents).toBe(4000);
    expect(result.unassignedSpentCents).toBe(2000);
  });

  it("ignores income transactions (positive amounts)", () => {
    const transactions = [
      tx("t1", 100000, "2026-03-08"), // income
      tx("t2", -2500, "2026-03-09"),  // expense
    ];
    const envelopes = [env("e1", "Food")];
    const assignments: Record<string, TransactionAssignment> = {
      t1: assign("t1", "e1"),
      t2: assign("t2", "e1"),
    };

    const result = getWeeklySummary(transactions, assignments, envelopes, NOW);
    expect(result.totalSpentCents).toBe(2500);
  });

  it("limits topEnvelopes to 5 entries", () => {
    const transactions = Array.from({ length: 7 }, (_, i) =>
      tx(`t${i}`, -(1000 * (i + 1)), "2026-03-08"),
    );
    const envelopes = Array.from({ length: 7 }, (_, i) =>
      env(`e${i}`, `Env ${i}`),
    );
    const assignments: Record<string, TransactionAssignment> = {};
    transactions.forEach((t, i) => {
      assignments[t.id] = assign(t.id, `e${i}`);
    });

    const result = getWeeklySummary(transactions, assignments, envelopes, NOW);
    expect(result.topEnvelopes).toHaveLength(5);
    // Highest spender first
    expect(result.topEnvelopes[0].spentCents).toBe(7000);
  });

  it("calculates pace ratio against monthly goals", () => {
    const transactions = [
      tx("t1", -10000, "2026-03-08"), // $100 spent this week
    ];
    // Envelope with $400/month goal → ~$100/week pace
    const envelopes = [env("e1", "Groceries", 40000)];
    const assignments: Record<string, TransactionAssignment> = {
      t1: assign("t1", "e1"),
    };

    const result = getWeeklySummary(transactions, assignments, envelopes, NOW);
    expect(result.paceRatio).toBeCloseTo(1.0, 0);
  });

  it("returns null paceRatio when no goals are set", () => {
    const transactions = [tx("t1", -5000, "2026-03-08")];
    const envelopes = [env("e1", "Food")]; // no goal
    const assignments: Record<string, TransactionAssignment> = {
      t1: assign("t1", "e1"),
    };

    const result = getWeeklySummary(transactions, assignments, envelopes, NOW);
    expect(result.paceRatio).toBeNull();
  });

  it("includes correct week date range", () => {
    const result = getWeeklySummary([], {}, [], NOW);
    expect(result.weekStartDate).toBe("2026-03-04");
    expect(result.weekEndDate).toBe("2026-03-10");
  });

  it("excludes transactions marked as transfers", () => {
    const transactions = [
      { ...tx("t1", -50000, "2026-03-08", "Transfer To Checking"), isTransfer: true as const },
      { ...tx("t2", 50000, "2026-03-08", "From Savings"), isTransfer: true as const },
      tx("t3", -10000, "2026-03-08", "Coffee Shop"),
    ];

    const result = getWeeklySummary(transactions, {}, [], NOW);
    // Only the coffee shop counts — transfers excluded
    expect(result.totalSpentCents).toBe(10000);
    expect(result.unassignedSpentCents).toBe(10000);
  });
});
