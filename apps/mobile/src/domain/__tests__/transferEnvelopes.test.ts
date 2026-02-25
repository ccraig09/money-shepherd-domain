import { Money } from "@money-shepherd/domain";
import type { AppStateV1 } from "../appState";
import { transferBetweenEnvelopes } from "../commands";

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
        { id: "env-1", name: "Dining", balance: Money.fromCents(3000) },
        { id: "env-2", name: "Gas", balance: Money.fromCents(0) },
      ],
    },
    accounts: [],
    transactions: [],
    inbox: { unassignedTransactionIds: [], assignmentsByTransactionId: {} },
    appliedAccountTransactionIds: [],
    appliedBudgetTransactionIds: [],
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("transferBetweenEnvelopes", () => {
  it("deducts from source and adds to destination", () => {
    const state = makeState();
    const next = transferBetweenEnvelopes(state, {
      fromEnvelopeId: "env-0",
      toEnvelopeId: "env-1",
      amountCents: 2000,
    });
    const from = next.budget.envelopes.find((e) => e.id === "env-0")!;
    const to = next.budget.envelopes.find((e) => e.id === "env-1")!;
    expect(from.balance.cents).toBe(3000);
    expect(to.balance.cents).toBe(5000);
  });

  it("does not change availableToAssign", () => {
    const state = makeState();
    const next = transferBetweenEnvelopes(state, {
      fromEnvelopeId: "env-0",
      toEnvelopeId: "env-1",
      amountCents: 2000,
    });
    expect(next.budget.availableToAssign.cents).toBe(10000);
  });

  it("allows transferring the entire source balance", () => {
    const state = makeState();
    const next = transferBetweenEnvelopes(state, {
      fromEnvelopeId: "env-0",
      toEnvelopeId: "env-2",
      amountCents: 5000,
    });
    const from = next.budget.envelopes.find((e) => e.id === "env-0")!;
    const to = next.budget.envelopes.find((e) => e.id === "env-2")!;
    expect(from.balance.cents).toBe(0);
    expect(to.balance.cents).toBe(5000);
  });

  it("throws when source has insufficient balance", () => {
    const state = makeState();
    expect(() =>
      transferBetweenEnvelopes(state, {
        fromEnvelopeId: "env-0",
        toEnvelopeId: "env-1",
        amountCents: 6000,
      }),
    ).toThrow("Insufficient balance");
  });

  it("throws when source and destination are the same", () => {
    const state = makeState();
    expect(() =>
      transferBetweenEnvelopes(state, {
        fromEnvelopeId: "env-0",
        toEnvelopeId: "env-0",
        amountCents: 1000,
      }),
    ).toThrow("Cannot transfer to the same envelope.");
  });

  it("throws when amount is zero", () => {
    const state = makeState();
    expect(() =>
      transferBetweenEnvelopes(state, {
        fromEnvelopeId: "env-0",
        toEnvelopeId: "env-1",
        amountCents: 0,
      }),
    ).toThrow("Amount must be greater than zero.");
  });

  it("throws when amount is negative", () => {
    const state = makeState();
    expect(() =>
      transferBetweenEnvelopes(state, {
        fromEnvelopeId: "env-0",
        toEnvelopeId: "env-1",
        amountCents: -500,
      }),
    ).toThrow("Amount must be greater than zero.");
  });

  it("throws when source envelope not found", () => {
    const state = makeState();
    expect(() =>
      transferBetweenEnvelopes(state, {
        fromEnvelopeId: "env-999",
        toEnvelopeId: "env-1",
        amountCents: 1000,
      }),
    ).toThrow("Source envelope not found.");
  });

  it("throws when destination envelope not found", () => {
    const state = makeState();
    expect(() =>
      transferBetweenEnvelopes(state, {
        fromEnvelopeId: "env-0",
        toEnvelopeId: "env-999",
        amountCents: 1000,
      }),
    ).toThrow("Destination envelope not found.");
  });

  it("does not affect other envelopes", () => {
    const state = makeState();
    const next = transferBetweenEnvelopes(state, {
      fromEnvelopeId: "env-0",
      toEnvelopeId: "env-1",
      amountCents: 1000,
    });
    const gas = next.budget.envelopes.find((e) => e.id === "env-2")!;
    expect(gas.balance.cents).toBe(0);
  });
});
