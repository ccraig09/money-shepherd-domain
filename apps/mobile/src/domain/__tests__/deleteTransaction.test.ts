import { Money } from "@money-shepherd/domain";
import type { AppStateV1 } from "../appState";
import { deleteTransaction } from "../commands";

function makeState(): AppStateV1 {
  return {
    version: 1,
    householdId: "hh-1",
    users: [],
    budget: {
      id: "budget-1",
      availableToAssign: Money.fromCents(10000),
      envelopes: [
        { id: "env-0", name: "Groceries", balance: Money.fromCents(5000) },
      ],
    },
    accounts: [
      { id: "acc-1", name: "Checking", balance: Money.fromCents(8500) },
    ],
    transactions: [
      {
        id: "tx-expense",
        accountId: "acc-1",
        amount: Money.fromCents(-2000),
        description: "Coffee",
        postedAt: "2024-01-15T10:00:00.000Z",
      },
      {
        id: "tx-income",
        accountId: "acc-1",
        amount: Money.fromCents(5000),
        description: "Refund",
        postedAt: "2024-01-14T10:00:00.000Z",
      },
      {
        id: "plaid-tx-1",
        accountId: "acc-1",
        amount: Money.fromCents(-3000),
        description: "Plaid Purchase",
        postedAt: "2024-01-13T10:00:00.000Z",
      },
    ],
    inbox: {
      unassignedTransactionIds: ["tx-expense", "tx-income"],
      assignmentsByTransactionId: {},
    },
    appliedAccountTransactionIds: ["tx-expense", "tx-income", "plaid-tx-1"],
    appliedBudgetTransactionIds: ["tx-income", "plaid-tx-1"],
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("deleteTransaction", () => {
  it("removes the transaction from the list", () => {
    const state = makeState();
    const next = deleteTransaction(state, { transactionId: "tx-expense" });
    expect(next.transactions.find((t) => t.id === "tx-expense")).toBeUndefined();
    expect(next.transactions).toHaveLength(2);
  });

  it("reverses account balance for a deleted expense", () => {
    const state = makeState();
    // tx-expense was -2000, removing it reverses: 8500 - (-2000) = 10500
    const next = deleteTransaction(state, { transactionId: "tx-expense" });
    const acc = next.accounts.find((a) => a.id === "acc-1")!;
    expect(acc.balance.cents).toBe(10500);
  });

  it("reverses account balance for a deleted income", () => {
    const state = makeState();
    // tx-income was +5000, removing it reverses: 8500 - 5000 = 3500
    const next = deleteTransaction(state, { transactionId: "tx-income" });
    const acc = next.accounts.find((a) => a.id === "acc-1")!;
    expect(acc.balance.cents).toBe(3500);
  });

  it("reduces availableToAssign when deleting an income transaction", () => {
    const state = makeState();
    // tx-income was +5000, availableToAssign had 10000 → 10000 - 5000 = 5000
    const next = deleteTransaction(state, { transactionId: "tx-income" });
    expect(next.budget.availableToAssign.cents).toBe(5000);
  });

  it("restores envelope balance when deleting an assigned expense", () => {
    const state = makeState();
    state.inbox.assignmentsByTransactionId = {
      "tx-expense": {
        transactionId: "tx-expense",
        envelopeId: "env-0",
        assignedByUserId: "user-los",
        assignedAt: "2024-01-01T00:00:00.000Z",
      },
    };
    state.appliedBudgetTransactionIds = ["tx-expense", "tx-income", "plaid-tx-1"];
    // tx-expense was -2000 assigned to env-0, envelope had 5000 → 5000 + 2000 = 7000
    const next = deleteTransaction(state, { transactionId: "tx-expense" });
    const env = next.budget.envelopes.find((e) => e.id === "env-0")!;
    expect(env.balance.cents).toBe(7000);
  });

  it("removes the assignment when deleting an assigned transaction", () => {
    const state = makeState();
    state.inbox.assignmentsByTransactionId = {
      "tx-expense": {
        transactionId: "tx-expense",
        envelopeId: "env-0",
        assignedByUserId: "user-los",
        assignedAt: "2024-01-01T00:00:00.000Z",
      },
    };
    const next = deleteTransaction(state, { transactionId: "tx-expense" });
    expect(next.inbox.assignmentsByTransactionId["tx-expense"]).toBeUndefined();
  });

  it("does not adjust envelope when deleting an unassigned expense", () => {
    const state = makeState();
    const next = deleteTransaction(state, { transactionId: "tx-expense" });
    expect(next.budget.envelopes[0].balance.cents).toBe(5000);
    expect(next.budget.availableToAssign.cents).toBe(10000);
  });

  it("removes tx ID from appliedAccountTransactionIds", () => {
    const state = makeState();
    const next = deleteTransaction(state, { transactionId: "tx-expense" });
    expect(next.appliedAccountTransactionIds).not.toContain("tx-expense");
    expect(next.appliedAccountTransactionIds).toContain("tx-income");
  });

  it("removes tx ID from appliedBudgetTransactionIds", () => {
    const state = makeState();
    const next = deleteTransaction(state, { transactionId: "tx-income" });
    expect(next.appliedBudgetTransactionIds).not.toContain("tx-income");
    expect(next.appliedBudgetTransactionIds).toContain("plaid-tx-1");
  });

  it("throws when deleting a Plaid-synced transaction", () => {
    const state = makeState();
    expect(() =>
      deleteTransaction(state, { transactionId: "plaid-tx-1" }),
    ).toThrow("Cannot delete a Plaid-synced transaction.");
  });

  it("throws when transaction not found", () => {
    const state = makeState();
    expect(() =>
      deleteTransaction(state, { transactionId: "tx-999" }),
    ).toThrow("Transaction not found.");
  });

  it("does not affect other transactions", () => {
    const state = makeState();
    const next = deleteTransaction(state, { transactionId: "tx-expense" });
    const income = next.transactions.find((t) => t.id === "tx-income")!;
    expect(income.description).toBe("Refund");
    expect(income.amount.cents).toBe(5000);
  });
});
