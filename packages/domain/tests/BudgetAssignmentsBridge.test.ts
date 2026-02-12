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
