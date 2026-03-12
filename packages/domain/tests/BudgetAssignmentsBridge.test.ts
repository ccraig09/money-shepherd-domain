import { Money } from "../src";
import { Budget } from "../src/models/Budget";
import { Envelope } from "../src/models/Envelope";
import { Transaction } from "../src/models/Transaction";
import { TransactionAssignment } from "../src/models/TransactionAssignment";
import { allocateFunds } from "../src/logic/allocateFunds";
import { applyTransactionsToBudget } from "../src/logic/applyTransactionsToBudget";

describe("Budget spending uses assignments as source of truth", () => {
  it("spends from envelope using assignmentsByTransactionId", () => {
    const groceries: Envelope = {
      id: "env-groceries",
      name: "Groceries",
      balance: Money.zero(),
    };

    const budget: Budget = {
      id: "household-1",
      availableToAssign: Money.fromCents(1000),
      envelopes: [groceries],
    };

    const funded = allocateFunds(budget, "env-groceries", Money.fromCents(500));

    const tx: Transaction = {
      id: "tx-1",
      accountId: "acc-1",
      amount: Money.fromCents(-200),
      description: "Walmart",
      postedAt: "2026-02-11T00:00:00.000Z",
    };

    const assignments: Record<string, TransactionAssignment> = {
      "tx-1": {
        transactionId: "tx-1",
        envelopeId: "env-groceries",
        assignedByUserId: "user-wife",
        assignedAt: "2026-02-11T02:00:00.000Z",
      },
    };

    const result = applyTransactionsToBudget(funded, [tx], new Set(), {
      assignmentsByTransactionId: assignments,
    });

    const env = result.budget.envelopes.find((e) => e.id === "env-groceries")!;
    expect(env.balance.cents).toBe(300);
  });

  it("falls back to tx.envelopeId if no assignment exists", () => {
    const groceries: Envelope = {
      id: "env-groceries",
      name: "Groceries",
      balance: Money.fromCents(500),
    };

    const budget: Budget = {
      id: "household-1",
      availableToAssign: Money.zero(),
      envelopes: [groceries],
    };

    const tx: Transaction = {
      id: "tx-2",
      accountId: "acc-1",
      amount: Money.fromCents(-100),
      description: "Coffee",
      postedAt: "2026-02-11T00:00:00.000Z",
      envelopeId: "env-groceries",
    };

    const result = applyTransactionsToBudget(budget, [tx], new Set(), {
      assignmentsByTransactionId: {},
    });
    const env = result.budget.envelopes.find((e) => e.id === "env-groceries")!;
    expect(env.balance.cents).toBe(400);
  });

  it("expense assigned to debt envelope adds to balance (payment)", () => {
    const visa: Envelope = {
      id: "env-visa",
      name: "Visa",
      balance: Money.fromCents(200), // $2 already paid
      type: "debt",
    };

    const budget: Budget = {
      id: "household-1",
      availableToAssign: Money.zero(),
      envelopes: [visa],
    };

    const tx: Transaction = {
      id: "tx-payment",
      accountId: "acc-1",
      amount: Money.fromCents(-50000), // -$500 credit card payment
      description: "Visa Payment",
      postedAt: "2026-03-10T00:00:00.000Z",
    };

    const assignments: Record<string, TransactionAssignment> = {
      "tx-payment": {
        transactionId: "tx-payment",
        envelopeId: "env-visa",
        assignedByUserId: "user-1",
        assignedAt: "2026-03-10T01:00:00.000Z",
      },
    };

    const result = applyTransactionsToBudget(budget, [tx], new Set(), {
      assignmentsByTransactionId: assignments,
    });

    const env = result.budget.envelopes.find((e) => e.id === "env-visa")!;
    // Payment of $500 should INCREASE balance: 200 + 50000 = 50200
    expect(env.balance.cents).toBe(50200);
  });

  it("expense assigned to non-debt envelope deducts from balance (spending)", () => {
    const groceries: Envelope = {
      id: "env-groceries",
      name: "Groceries",
      balance: Money.fromCents(50000),
      type: "spending",
    };

    const budget: Budget = {
      id: "household-1",
      availableToAssign: Money.zero(),
      envelopes: [groceries],
    };

    const tx: Transaction = {
      id: "tx-grocery",
      accountId: "acc-1",
      amount: Money.fromCents(-20000), // -$200 grocery run
      description: "Kroger",
      postedAt: "2026-03-10T00:00:00.000Z",
    };

    const assignments: Record<string, TransactionAssignment> = {
      "tx-grocery": {
        transactionId: "tx-grocery",
        envelopeId: "env-groceries",
        assignedByUserId: "user-1",
        assignedAt: "2026-03-10T01:00:00.000Z",
      },
    };

    const result = applyTransactionsToBudget(budget, [tx], new Set(), {
      assignmentsByTransactionId: assignments,
    });

    const env = result.budget.envelopes.find((e) => e.id === "env-groceries")!;
    // Spending of $200 should DECREASE balance: 50000 - 20000 = 30000
    expect(env.balance.cents).toBe(30000);
  });

  it("envelope without type (undefined) uses normal spend behavior", () => {
    const misc: Envelope = {
      id: "env-misc",
      name: "Misc",
      balance: Money.fromCents(10000),
      // no type set — should default to spending behavior
    };

    const budget: Budget = {
      id: "household-1",
      availableToAssign: Money.zero(),
      envelopes: [misc],
    };

    const tx: Transaction = {
      id: "tx-misc",
      accountId: "acc-1",
      amount: Money.fromCents(-3000),
      description: "Random",
      postedAt: "2026-03-10T00:00:00.000Z",
    };

    const assignments: Record<string, TransactionAssignment> = {
      "tx-misc": {
        transactionId: "tx-misc",
        envelopeId: "env-misc",
        assignedByUserId: "user-1",
        assignedAt: "2026-03-10T01:00:00.000Z",
      },
    };

    const result = applyTransactionsToBudget(budget, [tx], new Set(), {
      assignmentsByTransactionId: assignments,
    });

    const env = result.budget.envelopes.find((e) => e.id === "env-misc")!;
    expect(env.balance.cents).toBe(7000);
  });

  it("does nothing for unassigned transactions", () => {
    const groceries: Envelope = {
      id: "env-groceries",
      name: "Groceries",
      balance: Money.fromCents(500),
    };

    const budget: Budget = {
      id: "household-1",
      availableToAssign: Money.zero(),
      envelopes: [groceries],
    };

    const tx: Transaction = {
      id: "tx-3",
      accountId: "acc-1",
      amount: Money.fromCents(-100),
      description: "Coffee",
      postedAt: "2026-02-11T00:00:00.000Z",
    };

    const result = applyTransactionsToBudget(budget, [tx], new Set(), {
      assignmentsByTransactionId: {},
    });
    const env = result.budget.envelopes.find((e) => e.id === "env-groceries")!;
    expect(env.balance.cents).toBe(500);
  });
});
