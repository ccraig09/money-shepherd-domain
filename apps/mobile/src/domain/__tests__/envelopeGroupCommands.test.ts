import { Money } from "@money-shepherd/domain";
import type { EnvelopeGroup } from "@money-shepherd/domain";
import type { AppStateV1 } from "../appState";
import {
  createEnvelopeGroup,
  renameEnvelopeGroup,
  deleteEnvelopeGroup,
  reorderEnvelopeGroups,
  moveEnvelopeToGroup,
  createEnvelope,
} from "../commands";

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

function makeStateWithGroups(
  groups: EnvelopeGroup[],
  envelopes: { name: string; groupId?: string }[] = [],
): AppStateV1 {
  return {
    ...makeState(),
    envelopeGroups: groups,
    budget: {
      id: "budget-1",
      availableToAssign: Money.zero(),
      envelopes: envelopes.map((e, i) => ({
        id: `env-${i}`,
        name: e.name,
        balance: Money.zero(),
        ...(e.groupId ? { groupId: e.groupId } : {}),
      })),
    },
  };
}

// ─── createEnvelopeGroup ────────────────────────────────────

describe("createEnvelopeGroup", () => {
  it("creates a group with the given name", () => {
    const state = makeState();
    const next = createEnvelopeGroup(state, { name: "Bills" });
    expect(next.envelopeGroups).toHaveLength(1);
    expect(next.envelopeGroups![0].name).toBe("Bills");
    expect(next.envelopeGroups![0].id).toBeDefined();
    expect(next.envelopeGroups![0].sortOrder).toBe(0);
  });

  it("trims and collapses whitespace in group name", () => {
    const state = makeState();
    const next = createEnvelopeGroup(state, { name: "  My  Group  " });
    expect(next.envelopeGroups![0].name).toBe("My Group");
  });

  it("appends to existing groups with next sortOrder", () => {
    const groups: EnvelopeGroup[] = [
      { id: "grp-1", name: "Bills", sortOrder: 0 },
      { id: "grp-2", name: "Savings", sortOrder: 1 },
    ];
    const state = makeStateWithGroups(groups);
    const next = createEnvelopeGroup(state, { name: "Fun" });
    expect(next.envelopeGroups).toHaveLength(3);
    expect(next.envelopeGroups![2].name).toBe("Fun");
    expect(next.envelopeGroups![2].sortOrder).toBe(2);
  });

  it("throws when name is empty", () => {
    const state = makeState();
    expect(() => createEnvelopeGroup(state, { name: "" })).toThrow(
      "Group name is required.",
    );
  });

  it("throws when name is only whitespace", () => {
    const state = makeState();
    expect(() => createEnvelopeGroup(state, { name: "   " })).toThrow(
      "Group name is required.",
    );
  });

  it("throws on duplicate group name (case-insensitive)", () => {
    const groups: EnvelopeGroup[] = [
      { id: "grp-1", name: "Bills", sortOrder: 0 },
    ];
    const state = makeStateWithGroups(groups);
    expect(() => createEnvelopeGroup(state, { name: "bills" })).toThrow(
      "already exists",
    );
  });

  it("initializes envelopeGroups when undefined", () => {
    const state = makeState();
    expect(state.envelopeGroups).toBeUndefined();
    const next = createEnvelopeGroup(state, { name: "Bills" });
    expect(next.envelopeGroups).toBeDefined();
    expect(next.envelopeGroups).toHaveLength(1);
  });
});

// ─── renameEnvelopeGroup ────────────────────────────────────

describe("renameEnvelopeGroup", () => {
  it("renames the group", () => {
    const groups: EnvelopeGroup[] = [
      { id: "grp-1", name: "Bills", sortOrder: 0 },
    ];
    const state = makeStateWithGroups(groups);
    const next = renameEnvelopeGroup(state, { groupId: "grp-1", name: "Utilities" });
    expect(next.envelopeGroups![0].name).toBe("Utilities");
  });

  it("preserves sortOrder and id", () => {
    const groups: EnvelopeGroup[] = [
      { id: "grp-1", name: "Bills", sortOrder: 3 },
    ];
    const state = makeStateWithGroups(groups);
    const next = renameEnvelopeGroup(state, { groupId: "grp-1", name: "Utilities" });
    expect(next.envelopeGroups![0].id).toBe("grp-1");
    expect(next.envelopeGroups![0].sortOrder).toBe(3);
  });

  it("trims and collapses whitespace", () => {
    const groups: EnvelopeGroup[] = [
      { id: "grp-1", name: "Bills", sortOrder: 0 },
    ];
    const state = makeStateWithGroups(groups);
    const next = renameEnvelopeGroup(state, { groupId: "grp-1", name: "  My  Bills  " });
    expect(next.envelopeGroups![0].name).toBe("My Bills");
  });

  it("throws when group not found", () => {
    const state = makeStateWithGroups([]);
    expect(() =>
      renameEnvelopeGroup(state, { groupId: "grp-999", name: "New" }),
    ).toThrow("Group not found.");
  });

  it("throws when name is empty", () => {
    const groups: EnvelopeGroup[] = [
      { id: "grp-1", name: "Bills", sortOrder: 0 },
    ];
    const state = makeStateWithGroups(groups);
    expect(() =>
      renameEnvelopeGroup(state, { groupId: "grp-1", name: "" }),
    ).toThrow("Group name is required.");
  });

  it("throws on duplicate name with another group", () => {
    const groups: EnvelopeGroup[] = [
      { id: "grp-1", name: "Bills", sortOrder: 0 },
      { id: "grp-2", name: "Savings", sortOrder: 1 },
    ];
    const state = makeStateWithGroups(groups);
    expect(() =>
      renameEnvelopeGroup(state, { groupId: "grp-1", name: "savings" }),
    ).toThrow("already exists");
  });

  it("returns same state when name unchanged", () => {
    const groups: EnvelopeGroup[] = [
      { id: "grp-1", name: "Bills", sortOrder: 0 },
    ];
    const state = makeStateWithGroups(groups);
    const next = renameEnvelopeGroup(state, { groupId: "grp-1", name: "Bills" });
    expect(next).toBe(state);
  });
});

// ─── deleteEnvelopeGroup ────────────────────────────────────

describe("deleteEnvelopeGroup", () => {
  it("removes the group from the list", () => {
    const groups: EnvelopeGroup[] = [
      { id: "grp-1", name: "Bills", sortOrder: 0 },
      { id: "grp-2", name: "Savings", sortOrder: 1 },
    ];
    const state = makeStateWithGroups(groups);
    const next = deleteEnvelopeGroup(state, { groupId: "grp-1" });
    expect(next.envelopeGroups).toHaveLength(1);
    expect(next.envelopeGroups![0].id).toBe("grp-2");
  });

  it("clears groupId on envelopes that belonged to the deleted group", () => {
    const groups: EnvelopeGroup[] = [
      { id: "grp-1", name: "Bills", sortOrder: 0 },
    ];
    const envelopes = [
      { name: "Rent", groupId: "grp-1" },
      { name: "Groceries" },
      { name: "Electric", groupId: "grp-1" },
    ];
    const state = makeStateWithGroups(groups, envelopes);
    const next = deleteEnvelopeGroup(state, { groupId: "grp-1" });
    expect(next.budget.envelopes[0].groupId).toBeUndefined();
    expect(next.budget.envelopes[1].groupId).toBeUndefined();
    expect(next.budget.envelopes[2].groupId).toBeUndefined();
  });

  it("does not affect envelopes in other groups", () => {
    const groups: EnvelopeGroup[] = [
      { id: "grp-1", name: "Bills", sortOrder: 0 },
      { id: "grp-2", name: "Fun", sortOrder: 1 },
    ];
    const envelopes = [
      { name: "Rent", groupId: "grp-1" },
      { name: "Games", groupId: "grp-2" },
    ];
    const state = makeStateWithGroups(groups, envelopes);
    const next = deleteEnvelopeGroup(state, { groupId: "grp-1" });
    expect(next.budget.envelopes[0].groupId).toBeUndefined();
    expect(next.budget.envelopes[1].groupId).toBe("grp-2");
  });

  it("throws when group not found", () => {
    const state = makeStateWithGroups([]);
    expect(() =>
      deleteEnvelopeGroup(state, { groupId: "grp-999" }),
    ).toThrow("Group not found.");
  });
});

// ─── reorderEnvelopeGroups ──────────────────────────────────

describe("reorderEnvelopeGroups", () => {
  it("reorders groups by the given ID array", () => {
    const groups: EnvelopeGroup[] = [
      { id: "grp-a", name: "Alpha", sortOrder: 0 },
      { id: "grp-b", name: "Beta", sortOrder: 1 },
      { id: "grp-c", name: "Charlie", sortOrder: 2 },
    ];
    const state = makeStateWithGroups(groups);
    const next = reorderEnvelopeGroups(state, {
      orderedIds: ["grp-c", "grp-a", "grp-b"],
    });
    expect(next.envelopeGroups![0]).toMatchObject({ id: "grp-c", sortOrder: 0 });
    expect(next.envelopeGroups![1]).toMatchObject({ id: "grp-a", sortOrder: 1 });
    expect(next.envelopeGroups![2]).toMatchObject({ id: "grp-b", sortOrder: 2 });
  });

  it("handles empty groups gracefully", () => {
    const state = makeStateWithGroups([]);
    const next = reorderEnvelopeGroups(state, { orderedIds: [] });
    expect(next.envelopeGroups).toEqual([]);
  });
});

// ─── moveEnvelopeToGroup ────────────────────────────────────

describe("moveEnvelopeToGroup", () => {
  it("sets groupId on the envelope", () => {
    const groups: EnvelopeGroup[] = [
      { id: "grp-1", name: "Bills", sortOrder: 0 },
    ];
    const envelopes = [{ name: "Rent" }];
    const state = makeStateWithGroups(groups, envelopes);
    const next = moveEnvelopeToGroup(state, { envelopeId: "env-0", groupId: "grp-1" });
    expect(next.budget.envelopes[0].groupId).toBe("grp-1");
  });

  it("clears groupId when groupId is null (ungroup)", () => {
    const groups: EnvelopeGroup[] = [
      { id: "grp-1", name: "Bills", sortOrder: 0 },
    ];
    const envelopes = [{ name: "Rent", groupId: "grp-1" }];
    const state = makeStateWithGroups(groups, envelopes);
    const next = moveEnvelopeToGroup(state, { envelopeId: "env-0", groupId: null });
    expect(next.budget.envelopes[0].groupId).toBeUndefined();
  });

  it("throws when envelope not found", () => {
    const state = makeStateWithGroups([]);
    expect(() =>
      moveEnvelopeToGroup(state, { envelopeId: "env-999", groupId: null }),
    ).toThrow("Envelope not found.");
  });

  it("throws when target group not found", () => {
    const envelopes = [{ name: "Rent" }];
    const state = makeStateWithGroups([], envelopes);
    expect(() =>
      moveEnvelopeToGroup(state, { envelopeId: "env-0", groupId: "grp-999" }),
    ).toThrow("Group not found.");
  });

  it("does not affect other envelopes", () => {
    const groups: EnvelopeGroup[] = [
      { id: "grp-1", name: "Bills", sortOrder: 0 },
    ];
    const envelopes = [{ name: "Rent" }, { name: "Groceries", groupId: "grp-1" }];
    const state = makeStateWithGroups(groups, envelopes);
    const next = moveEnvelopeToGroup(state, { envelopeId: "env-0", groupId: "grp-1" });
    expect(next.budget.envelopes[0].groupId).toBe("grp-1");
    expect(next.budget.envelopes[1].groupId).toBe("grp-1");
  });
});

// ─── createEnvelope with groupId ────────────────────────────

describe("createEnvelope with groupId", () => {
  it("sets groupId on the new envelope when provided", () => {
    const groups: EnvelopeGroup[] = [
      { id: "grp-1", name: "Bills", sortOrder: 0 },
    ];
    const state = makeStateWithGroups(groups);
    const next = createEnvelope(state, { name: "Rent", groupId: "grp-1" });
    expect(next.budget.envelopes[0].groupId).toBe("grp-1");
  });

  it("omits groupId when not provided", () => {
    const state = makeState();
    const next = createEnvelope(state, { name: "Groceries" });
    expect(next.budget.envelopes[0].groupId).toBeUndefined();
  });
});
