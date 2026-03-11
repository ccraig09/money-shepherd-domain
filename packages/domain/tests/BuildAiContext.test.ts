import { buildAiContext, AiContext, PeriodOverride } from "../src/logic/buildAiContext";
import { Money } from "../src/models/Money";
import type { Budget } from "../src/models/Budget";
import type { Account } from "../src/models/Account";
import type { Transaction } from "../src/models/Transaction";
import type { TransactionInbox } from "../src/models/TransactionInbox";

function makeState(overrides: Partial<{
  budget: Budget;
  accounts: Account[];
  transactions: Transaction[];
  inbox: TransactionInbox;
}> = {}) {
  const defaults = {
    version: 1 as const,
    householdId: "hh-1",
    users: [{ id: "user-los", displayName: "Los" }],
    budget: {
      id: "budget-1",
      availableToAssign: Money.fromCents(50000),
      envelopes: [],
    },
    accounts: [],
    transactions: [],
    inbox: { unassignedTransactionIds: [], assignmentsByTransactionId: {} },
    appliedAccountTransactionIds: [],
    appliedBudgetTransactionIds: [],
    updatedAt: "2026-03-01T00:00:00Z",
  };
  return { ...defaults, ...overrides };
}

function makeTx(overrides: Partial<Transaction> & { id: string }): Transaction {
  return {
    accountId: "acct-1",
    amount: Money.fromCents(-1000),
    description: "Test Store",
    postedAt: "2026-03-05T12:00:00Z",
    ...overrides,
  };
}

describe("buildAiContext", () => {
  it("returns correct shape for empty state", () => {
    const ctx = buildAiContext(makeState());

    expect(ctx.availableToAssignCents).toBe(50000);
    expect(ctx.totalIncomeCents).toBe(0);
    expect(ctx.totalExpensesCents).toBe(0);
    expect(ctx.envelopes).toEqual([]);
    expect(ctx.topMerchants).toEqual([]);
    expect(ctx.accountSummary).toEqual([]);
    expect(ctx.transactionCount).toBe(0);
    expect(ctx.periodStartDate).toBeDefined();
    expect(ctx.periodEndDate).toBeDefined();
  });

  it("aggregates income and expenses from current period", () => {
    const ctx = buildAiContext(makeState({
      transactions: [
        makeTx({ id: "t1", amount: Money.fromCents(200000), description: "Paycheck" }),
        makeTx({ id: "t2", amount: Money.fromCents(-5000), description: "Walmart" }),
        makeTx({ id: "t3", amount: Money.fromCents(-3000), description: "Target" }),
      ],
    }));

    expect(ctx.totalIncomeCents).toBe(200000);
    expect(ctx.totalExpensesCents).toBe(8000); // absolute value
    expect(ctx.transactionCount).toBe(3);
  });

  it("excludes transactions outside current period", () => {
    const ctx = buildAiContext(makeState({
      transactions: [
        makeTx({ id: "t1", amount: Money.fromCents(-5000), description: "Current", postedAt: "2026-03-05T12:00:00Z" }),
        makeTx({ id: "t2", amount: Money.fromCents(-9000), description: "Old", postedAt: "2025-01-15T12:00:00Z" }),
      ],
    }));

    expect(ctx.totalExpensesCents).toBe(5000);
    expect(ctx.transactionCount).toBe(1);
  });

  it("summarizes envelopes with IDs for tool use", () => {
    const ctx = buildAiContext(makeState({
      budget: {
        id: "budget-1",
        availableToAssign: Money.fromCents(10000),
        envelopes: [
          { id: "env-1", name: "Groceries", balance: Money.fromCents(20000), goal: Money.fromCents(40000), type: "spending" },
          { id: "env-2", name: "Giving", balance: Money.fromCents(5000), type: "giving" },
        ],
      },
    }));

    expect(ctx.envelopes).toHaveLength(2);
    expect(ctx.envelopes[0]).toEqual({ id: "env-1", name: "Groceries", balanceCents: 20000, goalCents: 40000, type: "spending" });
    expect(ctx.envelopes[1]).toEqual({ id: "env-2", name: "Giving", balanceCents: 5000, type: "giving" });
  });

  it("aggregates top merchants by spend (descending)", () => {
    const ctx = buildAiContext(makeState({
      transactions: [
        makeTx({ id: "t1", amount: Money.fromCents(-5000), description: "WALMART #1234" }),
        makeTx({ id: "t2", amount: Money.fromCents(-3000), description: "Walmart #5678" }),
        makeTx({ id: "t3", amount: Money.fromCents(-2000), description: "Target" }),
      ],
    }));

    expect(ctx.topMerchants.length).toBeGreaterThanOrEqual(2);
    // Walmart entries should be merged via normalizePayee
    const walmart = ctx.topMerchants.find((m) => m.normalizedName === "walmart");
    expect(walmart).toBeDefined();
    expect(walmart!.totalCents).toBe(8000);
    expect(walmart!.count).toBe(2);
    // Top merchant should be first (highest spend)
    expect(ctx.topMerchants[0].totalCents).toBeGreaterThanOrEqual(ctx.topMerchants[1].totalCents);
  });

  it("caps top merchants at 15", () => {
    const txs: Transaction[] = [];
    for (let i = 0; i < 20; i++) {
      txs.push(makeTx({
        id: `t${i}`,
        amount: Money.fromCents(-(i + 1) * 100),
        description: `Store${i}`,
      }));
    }
    const ctx = buildAiContext(makeState({ transactions: txs }));
    expect(ctx.topMerchants.length).toBeLessThanOrEqual(15);
  });

  it("summarizes accounts by type only — no names or IDs", () => {
    const ctx = buildAiContext(makeState({
      accounts: [
        { id: "plaid-acct-123", name: "Los Checking - 4567", balance: Money.fromCents(500000), accountType: "depository" },
        { id: "plaid-acct-456", name: "Visa Card - 8901", balance: Money.fromCents(-120000), accountType: "credit" },
        { id: "manual-savings", name: "My Savings", balance: Money.fromCents(1000000), accountType: "depository" },
      ],
    }));

    expect(ctx.accountSummary).toHaveLength(2); // grouped by type
    const depository = ctx.accountSummary.find((a) => a.type === "depository");
    const credit = ctx.accountSummary.find((a) => a.type === "credit");
    expect(depository!.balanceCents).toBe(1500000); // 5000 + 10000
    expect(depository!.count).toBe(2);
    expect(credit!.balanceCents).toBe(-120000);
    expect(credit!.count).toBe(1);

    // No PII in the entire output
    const json = JSON.stringify(ctx);
    expect(json).not.toContain("Los");
    expect(json).not.toContain("4567");
    expect(json).not.toContain("8901");
    expect(json).not.toContain("plaid-acct");
    expect(json).not.toContain("manual-savings");
  });

  it("does not include user names, household ID, or account names in output", () => {
    const ctx = buildAiContext(makeState({
      accounts: [
        { id: "acct-1", name: "Joint Checking", balance: Money.fromCents(100000), accountType: "depository", ownerUserId: "user-los", institutionName: "Navy Federal" },
      ],
    }));

    const json = JSON.stringify(ctx);
    expect(json).not.toContain("hh-1");
    expect(json).not.toContain("user-los");
    expect(json).not.toContain("Joint Checking");
    expect(json).not.toContain("Navy Federal");
    expect(json).not.toContain("Los");
  });

  it("skips income transactions from merchant aggregation", () => {
    const ctx = buildAiContext(makeState({
      transactions: [
        makeTx({ id: "t1", amount: Money.fromCents(200000), description: "Employer Payroll" }),
        makeTx({ id: "t2", amount: Money.fromCents(-5000), description: "Walmart" }),
      ],
    }));

    // Only expenses in topMerchants
    expect(ctx.topMerchants).toHaveLength(1);
    expect(ctx.topMerchants[0].normalizedName).toBe("walmart");
  });

  it("skips pending transactions", () => {
    const ctx = buildAiContext(makeState({
      transactions: [
        makeTx({ id: "t1", amount: Money.fromCents(-5000), description: "Walmart" }),
        makeTx({ id: "t2", amount: Money.fromCents(-3000), description: "Target", isPending: true }),
      ],
    }));

    expect(ctx.totalExpensesCents).toBe(5000);
    expect(ctx.transactionCount).toBe(1);
    expect(ctx.topMerchants).toHaveLength(1);
  });

  describe("periodOverride", () => {
    it("filters transactions to the overridden period", () => {
      const override: PeriodOverride = { startDate: "2026-02-01", endDate: "2026-02-28" };
      const ctx = buildAiContext(makeState({
        transactions: [
          makeTx({ id: "t1", amount: Money.fromCents(-5000), description: "Feb Store", postedAt: "2026-02-15T12:00:00Z" }),
          makeTx({ id: "t2", amount: Money.fromCents(-3000), description: "Mar Store", postedAt: "2026-03-05T12:00:00Z" }),
          makeTx({ id: "t3", amount: Money.fromCents(100000), description: "Feb Income", postedAt: "2026-02-01T12:00:00Z" }),
        ],
      }), override);

      expect(ctx.totalExpensesCents).toBe(5000);
      expect(ctx.totalIncomeCents).toBe(100000);
      expect(ctx.transactionCount).toBe(2);
      expect(ctx.periodStartDate).toBe("2026-02-01");
      expect(ctx.periodEndDate).toBe("2026-02-28");
    });

    it("returns empty aggregates when no transactions match the override period", () => {
      const override: PeriodOverride = { startDate: "2025-06-01", endDate: "2025-06-30" };
      const ctx = buildAiContext(makeState({
        transactions: [
          makeTx({ id: "t1", amount: Money.fromCents(-5000), description: "Walmart", postedAt: "2026-03-05T12:00:00Z" }),
        ],
      }), override);

      expect(ctx.totalExpensesCents).toBe(0);
      expect(ctx.totalIncomeCents).toBe(0);
      expect(ctx.transactionCount).toBe(0);
      expect(ctx.topMerchants).toEqual([]);
    });

    it("still includes envelope and account data regardless of period", () => {
      const override: PeriodOverride = { startDate: "2025-01-01", endDate: "2025-01-31" };
      const ctx = buildAiContext(makeState({
        budget: {
          id: "budget-1",
          availableToAssign: Money.fromCents(10000),
          envelopes: [
            { id: "env-1", name: "Groceries", balance: Money.fromCents(20000), type: "spending" },
          ],
        },
        accounts: [
          { id: "acct-1", name: "Checking", balance: Money.fromCents(500000), accountType: "depository" },
        ],
      }), override);

      expect(ctx.envelopes).toHaveLength(1);
      expect(ctx.envelopes[0].name).toBe("Groceries");
      expect(ctx.accountSummary).toHaveLength(1);
      expect(ctx.availableToAssignCents).toBe(10000);
    });
  });
});
