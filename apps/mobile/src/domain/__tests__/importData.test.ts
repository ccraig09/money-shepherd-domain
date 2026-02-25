import { validateImport } from "../importData";

const validPayload = {
  stateVersion: 1,
  householdId: "hh-test",
  exportedAt: "2024-06-15T12:00:00.000Z",
  data: {
    version: 1,
    householdId: "hh-test",
    users: [],
    budget: {
      id: "budget-1",
      availableToAssign: { cents: 50000 },
      envelopes: [],
    },
    accounts: [],
    transactions: [],
    inbox: { unassignedTransactionIds: [], assignmentsByTransactionId: {} },
    appliedAccountTransactionIds: [],
    appliedBudgetTransactionIds: [],
    updatedAt: "2024-06-15T12:00:00.000Z",
  },
};

describe("validateImport", () => {
  it("accepts valid export JSON", () => {
    const json = JSON.stringify(validPayload);
    const result = validateImport(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.householdId).toBe("hh-test");
      expect(result.state.budget.availableToAssign.cents).toBe(50000);
    }
  });

  it("rejects invalid JSON", () => {
    const result = validateImport("not json {{{");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/invalid json/i);
    }
  });

  it("rejects missing stateVersion", () => {
    const { stateVersion, ...rest } = validPayload;
    const result = validateImport(JSON.stringify(rest));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/version/i);
    }
  });

  it("rejects unsupported stateVersion", () => {
    const payload = { ...validPayload, stateVersion: 99 };
    const result = validateImport(JSON.stringify(payload));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/version/i);
    }
  });

  it("rejects missing householdId", () => {
    const { householdId, ...rest } = validPayload;
    const result = validateImport(JSON.stringify(rest));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/household/i);
    }
  });

  it("rejects missing data", () => {
    const { data, ...rest } = validPayload;
    const result = validateImport(JSON.stringify(rest));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/data/i);
    }
  });

  it("hydrates Money objects in the returned state", () => {
    const json = JSON.stringify(validPayload);
    const result = validateImport(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.state.budget.availableToAssign.cents).toBe("number");
    }
  });
});
