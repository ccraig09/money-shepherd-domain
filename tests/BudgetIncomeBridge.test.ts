import { Money } from "../src";
import { Budget } from "../src/models/Budget";
import { Envelope } from "../src/models/Envelope";
import { Transaction } from "../src/models/Transaction";
import { applyTransactionsToBudget } from "../src/logic/applyTransactionsToBudget";

describe("Income increases availableToAssign", () => {
  it("adds income transaction to availableToAssign", () => {
    const budget: Budget = {
      id: "household-1",
      availableToAssign: Money.fromCents(0),
      envelopes: [],
    };

    const incomeTx: Transaction = {
      id: "tx-income-1",
      accountId: "acc-1",
      amount: Money.fromCents(2000),
      description: "Paycheck",
      postedAt: "2026-02-11T00:00:00.000Z",
    };

    const result = applyTransactionsToBudget(budget, [incomeTx]);

    expect(result.budget.availableToAssign.cents).toBe(2000);
  });

  it("does not double-count income (idempotent)", () => {
    const budget: Budget = {
      id: "household-1",
      availableToAssign: Money.fromCents(0),
      envelopes: [],
    };

    const incomeTx: Transaction = {
      id: "tx-income-2",
      accountId: "acc-1",
      amount: Money.fromCents(1500),
      description: "Bonus",
      postedAt: "2026-02-11T00:00:00.000Z",
    };

    const first = applyTransactionsToBudget(budget, [incomeTx]);
    const second = applyTransactionsToBudget(
      first.budget,
      [incomeTx],
      first.appliedTransactionIds,
    );

    expect(second.budget.availableToAssign.cents).toBe(1500);
  });

  it("does not affect availableToAssign for expenses", () => {
    const groceries: Envelope = {
      id: "env-groceries",
      name: "Groceries",
      balance: Money.fromCents(500),
    };

    const budget: Budget = {
      id: "household-1",
      availableToAssign: Money.fromCents(100),
      envelopes: [groceries],
    };

    const expenseTx: Transaction = {
      id: "tx-expense-1",
      accountId: "acc-1",
      amount: Money.fromCents(-50),
      description: "Snack",
      postedAt: "2026-02-11T00:00:00.000Z",
      envelopeId: "env-groceries",
    };

    const result = applyTransactionsToBudget(budget, [expenseTx]);

    expect(result.budget.availableToAssign.cents).toBe(100);
  });
});
