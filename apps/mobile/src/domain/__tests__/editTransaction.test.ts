import { Money } from "@money-shepherd/domain";
import type { AppStateV1 } from "../appState";
import { editTransaction } from "../commands";

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
        id: "tx-1",
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
    inbox: { unassignedTransactionIds: [], assignmentsByTransactionId: {} },
    appliedAccountTransactionIds: ["tx-1", "tx-income", "plaid-tx-1"],
    appliedBudgetTransactionIds: ["tx-1", "tx-income", "plaid-tx-1"],
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("editTransaction", () => {
  it("edits description on a manual transaction", () => {
    const state = makeState();
    const next = editTransaction(state, {
      transactionId: "tx-1",
      description: "Latte",
    });
    const tx = next.transactions.find((t) => t.id === "tx-1")!;
    expect(tx.description).toBe("Latte");
    expect(tx.amount.cents).toBe(-2000); // amount unchanged
  });

  it("edits amount on a manual transaction", () => {
    const state = makeState();
    const next = editTransaction(state, {
      transactionId: "tx-1",
      amountCents: -3500,
    });
    const tx = next.transactions.find((t) => t.id === "tx-1")!;
    expect(tx.amount.cents).toBe(-3500);
    expect(tx.description).toBe("Coffee"); // description unchanged
  });

  it("edits both description and amount", () => {
    const state = makeState();
    const next = editTransaction(state, {
      transactionId: "tx-1",
      description: "Latte",
      amountCents: -450,
    });
    const tx = next.transactions.find((t) => t.id === "tx-1")!;
    expect(tx.description).toBe("Latte");
    expect(tx.amount.cents).toBe(-450);
  });

  it("adjusts account balance when amount changes", () => {
    const state = makeState();
    // tx-1 was -2000, changing to -3500 → diff = -1500
    const next = editTransaction(state, {
      transactionId: "tx-1",
      amountCents: -3500,
    });
    const acc = next.accounts.find((a) => a.id === "acc-1")!;
    expect(acc.balance.cents).toBe(8500 + (-3500 - (-2000))); // 8500 - 1500 = 7000
  });

  it("does not change account balance when only description changes", () => {
    const state = makeState();
    const next = editTransaction(state, {
      transactionId: "tx-1",
      description: "Latte",
    });
    const acc = next.accounts.find((a) => a.id === "acc-1")!;
    expect(acc.balance.cents).toBe(8500);
  });

  it("allows description edit on Plaid transactions", () => {
    const state = makeState();
    const next = editTransaction(state, {
      transactionId: "plaid-tx-1",
      description: "Renamed Plaid Purchase",
    });
    const tx = next.transactions.find((t) => t.id === "plaid-tx-1")!;
    expect(tx.description).toBe("Renamed Plaid Purchase");
  });

  it("throws when editing amount on a Plaid transaction", () => {
    const state = makeState();
    expect(() =>
      editTransaction(state, {
        transactionId: "plaid-tx-1",
        amountCents: -999,
      }),
    ).toThrow("Cannot edit amount on a Plaid-synced transaction.");
  });

  it("adjusts envelope balance when assigned expense amount changes", () => {
    const state = makeState();
    state.inbox.assignmentsByTransactionId = {
      "tx-1": {
        transactionId: "tx-1",
        envelopeId: "env-0",
        assignedByUserId: "user-los",
        assignedAt: "2024-01-01T00:00:00.000Z",
      },
    };
    // tx-1 was -2000, changing to -1200 → expense decreased by 800
    const next = editTransaction(state, {
      transactionId: "tx-1",
      amountCents: -1200,
    });
    const env = next.budget.envelopes.find((e) => e.id === "env-0")!;
    // envelope had 5000, expense shrank by 800 → 5000 + 800 = 5800
    expect(env.balance.cents).toBe(5800);
  });

  it("adjusts availableToAssign when income amount changes", () => {
    const state = makeState();
    // tx-income was +5000, changing to +8000 → diff = +3000
    const next = editTransaction(state, {
      transactionId: "tx-income",
      amountCents: 8000,
    });
    expect(next.budget.availableToAssign.cents).toBe(10000 + 3000); // 13000
  });

  it("does not adjust budget when unassigned expense amount changes", () => {
    const state = makeState();
    // tx-1 is unassigned expense, changing amount should not touch budget
    const next = editTransaction(state, {
      transactionId: "tx-1",
      amountCents: -500,
    });
    expect(next.budget.availableToAssign.cents).toBe(10000);
    expect(next.budget.envelopes[0].balance.cents).toBe(5000);
  });

  it("does not modify appliedBudgetTransactionIds or appliedAccountTransactionIds", () => {
    const state = makeState();
    const next = editTransaction(state, {
      transactionId: "tx-1",
      amountCents: -3500,
    });
    expect(next.appliedBudgetTransactionIds).toEqual(state.appliedBudgetTransactionIds);
    expect(next.appliedAccountTransactionIds).toEqual(state.appliedAccountTransactionIds);
  });

  it("throws when transaction not found", () => {
    const state = makeState();
    expect(() =>
      editTransaction(state, {
        transactionId: "tx-999",
        description: "Nope",
      }),
    ).toThrow("Transaction not found.");
  });

  it("does not affect other transactions", () => {
    const state = makeState();
    const next = editTransaction(state, {
      transactionId: "tx-1",
      description: "Latte",
      amountCents: -450,
    });
    const income = next.transactions.find((t) => t.id === "tx-income")!;
    expect(income.description).toBe("Refund");
    expect(income.amount.cents).toBe(5000);
  });
});
