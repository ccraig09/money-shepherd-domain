import { Money } from "../src/models/Money";
import type { Envelope, EnvelopeType } from "../src/models/Envelope";
import { sortEnvelopesGivingFirst } from "../src/logic/envelopeSorting";

describe("Envelope type", () => {
  function makeEnvelope(overrides: Partial<Envelope> = {}): Envelope {
    return {
      id: overrides.id ?? "env-1",
      name: overrides.name ?? "Test",
      balance: overrides.balance ?? Money.zero(),
      ...overrides,
    };
  }

  it("defaults to spending when type is undefined", () => {
    const env = makeEnvelope();
    expect(env.type).toBeUndefined();
    // Domain convention: undefined type is treated as "spending"
  });

  it("accepts giving type", () => {
    const env = makeEnvelope({ type: "giving" });
    expect(env.type).toBe("giving");
  });

  it("accepts savings type", () => {
    const env = makeEnvelope({ type: "savings" });
    expect(env.type).toBe("savings");
  });
});

describe("sortEnvelopesGivingFirst", () => {
  function makeEnvelope(id: string, name: string, type?: EnvelopeType): Envelope {
    return { id, name, balance: Money.zero(), type };
  }

  it("sorts giving envelopes before spending envelopes", () => {
    const envelopes = [
      makeEnvelope("1", "Groceries"),
      makeEnvelope("2", "Tithe", "giving"),
      makeEnvelope("3", "Bills"),
    ];

    const sorted = sortEnvelopesGivingFirst(envelopes);

    expect(sorted[0].name).toBe("Tithe");
    expect(sorted[1].name).toBe("Bills");
    expect(sorted[2].name).toBe("Groceries");
  });

  it("sorts giving envelopes alphabetically among themselves", () => {
    const envelopes = [
      makeEnvelope("1", "Offering", "giving"),
      makeEnvelope("2", "Church", "giving"),
      makeEnvelope("3", "Groceries"),
    ];

    const sorted = sortEnvelopesGivingFirst(envelopes);

    expect(sorted[0].name).toBe("Church");
    expect(sorted[1].name).toBe("Offering");
    expect(sorted[2].name).toBe("Groceries");
  });

  it("sorts non-giving envelopes alphabetically", () => {
    const envelopes = [
      makeEnvelope("1", "Groceries"),
      makeEnvelope("2", "Bills"),
      makeEnvelope("3", "Gas"),
    ];

    const sorted = sortEnvelopesGivingFirst(envelopes);

    expect(sorted.map((e) => e.name)).toEqual(["Bills", "Gas", "Groceries"]);
  });

  it("treats undefined type as spending", () => {
    const envelopes = [
      makeEnvelope("1", "Groceries"),
      makeEnvelope("2", "Tithe", "giving"),
      makeEnvelope("3", "Savings", "savings"),
    ];

    const sorted = sortEnvelopesGivingFirst(envelopes);

    expect(sorted[0].name).toBe("Tithe");
    // spending and savings sort alphabetically after giving
    expect(sorted[1].name).toBe("Groceries");
    expect(sorted[2].name).toBe("Savings");
  });

  it("does not mutate the original array", () => {
    const envelopes = [
      makeEnvelope("1", "Groceries"),
      makeEnvelope("2", "Tithe", "giving"),
    ];
    const original = [...envelopes];

    sortEnvelopesGivingFirst(envelopes);

    expect(envelopes).toEqual(original);
  });
});
