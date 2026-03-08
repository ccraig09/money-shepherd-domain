import { Money } from "@money-shepherd/domain";
import type { AppStateV1 } from "../appState";
import { removePlaidTransactions } from "../commands";

function makeState(overrides?: Partial<AppStateV1>): AppStateV1 {
  return {
    version: 1,
    householdId: "hh-1",
    users: [],
    budget: {
      id: "budget-1",
      availableToAssign: Money.zero(),
      envelopes: [],
    },
    accounts: [
      { id: "plaid-acct-1", name: "Checking", balance: Money.fromCents(50000) },
    ],
    transactions: [
      { id: "plaid-tx-aaa", postedAt: "2024-01-01", description: "Coffee", amount: Money.fromCents(-500), accountId: "plaid-acct-1" },
      { id: "plaid-tx-bbb", postedAt: "2024-01-02", description: "Groceries", amount: Money.fromCents(-3200), accountId: "plaid-acct-1" },
      { id: "plaid-tx-ccc", postedAt: "2024-01-03", description: "Payroll", amount: Money.fromCents(200000), accountId: "plaid-acct-1" },
    ],
    inbox: {
      unassignedTransactionIds: ["plaid-tx-aaa", "plaid-tx-bbb"],
      assignmentsByTransactionId: {
        "plaid-tx-ccc": {
          transactionId: "plaid-tx-ccc",
          envelopeId: "env-1",
          assignedByUserId: "user-los",
          assignedAt: "2024-01-03T00:00:00.000Z",
        },
      },
    },
    appliedAccountTransactionIds: ["plaid-tx-aaa", "plaid-tx-bbb", "plaid-tx-ccc"],
    appliedBudgetTransactionIds: ["plaid-tx-ccc"],
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("removePlaidTransactions", () => {
  it("returns same state reference when no IDs provided", () => {
    const state = makeState();
    const result = removePlaidTransactions(state, { transactionIds: [] });
    expect(result).toBe(state);
  });

  it("returns same state reference when IDs don't match any transaction", () => {
    const state = makeState();
    const result = removePlaidTransactions(state, { transactionIds: ["plaid-tx-nonexistent"] });
    expect(result).toBe(state);
  });

  it("removes matching transactions", () => {
    const state = makeState();
    const result = removePlaidTransactions(state, { transactionIds: ["plaid-tx-aaa"] });
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions.find((t) => t.id === "plaid-tx-aaa")).toBeUndefined();
    expect(result.transactions.find((t) => t.id === "plaid-tx-bbb")).toBeDefined();
  });

  it("cleans up inbox unassigned list", () => {
    const state = makeState();
    const result = removePlaidTransactions(state, { transactionIds: ["plaid-tx-aaa"] });
    expect(result.inbox.unassignedTransactionIds).not.toContain("plaid-tx-aaa");
    expect(result.inbox.unassignedTransactionIds).toContain("plaid-tx-bbb");
  });

  it("cleans up inbox assignment records", () => {
    const state = makeState();
    const result = removePlaidTransactions(state, { transactionIds: ["plaid-tx-ccc"] });
    expect(result.inbox.assignmentsByTransactionId["plaid-tx-ccc"]).toBeUndefined();
  });

  it("cleans up appliedAccountTransactionIds", () => {
    const state = makeState();
    const result = removePlaidTransactions(state, { transactionIds: ["plaid-tx-aaa", "plaid-tx-bbb"] });
    expect(result.appliedAccountTransactionIds).toEqual(["plaid-tx-ccc"]);
  });

  it("cleans up appliedBudgetTransactionIds", () => {
    const state = makeState();
    const result = removePlaidTransactions(state, { transactionIds: ["plaid-tx-ccc"] });
    expect(result.appliedBudgetTransactionIds).toEqual([]);
  });

  it("removes multiple transactions at once", () => {
    const state = makeState();
    const result = removePlaidTransactions(state, {
      transactionIds: ["plaid-tx-aaa", "plaid-tx-bbb", "plaid-tx-ccc"],
    });
    expect(result.transactions).toHaveLength(0);
    expect(result.inbox.unassignedTransactionIds).toHaveLength(0);
    expect(result.inbox.assignmentsByTransactionId).toEqual({});
  });
});
