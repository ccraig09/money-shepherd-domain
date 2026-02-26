import { Money } from "../src";
import {
  setEnvelopeTarget,
  clearEnvelopeTarget,
} from "../src/logic/envelopeGoals";
import type { Budget } from "../src/models/Budget";

function makeBudget(envelopes: Budget["envelopes"]): Budget {
  return {
    id: "budget-1",
    availableToAssign: Money.fromCents(10000),
    envelopes,
  };
}

describe("setEnvelopeTarget", () => {
  test("sets a target on an existing envelope", () => {
    const budget = makeBudget([
      { id: "env-1", name: "Groceries", balance: Money.fromCents(5000) },
    ]);
    const target = Money.fromCents(500000); // $5,000 payoff target

    const result = setEnvelopeTarget(budget, "env-1", target);

    expect(result.envelopes[0].target?.cents).toBe(500000);
  });

  test("does not affect other envelopes", () => {
    const budget = makeBudget([
      { id: "env-1", name: "Groceries", balance: Money.fromCents(5000) },
      { id: "env-2", name: "Rent", balance: Money.fromCents(2000) },
    ]);

    const result = setEnvelopeTarget(budget, "env-1", Money.fromCents(500000));

    expect(result.envelopes[1].target).toBeUndefined();
  });

  test("throws when target is zero", () => {
    const budget = makeBudget([
      { id: "env-1", name: "Groceries", balance: Money.fromCents(5000) },
    ]);

    expect(() =>
      setEnvelopeTarget(budget, "env-1", Money.fromCents(0)),
    ).toThrow("Target must be a positive amount");
  });

  test("throws when target is negative", () => {
    const budget = makeBudget([
      { id: "env-1", name: "Groceries", balance: Money.fromCents(5000) },
    ]);

    expect(() =>
      setEnvelopeTarget(budget, "env-1", Money.fromCents(-100)),
    ).toThrow("Target must be a positive amount");
  });

  test("throws when envelope not found", () => {
    const budget = makeBudget([]);

    expect(() =>
      setEnvelopeTarget(budget, "env-missing", Money.fromCents(1000)),
    ).toThrow("Envelope not found");
  });

  test("replaces an existing target", () => {
    const budget = makeBudget([
      {
        id: "env-1",
        name: "Groceries",
        balance: Money.fromCents(5000),
        target: Money.fromCents(100000),
      },
    ]);

    const result = setEnvelopeTarget(budget, "env-1", Money.fromCents(200000));

    expect(result.envelopes[0].target?.cents).toBe(200000);
  });

  test("preserves existing goal when setting target", () => {
    const budget = makeBudget([
      {
        id: "env-1",
        name: "Groceries",
        balance: Money.fromCents(5000),
        goal: Money.fromCents(50000),
      },
    ]);

    const result = setEnvelopeTarget(budget, "env-1", Money.fromCents(500000));

    expect(result.envelopes[0].goal?.cents).toBe(50000);
    expect(result.envelopes[0].target?.cents).toBe(500000);
  });

  test("does not mutate original budget", () => {
    const budget = makeBudget([
      { id: "env-1", name: "Groceries", balance: Money.fromCents(5000) },
    ]);

    setEnvelopeTarget(budget, "env-1", Money.fromCents(500000));

    expect(budget.envelopes[0].target).toBeUndefined();
  });
});

describe("clearEnvelopeTarget", () => {
  test("removes target from an envelope", () => {
    const budget = makeBudget([
      {
        id: "env-1",
        name: "Groceries",
        balance: Money.fromCents(5000),
        target: Money.fromCents(500000),
      },
    ]);

    const result = clearEnvelopeTarget(budget, "env-1");

    expect(result.envelopes[0].target).toBeUndefined();
  });

  test("no-op when envelope has no target", () => {
    const budget = makeBudget([
      { id: "env-1", name: "Groceries", balance: Money.fromCents(5000) },
    ]);

    const result = clearEnvelopeTarget(budget, "env-1");

    expect(result.envelopes[0].target).toBeUndefined();
  });

  test("throws when envelope not found", () => {
    const budget = makeBudget([]);

    expect(() => clearEnvelopeTarget(budget, "env-missing")).toThrow(
      "Envelope not found",
    );
  });

  test("preserves existing goal when clearing target", () => {
    const budget = makeBudget([
      {
        id: "env-1",
        name: "Groceries",
        balance: Money.fromCents(5000),
        goal: Money.fromCents(50000),
        target: Money.fromCents(500000),
      },
    ]);

    const result = clearEnvelopeTarget(budget, "env-1");

    expect(result.envelopes[0].goal?.cents).toBe(50000);
    expect(result.envelopes[0].target).toBeUndefined();
  });

  test("does not mutate original budget", () => {
    const target = Money.fromCents(500000);
    const budget = makeBudget([
      { id: "env-1", name: "Groceries", balance: Money.fromCents(5000), target },
    ]);

    clearEnvelopeTarget(budget, "env-1");

    expect(budget.envelopes[0].target?.cents).toBe(500000);
  });
});
