import { Money } from "@money-shepherd/domain";
import type { AppStateV1 } from "../appState";
import { allocateToEnvelope } from "../allocate";

function makeState(envelopeNames: string[] = [], availableCents = 10000): AppStateV1 {
  return {
    version: 1,
    householdId: "hh-1",
    users: [],
    budget: {
      id: "budget-1",
      availableToAssign: Money.fromCents(availableCents),
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

describe("allocateToEnvelope", () => {
  it("moves funds from Available to the target envelope", () => {
    const state = makeState(["Groceries"], 50000);
    const next = allocateToEnvelope(state, { envelopeId: "env-0", amountCents: 20000 });
    expect(next.budget.availableToAssign.cents).toBe(30000);
    expect(next.budget.envelopes[0].balance.cents).toBe(20000);
  });

  it("allows allocating the entire available balance", () => {
    const state = makeState(["Rent"], 100000);
    const next = allocateToEnvelope(state, { envelopeId: "env-0", amountCents: 100000 });
    expect(next.budget.availableToAssign.cents).toBe(0);
    expect(next.budget.envelopes[0].balance.cents).toBe(100000);
  });

  it("subtracts from available even when envelope ID is not found (no-op on envelopes)", () => {
    const state = makeState(["Groceries"], 50000);
    const next = allocateToEnvelope(state, { envelopeId: "env-999", amountCents: 1000 });
    // Available is decremented but no envelope received the money
    expect(next.budget.availableToAssign.cents).toBe(49000);
    expect(next.budget.envelopes[0].balance.cents).toBe(0);
  });

  it("throws when allocating more than available", () => {
    const state = makeState(["Groceries"], 5000);
    expect(() =>
      allocateToEnvelope(state, { envelopeId: "env-0", amountCents: 10000 }),
    ).toThrow();
  });

  it("does not modify other envelopes", () => {
    const state = makeState(["Groceries", "Bills"], 50000);
    const next = allocateToEnvelope(state, { envelopeId: "env-0", amountCents: 15000 });
    expect(next.budget.envelopes[1].balance.cents).toBe(0);
    expect(next.budget.envelopes[1].name).toBe("Bills");
  });

  it("logs an Allocation record with envelopeId, amount, and date", () => {
    const state = makeState(["Groceries"], 50000);
    const next = allocateToEnvelope(state, { envelopeId: "env-0", amountCents: 20000 });
    expect(next.allocations).toHaveLength(1);
    const alloc = next.allocations![0];
    expect(alloc.envelopeId).toBe("env-0");
    expect(alloc.amount.cents).toBe(20000);
    // allocatedAt should be a YYYY-MM-DD string
    expect(alloc.allocatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("appends to existing allocations (accumulates)", () => {
    const state = makeState(["Groceries"], 50000);
    const existing: AppStateV1["allocations"] = [
      { envelopeId: "env-0", amount: Money.fromCents(10000), allocatedAt: "2026-01-15" },
    ];
    const stateWithAllocs = { ...state, allocations: existing };
    const next = allocateToEnvelope(stateWithAllocs, { envelopeId: "env-0", amountCents: 5000 });
    expect(next.allocations).toHaveLength(2);
    expect(next.allocations![0].amount.cents).toBe(10000);
    expect(next.allocations![1].amount.cents).toBe(5000);
  });

  it("handles undefined allocations gracefully (legacy state)", () => {
    const state = makeState(["Groceries"], 50000);
    // Ensure allocations is explicitly undefined (legacy state)
    expect(state.allocations).toBeUndefined();
    const next = allocateToEnvelope(state, { envelopeId: "env-0", amountCents: 15000 });
    expect(next.allocations).toHaveLength(1);
    expect(next.allocations![0].envelopeId).toBe("env-0");
  });
});
