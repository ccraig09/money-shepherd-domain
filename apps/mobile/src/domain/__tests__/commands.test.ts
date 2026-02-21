import { Money } from "@money-shepherd/domain";
import type { AppStateV1 } from "../appState";
import { createEnvelope } from "../commands";

function makeState(envelopeNames: string[] = []): AppStateV1 {
  return {
    version: 1,
    householdId: "hh-1",
    users: [],
    budget: {
      id: "budget-1",
      availableToAssign: Money.zero(),
      envelopes: envelopeNames.map((name, i) => ({
        id: `env-${i}`,
        name,
        balance: Money.zero(),
      })),
    },
    accounts: [],
    transactions: [],
    inbox: { unassignedTransactionIds: [], assignmentsByTransactionId: {} },
    appliedAccountTransactionIds: [],
    appliedBudgetTransactionIds: [],
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("createEnvelope", () => {
  it("adds a new envelope with the normalized name", () => {
    const next = createEnvelope(makeState(), { name: "Groceries" });
    expect(next.budget.envelopes).toHaveLength(1);
    expect(next.budget.envelopes[0].name).toBe("Groceries");
  });

  it("trims leading and trailing spaces", () => {
    const next = createEnvelope(makeState(), { name: "  Bills  " });
    expect(next.budget.envelopes[0].name).toBe("Bills");
  });

  it("collapses internal multiple spaces", () => {
    const next = createEnvelope(makeState(), { name: "My  Savings  Fund" });
    expect(next.budget.envelopes[0].name).toBe("My Savings Fund");
  });

  it("throws when name is empty", () => {
    expect(() => createEnvelope(makeState(), { name: "" })).toThrow(
      "Envelope name is required.",
    );
  });

  it("throws when name is only spaces", () => {
    expect(() => createEnvelope(makeState(), { name: "   " })).toThrow(
      "Envelope name is required.",
    );
  });

  it("throws on exact duplicate name", () => {
    const state = makeState(["Groceries"]);
    expect(() => createEnvelope(state, { name: "Groceries" })).toThrow(
      "already exists",
    );
  });

  it("throws on case-insensitive duplicate", () => {
    const state = makeState(["Groceries"]);
    expect(() => createEnvelope(state, { name: "groceries" })).toThrow(
      "already exists",
    );
  });

  it("treats trimmed name as duplicate of existing", () => {
    const state = makeState(["Groceries"]);
    expect(() => createEnvelope(state, { name: "  Groceries  " })).toThrow(
      "already exists",
    );
  });

  it("prepends the new envelope to the list", () => {
    const state = makeState(["Bills"]);
    const next = createEnvelope(state, { name: "Groceries" });
    expect(next.budget.envelopes[0].name).toBe("Groceries");
    expect(next.budget.envelopes[1].name).toBe("Bills");
  });
});
