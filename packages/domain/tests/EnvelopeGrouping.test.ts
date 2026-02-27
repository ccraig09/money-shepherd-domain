import { Money } from "../src/models/Money";
import type { Envelope } from "../src/models/Envelope";
import type { EnvelopeGroup } from "../src/models/EnvelopeGroup";
import { groupEnvelopes, reorderGroups } from "../src/logic/envelopeGrouping";

function makeEnvelope(overrides: Partial<Envelope> & { id: string; name: string }): Envelope {
  return { balance: Money.zero(), ...overrides };
}

function makeGroup(id: string, name: string, sortOrder: number): EnvelopeGroup {
  return { id, name, sortOrder };
}

describe("groupEnvelopes", () => {
  const groups: EnvelopeGroup[] = [
    makeGroup("g-needs", "Needs", 0),
    makeGroup("g-wants", "Wants", 1),
    makeGroup("g-savings", "Savings", 2),
  ];

  test("groups envelopes by their groupId", () => {
    const envelopes: Envelope[] = [
      makeEnvelope({ id: "e1", name: "Rent", groupId: "g-needs" }),
      makeEnvelope({ id: "e2", name: "Fun", groupId: "g-wants" }),
      makeEnvelope({ id: "e3", name: "Groceries", groupId: "g-needs" }),
    ];

    const result = groupEnvelopes(envelopes, groups);

    expect(result).toHaveLength(3);
    expect(result[0].group.name).toBe("Needs");
    expect(result[0].envelopes.map((e) => e.id)).toEqual(["e1", "e3"]);
    expect(result[1].group.name).toBe("Wants");
    expect(result[1].envelopes.map((e) => e.id)).toEqual(["e2"]);
    expect(result[2].group.name).toBe("Savings");
    expect(result[2].envelopes).toEqual([]);
  });

  test("places ungrouped envelopes in an Ungrouped bucket at the end", () => {
    const envelopes: Envelope[] = [
      makeEnvelope({ id: "e1", name: "Rent", groupId: "g-needs" }),
      makeEnvelope({ id: "e2", name: "Misc" }), // no groupId
      makeEnvelope({ id: "e3", name: "Random" }), // no groupId
    ];

    const result = groupEnvelopes(envelopes, groups);

    const ungrouped = result[result.length - 1];
    expect(ungrouped.group.name).toBe("Ungrouped");
    expect(ungrouped.envelopes.map((e) => e.id)).toEqual(["e2", "e3"]);
  });

  test("omits Ungrouped bucket when all envelopes have groups", () => {
    const envelopes: Envelope[] = [
      makeEnvelope({ id: "e1", name: "Rent", groupId: "g-needs" }),
    ];

    const result = groupEnvelopes(envelopes, groups);

    expect(result.every((r) => r.group.name !== "Ungrouped")).toBe(true);
  });

  test("sorts groups by sortOrder", () => {
    const reversed: EnvelopeGroup[] = [
      makeGroup("g-savings", "Savings", 2),
      makeGroup("g-needs", "Needs", 0),
      makeGroup("g-wants", "Wants", 1),
    ];

    const envelopes: Envelope[] = [
      makeEnvelope({ id: "e1", name: "Rent", groupId: "g-needs" }),
    ];

    const result = groupEnvelopes(envelopes, reversed);

    expect(result[0].group.name).toBe("Needs");
    expect(result[1].group.name).toBe("Wants");
    expect(result[2].group.name).toBe("Savings");
  });

  test("handles envelopes with unknown groupId as ungrouped", () => {
    const envelopes: Envelope[] = [
      makeEnvelope({ id: "e1", name: "Ghost", groupId: "g-deleted" }),
    ];

    const result = groupEnvelopes(envelopes, groups);

    const ungrouped = result[result.length - 1];
    expect(ungrouped.group.name).toBe("Ungrouped");
    expect(ungrouped.envelopes.map((e) => e.id)).toEqual(["e1"]);
  });

  test("returns empty groups when no envelopes", () => {
    const result = groupEnvelopes([], groups);

    expect(result).toHaveLength(3);
    expect(result.every((r) => r.envelopes.length === 0)).toBe(true);
  });

  test("returns only Ungrouped bucket when no groups defined", () => {
    const envelopes: Envelope[] = [
      makeEnvelope({ id: "e1", name: "Misc" }),
    ];

    const result = groupEnvelopes(envelopes, []);

    expect(result).toHaveLength(1);
    expect(result[0].group.name).toBe("Ungrouped");
    expect(result[0].envelopes.map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("reorderGroups", () => {
  test("updates sortOrder based on provided ID order", () => {
    const groups: EnvelopeGroup[] = [
      makeGroup("g-needs", "Needs", 0),
      makeGroup("g-wants", "Wants", 1),
      makeGroup("g-savings", "Savings", 2),
    ];

    const result = reorderGroups(groups, ["g-savings", "g-needs", "g-wants"]);

    expect(result.find((g) => g.id === "g-savings")!.sortOrder).toBe(0);
    expect(result.find((g) => g.id === "g-needs")!.sortOrder).toBe(1);
    expect(result.find((g) => g.id === "g-wants")!.sortOrder).toBe(2);
  });

  test("preserves groups not in the ordered list at the end", () => {
    const groups: EnvelopeGroup[] = [
      makeGroup("g-needs", "Needs", 0),
      makeGroup("g-wants", "Wants", 1),
      makeGroup("g-savings", "Savings", 2),
    ];

    const result = reorderGroups(groups, ["g-wants"]);

    expect(result.find((g) => g.id === "g-wants")!.sortOrder).toBe(0);
    // Others get higher sortOrder
    expect(result.find((g) => g.id === "g-needs")!.sortOrder).toBeGreaterThan(0);
    expect(result.find((g) => g.id === "g-savings")!.sortOrder).toBeGreaterThan(0);
  });

  test("does not mutate original groups", () => {
    const groups: EnvelopeGroup[] = [
      makeGroup("g-needs", "Needs", 0),
      makeGroup("g-wants", "Wants", 1),
    ];

    reorderGroups(groups, ["g-wants", "g-needs"]);

    expect(groups[0].sortOrder).toBe(0);
    expect(groups[1].sortOrder).toBe(1);
  });
});
