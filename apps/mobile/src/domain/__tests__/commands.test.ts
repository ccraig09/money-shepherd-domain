import { Money, applyTransactionsToBudget } from "@money-shepherd/domain";
import type { AppStateV1 } from "../appState";
import { createEnvelope, renameEnvelope, deleteEnvelope, setTransactionNote, seedBudgetFromBalances, assignTransaction, addAssignmentRule, removeAssignmentRule, reorderAssignmentRules } from "../commands";

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

  it("sets seededAccountIds when accountIds provided", () => {
    const state = makeState();
    const next = seedBudgetFromBalances(state, {
      totalCents: 500000,
      accountIds: ["plaid-acct-1", "plaid-acct-2"],
    });
    expect(next.seededAccountIds).toEqual(["plaid-acct-1", "plaid-acct-2"]);
  });

  it("merges new accountIds with existing seededAccountIds", () => {
    const state = makeState();
    state.seededAccountIds = ["plaid-acct-1"];
    state.budgetSeeded = true;
    const next = seedBudgetFromBalances(state, {
      totalCents: 700000,
      accountIds: ["plaid-acct-2", "plaid-acct-3"],
    });
    expect(next.seededAccountIds).toEqual(["plaid-acct-1", "plaid-acct-2", "plaid-acct-3"]);
  });

  it("deduplicates accountIds on merge", () => {
    const state = makeState();
    state.seededAccountIds = ["plaid-acct-1", "plaid-acct-2"];
    const next = seedBudgetFromBalances(state, {
      totalCents: 700000,
      accountIds: ["plaid-acct-2", "plaid-acct-3"],
    });
    expect(next.seededAccountIds).toEqual(["plaid-acct-1", "plaid-acct-2", "plaid-acct-3"]);
  });

  it("defaults seededAccountIds to empty when accountIds omitted", () => {
    const state = makeState();
    const next = seedBudgetFromBalances(state, { totalCents: 500000 });
    expect(next.seededAccountIds).toEqual([]);
  });

  it("preserves existing seededAccountIds when accountIds omitted", () => {
    const state = makeState();
    state.seededAccountIds = ["plaid-acct-1"];
    const next = seedBudgetFromBalances(state, { totalCents: 500000 });
    expect(next.seededAccountIds).toEqual(["plaid-acct-1"]);
  });

  it("marks income transaction IDs as applied to budget", () => {
    const state = makeState();
    state.transactions = [
      { id: "tx-income-1", accountId: "acc-1", amount: Money.fromCents(150000), description: "Paycheck", postedAt: "2026-02-01T00:00:00.000Z" },
      { id: "tx-income-2", accountId: "acc-1", amount: Money.fromCents(50000), description: "Bonus", postedAt: "2026-02-15T00:00:00.000Z" },
    ];
    const next = seedBudgetFromBalances(state, { totalCents: 500000 });
    expect(next.appliedBudgetTransactionIds).toContain("tx-income-1");
    expect(next.appliedBudgetTransactionIds).toContain("tx-income-2");
  });

  it("does NOT mark expense transaction IDs as applied", () => {
    const state = makeState();
    state.transactions = [
      { id: "tx-income-1", accountId: "acc-1", amount: Money.fromCents(150000), description: "Paycheck", postedAt: "2026-02-01T00:00:00.000Z" },
      { id: "tx-expense-1", accountId: "acc-1", amount: Money.fromCents(-5000), description: "Groceries", postedAt: "2026-02-05T00:00:00.000Z" },
      { id: "tx-expense-2", accountId: "acc-1", amount: Money.fromCents(-2500), description: "Coffee", postedAt: "2026-02-06T00:00:00.000Z" },
    ];
    const next = seedBudgetFromBalances(state, { totalCents: 500000 });
    expect(next.appliedBudgetTransactionIds).toContain("tx-income-1");
    expect(next.appliedBudgetTransactionIds).not.toContain("tx-expense-1");
    expect(next.appliedBudgetTransactionIds).not.toContain("tx-expense-2");
  });

  it("preserves existing appliedBudgetTransactionIds on merge", () => {
    const state = makeState();
    state.appliedBudgetTransactionIds = ["tx-old-1", "tx-old-2"];
    state.transactions = [
      { id: "tx-income-new", accountId: "acc-1", amount: Money.fromCents(100000), description: "Paycheck", postedAt: "2026-03-01T00:00:00.000Z" },
    ];
    const next = seedBudgetFromBalances(state, { totalCents: 500000 });
    expect(next.appliedBudgetTransactionIds).toContain("tx-old-1");
    expect(next.appliedBudgetTransactionIds).toContain("tx-old-2");
    expect(next.appliedBudgetTransactionIds).toContain("tx-income-new");
  });

  it("prevents double-counting: seed + recompute does not re-add income", () => {
    // Simulate: seed with bank balances, then applyTransactionsToBudget runs
    const state = makeState();
    state.transactions = [
      { id: "tx-income-1", accountId: "acc-1", amount: Money.fromCents(200000), description: "Paycheck", postedAt: "2026-02-01T00:00:00.000Z" },
    ];
    // Seed sets Available to bank balance
    const seeded = seedBudgetFromBalances(state, { totalCents: 500000 });
    expect(seeded.budget.availableToAssign.cents).toBe(500000);

    // Simulate recompute calling applyTransactionsToBudget
    const result = applyTransactionsToBudget(
      seeded.budget,
      seeded.transactions,
      new Set(seeded.appliedBudgetTransactionIds),
    );
    // Income tx was already marked as applied — should NOT be added again
    expect(result.budget.availableToAssign.cents).toBe(500000);
  });
});

describe("assignTransaction — payeeMappings", () => {
  function makeStateWithEnvelopeAndTx(description: string): AppStateV1 {
    const state = makeState(["Groceries"]);
    state.transactions = [
      {
        id: "tx-1",
        accountId: "acc-1",
        amount: Money.fromCents(-2500),
        description,
        postedAt: "2024-01-15T10:00:00.000Z",
      },
    ];
    return state;
  }

  it("records normalized payee → envelopeId on assignment", () => {
    const state = makeStateWithEnvelopeAndTx("WALMART #1234");
    const next = assignTransaction(state, {
      transactionId: "tx-1",
      envelopeId: "env-0",
      assignedByUserId: "user-los",
    });
    expect(next.payeeMappings?.["walmart"]).toBe("env-0");
  });

  it("overwrites previous mapping for the same payee", () => {
    const state = makeStateWithEnvelopeAndTx("WALMART #5678");
    state.payeeMappings = { walmart: "env-old" };
    const next = assignTransaction(state, {
      transactionId: "tx-1",
      envelopeId: "env-0",
      assignedByUserId: "user-los",
    });
    expect(next.payeeMappings?.["walmart"]).toBe("env-0");
  });

  it("preserves existing mappings for other payees", () => {
    const state = makeStateWithEnvelopeAndTx("TARGET");
    state.payeeMappings = { walmart: "env-0" };
    const next = assignTransaction(state, {
      transactionId: "tx-1",
      envelopeId: "env-0",
      assignedByUserId: "user-los",
    });
    expect(next.payeeMappings?.["walmart"]).toBe("env-0");
    expect(next.payeeMappings?.["target"]).toBe("env-0");
  });

  it("does not write mapping when transaction description is empty", () => {
    const state = makeStateWithEnvelopeAndTx("");
    const next = assignTransaction(state, {
      transactionId: "tx-1",
      envelopeId: "env-0",
      assignedByUserId: "user-los",
    });
    expect(next.payeeMappings).toEqual({});
  });

  it("initializes payeeMappings when undefined", () => {
    const state = makeStateWithEnvelopeAndTx("STARBUCKS");
    expect(state.payeeMappings).toBeUndefined();
    const next = assignTransaction(state, {
      transactionId: "tx-1",
      envelopeId: "env-0",
      assignedByUserId: "user-los",
    });
    expect(next.payeeMappings).toBeDefined();
    expect(next.payeeMappings?.["starbucks"]).toBe("env-0");
  });
});

describe("addAssignmentRule", () => {
  it("adds a rule to an empty list", () => {
    const state = makeState(["Groceries"]);
    const next = addAssignmentRule(state, {
      pattern: "walmart",
      matchType: "contains",
      envelopeId: "env-0",
      priority: 1,
    });
    expect(next.assignmentRules).toHaveLength(1);
    expect(next.assignmentRules![0].pattern).toBe("walmart");
    expect(next.assignmentRules![0].matchType).toBe("contains");
    expect(next.assignmentRules![0].envelopeId).toBe("env-0");
    expect(next.assignmentRules![0].priority).toBe(1);
    expect(next.assignmentRules![0].id).toBeDefined();
  });

  it("appends to existing rules", () => {
    const state = makeState(["Groceries"]);
    state.assignmentRules = [
      { id: "rule-1", pattern: "target", matchType: "contains", envelopeId: "env-0", priority: 1 },
    ];
    const next = addAssignmentRule(state, {
      pattern: "starbucks",
      matchType: "exact",
      envelopeId: "env-0",
      priority: 2,
    });
    expect(next.assignmentRules).toHaveLength(2);
    expect(next.assignmentRules![0].pattern).toBe("target");
    expect(next.assignmentRules![1].pattern).toBe("starbucks");
  });

  it("throws when pattern is empty", () => {
    const state = makeState(["Groceries"]);
    expect(() =>
      addAssignmentRule(state, {
        pattern: "  ",
        matchType: "contains",
        envelopeId: "env-0",
        priority: 1,
      }),
    ).toThrow("Pattern is required.");
  });
});

describe("removeAssignmentRule", () => {
  it("removes a rule by id", () => {
    const state = makeState();
    state.assignmentRules = [
      { id: "rule-1", pattern: "walmart", matchType: "contains", envelopeId: "env-0", priority: 1 },
      { id: "rule-2", pattern: "target", matchType: "contains", envelopeId: "env-0", priority: 2 },
    ];
    const next = removeAssignmentRule(state, { ruleId: "rule-1" });
    expect(next.assignmentRules).toHaveLength(1);
    expect(next.assignmentRules![0].id).toBe("rule-2");
  });

  it("throws when rule not found", () => {
    const state = makeState();
    state.assignmentRules = [];
    expect(() =>
      removeAssignmentRule(state, { ruleId: "rule-999" }),
    ).toThrow("Rule not found.");
  });
});

describe("reorderAssignmentRules", () => {
  it("reassigns priorities based on new id order", () => {
    const state = makeState();
    state.assignmentRules = [
      { id: "rule-a", pattern: "walmart", matchType: "contains", envelopeId: "env-0", priority: 1 },
      { id: "rule-b", pattern: "target", matchType: "contains", envelopeId: "env-0", priority: 2 },
      { id: "rule-c", pattern: "costco", matchType: "exact", envelopeId: "env-0", priority: 3 },
    ];
    const next = reorderAssignmentRules(state, {
      ruleIds: ["rule-c", "rule-a", "rule-b"],
    });
    expect(next.assignmentRules![0]).toMatchObject({ id: "rule-c", priority: 1 });
    expect(next.assignmentRules![1]).toMatchObject({ id: "rule-a", priority: 2 });
    expect(next.assignmentRules![2]).toMatchObject({ id: "rule-b", priority: 3 });
  });
});
