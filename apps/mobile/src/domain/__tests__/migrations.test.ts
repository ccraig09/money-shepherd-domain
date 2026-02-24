import { runMigrations, migrations } from "../migrations";
import type { Migration } from "../migrations";

const MINIMAL_V1 = {
  version: 1,
  householdId: "test-household",
  users: [],
  budget: { id: "b1", availableToAssign: 0, envelopes: [] },
  accounts: [],
  transactions: [],
  inbox: { unassignedTransactionIds: [], assignmentsByTransactionId: {} },
  appliedAccountTransactionIds: [],
  appliedBudgetTransactionIds: [],
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("runMigrations", () => {
  it("passes V1 state through unchanged when no migrations exist", () => {
    const result = runMigrations({ ...MINIMAL_V1 });
    expect(result.version).toBe(1);
    expect(result.householdId).toBe("test-household");
  });

  it("defaults missing version field to 1", () => {
    const { version: _v, ...noVersion } = MINIMAL_V1;
    const result = runMigrations(noVersion);
    expect(result.version).toBe(1);
  });

  it("applies a migration when fromVersion matches", () => {
    const mockMigration: Migration = {
      fromVersion: 1,
      toVersion: 2,
      migrate: (state) => ({ ...state, newField: "added" }),
    };

    // Temporarily add a migration
    migrations.push(mockMigration);
    try {
      const result = runMigrations({ ...MINIMAL_V1 });
      expect(result.version).toBe(2);
      expect(result.newField).toBe("added");
    } finally {
      migrations.pop();
    }
  });

  it("applies multiple migrations in sequence", () => {
    const m1: Migration = {
      fromVersion: 1,
      toVersion: 2,
      migrate: (state) => ({ ...state, step1: true }),
    };
    const m2: Migration = {
      fromVersion: 2,
      toVersion: 3,
      migrate: (state) => ({ ...state, step2: true }),
    };

    migrations.push(m1, m2);
    try {
      const result = runMigrations({ ...MINIMAL_V1 });
      expect(result.version).toBe(3);
      expect(result.step1).toBe(true);
      expect(result.step2).toBe(true);
    } finally {
      migrations.pop();
      migrations.pop();
    }
  });

  it("skips migrations that don't match the current version", () => {
    const futureOnly: Migration = {
      fromVersion: 5,
      toVersion: 6,
      migrate: (state) => ({ ...state, shouldNotRun: true }),
    };

    migrations.push(futureOnly);
    try {
      const result = runMigrations({ ...MINIMAL_V1 });
      expect(result.version).toBe(1);
      expect(result.shouldNotRun).toBeUndefined();
    } finally {
      migrations.pop();
    }
  });

  it("does not mutate the input object", () => {
    const input = { ...MINIMAL_V1 };
    const frozen = JSON.stringify(input);
    runMigrations(input);
    expect(JSON.stringify(input)).toBe(frozen);
  });
});

describe("migrations registry", () => {
  it("is ordered by fromVersion (ascending)", () => {
    for (let i = 1; i < migrations.length; i++) {
      expect(migrations[i].fromVersion).toBeGreaterThanOrEqual(
        migrations[i - 1].fromVersion,
      );
    }
  });

  it("forms a contiguous chain with no version gaps", () => {
    for (let i = 1; i < migrations.length; i++) {
      expect(migrations[i].fromVersion).toBe(migrations[i - 1].toVersion);
    }
  });
});
