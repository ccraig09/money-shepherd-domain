import { Money } from "@money-shepherd/domain";
import type { AppStateV1 } from "../appState";
import { createEnvelope, renameEnvelope, deleteEnvelope, setTransactionNote, seedBudgetFromBalances } from "../commands";

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

describe("renameEnvelope", () => {
  it("renames the envelope with the normalized name", () => {
    const state = makeState(["Groceries"]);
    const next = renameEnvelope(state, { envelopeId: "env-0", name: "Food" });
    expect(next.budget.envelopes[0].name).toBe("Food");
  });

  it("preserves the balance and id", () => {
    const state = makeState(["Groceries"]);
    state.budget.envelopes[0].balance = Money.fromCents(5000);
    const next = renameEnvelope(state, { envelopeId: "env-0", name: "Food" });
    expect(next.budget.envelopes[0].id).toBe("env-0");
    expect(next.budget.envelopes[0].balance.cents).toBe(5000);
  });

  it("trims and collapses spaces", () => {
    const state = makeState(["Groceries"]);
    const next = renameEnvelope(state, {
      envelopeId: "env-0",
      name: "  My  Food  ",
    });
    expect(next.budget.envelopes[0].name).toBe("My Food");
  });

  it("returns same state when name is unchanged (no-op)", () => {
    const state = makeState(["Groceries"]);
    const next = renameEnvelope(state, {
      envelopeId: "env-0",
      name: "Groceries",
    });
    expect(next).toBe(state);
  });

  it("throws when name is empty", () => {
    const state = makeState(["Groceries"]);
    expect(() =>
      renameEnvelope(state, { envelopeId: "env-0", name: "" }),
    ).toThrow("Envelope name is required.");
  });

  it("throws when envelope not found", () => {
    const state = makeState(["Groceries"]);
    expect(() =>
      renameEnvelope(state, { envelopeId: "env-999", name: "Food" }),
    ).toThrow("Envelope not found.");
  });

  it("throws on case-insensitive duplicate with another envelope", () => {
    const state = makeState(["Groceries", "Bills"]);
    expect(() =>
      renameEnvelope(state, { envelopeId: "env-0", name: "bills" }),
    ).toThrow("already exists");
  });

  it("allows renaming to a different case of the same name", () => {
    const state = makeState(["groceries"]);
    const next = renameEnvelope(state, {
      envelopeId: "env-0",
      name: "Groceries",
    });
    expect(next.budget.envelopes[0].name).toBe("Groceries");
  });

  it("does not affect other envelopes", () => {
    const state = makeState(["Groceries", "Bills", "Gas"]);
    const next = renameEnvelope(state, { envelopeId: "env-0", name: "Food" });
    expect(next.budget.envelopes[1].name).toBe("Bills");
    expect(next.budget.envelopes[2].name).toBe("Gas");
  });
});

describe("deleteEnvelope", () => {
  it("removes the envelope from the list", () => {
    const state = makeState(["Groceries", "Bills"]);
    const next = deleteEnvelope(state, { envelopeId: "env-0" });
    expect(next.budget.envelopes).toHaveLength(1);
    expect(next.budget.envelopes[0].name).toBe("Bills");
  });

  it("removes assignments pointing to the deleted envelope", () => {
    const state = makeState(["Groceries"]);
    state.inbox.assignmentsByTransactionId = {
      "tx-1": {
        transactionId: "tx-1",
        envelopeId: "env-0",
        assignedByUserId: "user-los",
        assignedAt: "2024-01-01T00:00:00.000Z",
      },
      "tx-2": {
        transactionId: "tx-2",
        envelopeId: "env-other",
        assignedByUserId: "user-los",
        assignedAt: "2024-01-01T00:00:00.000Z",
      },
    };
    const next = deleteEnvelope(state, { envelopeId: "env-0" });
    expect(Object.keys(next.inbox.assignmentsByTransactionId)).toEqual([
      "tx-2",
    ]);
  });

  it("returns envelope balance to availableToAssign", () => {
    const state = makeState(["Groceries"]);
    state.budget.envelopes[0].balance = Money.fromCents(2766);
    state.budget.availableToAssign = Money.fromCents(500);
    const next = deleteEnvelope(state, { envelopeId: "env-0" });
    expect(next.budget.availableToAssign.cents).toBe(3266);
  });

  it("works when envelope has zero balance and no assignments", () => {
    const state = makeState(["Groceries"]);
    const next = deleteEnvelope(state, { envelopeId: "env-0" });
    expect(next.budget.envelopes).toHaveLength(0);
    expect(next.budget.availableToAssign.cents).toBe(0);
    expect(Object.keys(next.inbox.assignmentsByTransactionId)).toHaveLength(0);
  });

  it("does not affect other envelopes", () => {
    const state = makeState(["Groceries", "Bills", "Gas"]);
    const next = deleteEnvelope(state, { envelopeId: "env-1" });
    expect(next.budget.envelopes).toHaveLength(2);
    expect(next.budget.envelopes[0].name).toBe("Groceries");
    expect(next.budget.envelopes[1].name).toBe("Gas");
  });

  it("throws when envelope not found", () => {
    const state = makeState(["Groceries"]);
    expect(() =>
      deleteEnvelope(state, { envelopeId: "env-999" }),
    ).toThrow("Envelope not found.");
  });
});

function makeStateWithTx(): AppStateV1 {
  const state = makeState();
  state.transactions = [
    {
      id: "tx-1",
      accountId: "acc-1",
      amount: Money.fromCents(-1500),
      description: "Coffee",
      postedAt: "2024-01-15T10:00:00.000Z",
    },
  ];
  return state;
}

describe("setTransactionNote", () => {
  it("sets a note on a transaction", () => {
    const state = makeStateWithTx();
    const next = setTransactionNote(state, {
      transactionId: "tx-1",
      note: "Morning latte",
    });
    expect(next.transactionNotes?.["tx-1"]).toBe("Morning latte");
  });

  it("replaces an existing note", () => {
    const state = makeStateWithTx();
    state.transactionNotes = { "tx-1": "Old note" };
    const next = setTransactionNote(state, {
      transactionId: "tx-1",
      note: "New note",
    });
    expect(next.transactionNotes?.["tx-1"]).toBe("New note");
  });

  it("removes the note entry when note is empty", () => {
    const state = makeStateWithTx();
    state.transactionNotes = { "tx-1": "Some note" };
    const next = setTransactionNote(state, {
      transactionId: "tx-1",
      note: "  ",
    });
    expect(next.transactionNotes?.["tx-1"]).toBeUndefined();
  });

  it("trims whitespace from the note", () => {
    const state = makeStateWithTx();
    const next = setTransactionNote(state, {
      transactionId: "tx-1",
      note: "  Trimmed note  ",
    });
    expect(next.transactionNotes?.["tx-1"]).toBe("Trimmed note");
  });

  it("throws when transaction not found", () => {
    const state = makeStateWithTx();
    expect(() =>
      setTransactionNote(state, { transactionId: "tx-999", note: "Oops" }),
    ).toThrow("Transaction not found.");
  });
});

describe("seedBudgetFromBalances", () => {
  it("seeds availableToAssign from totalCents and sets budgetSeeded", () => {
    const state = makeState();
    const next = seedBudgetFromBalances(state, { totalCents: 650000 });
    expect(next.budget.availableToAssign.cents).toBe(650000);
    expect(next.budgetSeeded).toBe(true);
  });

  it("overwrites availableToAssign when already nonzero (delta handled by caller)", () => {
    const state = makeState();
    state.budget.availableToAssign = Money.fromCents(100);
    const next = seedBudgetFromBalances(state, { totalCents: 650000 });
    expect(next.budget.availableToAssign.cents).toBe(650000);
  });

  it("allows seeding with zero totalCents", () => {
    const state = makeState();
    const next = seedBudgetFromBalances(state, { totalCents: 0 });
    expect(next.budget.availableToAssign.cents).toBe(0);
  });

  it("does not modify envelopes or assignments", () => {
    const state = makeState(["Groceries", "Bills"]);
    state.inbox.assignmentsByTransactionId = {
      "tx-1": {
        transactionId: "tx-1",
        envelopeId: "env-0",
        assignedByUserId: "user-los",
        assignedAt: "2024-01-01T00:00:00.000Z",
      },
    };
    const next = seedBudgetFromBalances(state, { totalCents: 500000 });
    expect(next.budget.envelopes).toHaveLength(2);
    expect(next.budget.envelopes[0].name).toBe("Groceries");
    expect(next.budget.envelopes[1].name).toBe("Bills");
    expect(next.inbox.assignmentsByTransactionId["tx-1"].envelopeId).toBe("env-0");
  });
});
