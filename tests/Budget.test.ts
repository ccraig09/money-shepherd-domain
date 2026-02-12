import { Money } from "../src";
import { Budget } from "../src/models/Budget";
import { Envelope } from "../src/models/Envelope";
import { allocateFunds } from "../src/logic/allocateFunds";
import { spendFromEnvelope } from "../src/logic/spendFromEnvelope";
import { InsufficientAvailableFundsError } from "../src/errors/InsufficientAvailableFundsError";
import { InsufficientEnvelopeFundsError } from "../src/errors/InsufficientEnvelopeFundsError";

describe("Budget envelope rules", () => {
  const groceries: Envelope = {
    id: "env-groceries",
    name: "Groceries",
    balance: Money.zero(),
  };
  const vacation: Envelope = {
    id: "env-vacation",
    name: "Vacation",
    balance: Money.zero(),
  };

  const baseBudget: Budget = {
    id: "household-1",
    availableToAssign: Money.fromCents(1000),
    envelopes: [groceries, vacation],
  };

  it("allocates funds from availableToAssign into an envelope", () => {
    const updated = allocateFunds(
      baseBudget,
      "env-groceries",
      Money.fromCents(300),
    );

    expect(updated.availableToAssign.cents).toBe(700);
    expect(
      updated.envelopes.find((e) => e.id === "env-groceries")!.balance.cents,
    ).toBe(300);
  });

  it("throws if allocating more than availableToAssign", () => {
    expect(() =>
      allocateFunds(baseBudget, "env-groceries", Money.fromCents(2000)),
    ).toThrow(InsufficientAvailableFundsError);
  });

  it("spends from an envelope balance", () => {
    const allocated = allocateFunds(
      baseBudget,
      "env-groceries",
      Money.fromCents(400),
    );
    const spent = spendFromEnvelope(
      allocated,
      "env-groceries",
      Money.fromCents(150),
    );

    expect(
      spent.envelopes.find((e) => e.id === "env-groceries")!.balance.cents,
    ).toBe(250);
  });

  it("throws if spending more than envelope balance", () => {
    const allocated = allocateFunds(
      baseBudget,
      "env-groceries",
      Money.fromCents(100),
    );

    expect(() =>
      spendFromEnvelope(allocated, "env-groceries", Money.fromCents(200)),
    ).toThrow(InsufficientEnvelopeFundsError);
  });
});
