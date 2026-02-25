import { Money } from "@money-shepherd/domain";
import { buildExportPayload } from "../exportData";
import type { AppStateV1 } from "../appState";

function makeState(): AppStateV1 {
  return {
    version: 1,
    householdId: "hh-test",
    users: [{ id: "user-los", displayName: "Los" }],
    budget: {
      id: "budget-1",
      availableToAssign: Money.fromCents(50000),
      envelopes: [
        { id: "env-1", name: "Groceries", balance: Money.fromCents(20000) },
      ],
    },
    accounts: [
      {
        id: "acct-1",
        name: "Checking",
        balance: Money.fromCents(100000),
        plaidAccountId: null,
        institutionName: null,
        mask: "1234",
      } as any,
    ],
    transactions: [],
    inbox: { unassignedTransactionIds: [], assignmentsByTransactionId: {} },
    appliedAccountTransactionIds: [],
    appliedBudgetTransactionIds: [],
    updatedAt: "2024-06-15T12:00:00.000Z",
  };
}

describe("buildExportPayload", () => {
  it("includes stateVersion matching state.version", () => {
    const payload = buildExportPayload(makeState());
    expect(payload.stateVersion).toBe(1);
  });

  it("includes householdId from state", () => {
    const payload = buildExportPayload(makeState());
    expect(payload.householdId).toBe("hh-test");
  });

  it("includes an exportedAt ISO timestamp", () => {
    const before = new Date().toISOString();
    const payload = buildExportPayload(makeState());
    const after = new Date().toISOString();
    expect(payload.exportedAt).toBeDefined();
    expect(payload.exportedAt >= before).toBe(true);
    expect(payload.exportedAt <= after).toBe(true);
  });

  it("includes the full state under data key", () => {
    const state = makeState();
    const payload = buildExportPayload(state);
    expect(payload.data.householdId).toBe("hh-test");
    expect(payload.data.budget.envelopes).toHaveLength(1);
  });

  it("serializes to valid JSON", () => {
    const payload = buildExportPayload(makeState());
    const json = JSON.stringify(payload);
    const parsed = JSON.parse(json);
    expect(parsed.stateVersion).toBe(1);
    expect(parsed.householdId).toBe("hh-test");
  });
});
