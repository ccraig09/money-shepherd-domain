import { Money } from "../src";
import {
  setEnvelopeGoal,
  clearEnvelopeGoal,
} from "../src/logic/envelopeGoals";
import type { Budget } from "../src/models/Budget";

function makeBudget(envelopes: Budget["envelopes"]): Budget {
  return {
    id: "budget-1",
    availableToAssign: Money.fromCents(100000),
    envelopes,
  };
}

describe("setEnvelopeGoal", () => {
  test("sets a goal on an existing envelope", () => {
    const budget = makeBudget([
      { id: "env-1", name: "Groceries", balance: Money.fromCents(5000) },
    ]);
    const goal = Money.fromCents(50000);

    const result = setEnvelopeGoal(budget, "env-1", goal);

    expect(result.envelopes[0].goal?.cents).toBe(50000);
  });

  test("preserves other envelope fields", () => {
    const budget = makeBudget([
      { id: "env-1", name: "Groceries", balance: Money.fromCents(5000) },
    ]);

    const result = setEnvelopeGoal(budget, "env-1", Money.fromCents(30000));

    expect(result.envelopes[0].name).toBe("Groceries");
    expect(result.envelopes[0].balance.cents).toBe(5000);
    expect(result.envelopes[0].id).toBe("env-1");
  });

  test("does not modify other envelopes", () => {
    const budget = makeBudget([
      { id: "env-1", name: "Groceries", balance: Money.fromCents(5000) },
      { id: "env-2", name: "Rent", balance: Money.fromCents(0) },
    ]);

    const result = setEnvelopeGoal(budget, "env-1", Money.fromCents(30000));

    expect(result.envelopes[1].goal).toBeUndefined();
  });

  test("replaces an existing goal", () => {
    const budget = makeBudget([
      {
        id: "env-1",
        name: "Groceries",
        balance: Money.fromCents(5000),
        goal: Money.fromCents(20000),
      },
    ]);

    const result = setEnvelopeGoal(budget, "env-1", Money.fromCents(60000));

    expect(result.envelopes[0].goal?.cents).toBe(60000);
  });

  test("throws when envelope not found", () => {
    const budget = makeBudget([]);

    expect(() =>
      setEnvelopeGoal(budget, "env-missing", Money.fromCents(10000)),
    ).toThrow("Envelope not found");
  });

  test("throws when goal is zero", () => {
    const budget = makeBudget([
      { id: "env-1", name: "Groceries", balance: Money.fromCents(5000) },
    ]);

    expect(() =>
      setEnvelopeGoal(budget, "env-1", Money.fromCents(0)),
    ).toThrow("Goal must be a positive amount");
  });

  test("throws when goal is negative", () => {
    const budget = makeBudget([
      { id: "env-1", name: "Groceries", balance: Money.fromCents(5000) },
    ]);

    expect(() =>
      setEnvelopeGoal(budget, "env-1", Money.fromCents(-100)),
    ).toThrow("Goal must be a positive amount");
  });

  test("does not mutate original budget", () => {
    const budget = makeBudget([
      { id: "env-1", name: "Groceries", balance: Money.fromCents(5000) },
    ]);

    setEnvelopeGoal(budget, "env-1", Money.fromCents(30000));

    expect(budget.envelopes[0].goal).toBeUndefined();
  });
});

describe("clearEnvelopeGoal", () => {
  test("removes goal from an envelope", () => {
    const budget = makeBudget([
      {
        id: "env-1",
        name: "Groceries",
        balance: Money.fromCents(5000),
        goal: Money.fromCents(50000),
      },
    ]);

    const result = clearEnvelopeGoal(budget, "env-1");

    expect(result.envelopes[0].goal).toBeUndefined();
  });

  test("no-op when envelope has no goal", () => {
    const budget = makeBudget([
      { id: "env-1", name: "Groceries", balance: Money.fromCents(5000) },
    ]);

    const result = clearEnvelopeGoal(budget, "env-1");

    expect(result.envelopes[0].goal).toBeUndefined();
  });

  test("throws when envelope not found", () => {
    const budget = makeBudget([]);

    expect(() => clearEnvelopeGoal(budget, "env-missing")).toThrow(
      "Envelope not found",
    );
  });

  test("does not mutate original budget", () => {
    const goal = Money.fromCents(50000);
    const budget = makeBudget([
      { id: "env-1", name: "Groceries", balance: Money.fromCents(5000), goal },
    ]);

    clearEnvelopeGoal(budget, "env-1");

    expect(budget.envelopes[0].goal?.cents).toBe(50000);
  });
});
