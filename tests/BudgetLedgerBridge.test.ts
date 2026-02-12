import { Money } from "../src";
import { Budget } from "../src/models/Budget";
import { Envelope } from "../src/models/Envelope";
import { Transaction } from "../src/models/Transaction";
import { allocateFunds } from "../src/logic/allocateFunds";
import { applyTransactionsToBudget } from "../src/logic/applyTransactionsToBudget";

describe("Bridge: Transactions -> Budget (envelopes)", () => {
  it("applies an expense transaction to its envelope when envelopeId is set", () => {
    const groceries: Envelope = {
      id: "env-groceries",
      name: "Groceries",
      balance: Money.zero(),
    };

    const base: Budget = {
      id: "household-1",
      availableToAssign: Money.fromCents(1000),
      envelopes: [groceries],
    };

    const funded = allocateFunds(base, "env-groceries", Money.fromCents(500));

    const tx: Transaction = {
      id: "tx-1",
      accountId: "acc-1",
      amount: Money.fromCents(-200),
      description: "Walmart",
      postedAt: "2026-02-11T00:00:00.000Z",
      envelopeId: "env-groceries",
    };

    const result = applyTransactionsToBudget(funded, [tx]);
    const env = result.budget.envelopes.find((e) => e.id === "env-groceries")!;

    expect(env.balance.cents).toBe(300);
  });

  it("ignores transactions without envelopeId (unassigned)", () => {
    const groceries: Envelope = {
      id: "env-groceries",
      name: "Groceries",
      balance: Money.fromCents(500),
    };

    const base: Budget = {
      id: "household-1",
      availableToAssign: Money.fromCents(0),
      envelopes: [groceries],
    };

    const tx: Transaction = {
      id: "tx-2",
      accountId: "acc-1",
      amount: Money.fromCents(-200),
      description: "Unknown",
      postedAt: "2026-02-11T00:00:00.000Z",
    };

    const result = applyTransactionsToBudget(base, [tx]);
    const env = result.budget.envelopes.find((e) => e.id === "env-groceries")!;

    expect(env.balance.cents).toBe(500);
  });

  it("is idempotent by transaction id", () => {
    const groceries: Envelope = {
      id: "env-groceries",
      name: "Groceries",
      balance: Money.fromCents(500),
    };

    const base: Budget = {
      id: "household-1",
      availableToAssign: Money.fromCents(0),
      envelopes: [groceries],
    };

    const tx: Transaction = {
      id: "tx-3",
      accountId: "acc-1",
      amount: Money.fromCents(-100),
      description: "Snack",
      postedAt: "2026-02-11T00:00:00.000Z",
      envelopeId: "env-groceries",
    };

    const first = applyTransactionsToBudget(base, [tx]);
    const second = applyTransactionsToBudget(
      first.budget,
      [tx],
      first.appliedTransactionIds,
    );

    const env = second.budget.envelopes.find((e) => e.id === "env-groceries")!;
    expect(env.balance.cents).toBe(400);
  });
});
