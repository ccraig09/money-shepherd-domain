import { Money } from "@money-shepherd/domain";
import type { AppStateV1 } from "../appState";
import { hasDuplicateAccounts, deduplicateAccounts } from "../commands";

function makeState(overrides?: Partial<AppStateV1>): AppStateV1 {
  return {
    version: 1,
    householdId: "hh-1",
    users: [],
    budget: {
      id: "budget-1",
      availableToAssign: Money.zero(),
      envelopes: [],
    },
    accounts: [],
    transactions: [],
    inbox: { unassignedTransactionIds: [], assignmentsByTransactionId: {} },
    appliedAccountTransactionIds: [],
    appliedBudgetTransactionIds: [],
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("hasDuplicateAccounts", () => {
  it("returns false when no accounts", () => {
    expect(hasDuplicateAccounts(makeState())).toBe(false);
  });

  it("returns false when no duplicates", () => {
    const state = makeState({
      accounts: [
        { id: "plaid-1", name: "Checking", balance: Money.zero(), ownerUserId: "user-los" },
        { id: "plaid-2", name: "Savings", balance: Money.zero(), ownerUserId: "user-los" },
      ],
    });
    expect(hasDuplicateAccounts(state)).toBe(false);
  });

  it("returns true when duplicate Plaid accounts exist (same name + owner)", () => {
    const state = makeState({
      accounts: [
        { id: "plaid-1", name: "Share Savings", balance: Money.zero(), ownerUserId: "user-los" },
        { id: "plaid-2", name: "Share Savings", balance: Money.zero(), ownerUserId: "user-los" },
      ],
    });
    expect(hasDuplicateAccounts(state)).toBe(true);
  });

  it("returns false when same name but different owner", () => {
    const state = makeState({
      accounts: [
        { id: "plaid-1", name: "Share Savings", balance: Money.zero(), ownerUserId: "user-los" },
        { id: "plaid-2", name: "Share Savings", balance: Money.zero(), ownerUserId: "user-jackia" },
      ],
    });
    expect(hasDuplicateAccounts(state)).toBe(false);
  });

  it("ignores non-Plaid (manual) accounts", () => {
    const state = makeState({
      accounts: [
        { id: "acct-1", name: "Cash", balance: Money.zero() },
        { id: "acct-2", name: "Cash", balance: Money.zero() },
      ],
    });
    expect(hasDuplicateAccounts(state)).toBe(false);
  });
});

describe("deduplicateAccounts", () => {
  it("returns unchanged state when no duplicates", () => {
    const state = makeState({
      accounts: [
        { id: "plaid-1", name: "Checking", balance: Money.zero(), ownerUserId: "user-los" },
      ],
    });
    const result = deduplicateAccounts(state);
    expect(result.removedCount).toBe(0);
    expect(result.state).toBe(state); // exact same reference
  });

  it("removes duplicate, keeps account with most transaction refs", () => {
    const state = makeState({
      accounts: [
        { id: "plaid-1", name: "Share Savings", balance: Money.fromCents(500), ownerUserId: "user-los" },
        { id: "plaid-2", name: "Share Savings", balance: Money.fromCents(500), ownerUserId: "user-los" },
        { id: "plaid-3", name: "Share Savings", balance: Money.fromCents(500), ownerUserId: "user-los" },
      ],
      transactions: [
        { id: "tx-1", postedAt: "2024-01-01", description: "A", amount: Money.fromCents(-100), accountId: "plaid-2" },
        { id: "tx-2", postedAt: "2024-01-02", description: "B", amount: Money.fromCents(-200), accountId: "plaid-2" },
        { id: "tx-3", postedAt: "2024-01-03", description: "C", amount: Money.fromCents(-50), accountId: "plaid-1" },
      ],
    });

    const result = deduplicateAccounts(state);
    expect(result.removedCount).toBe(2);
    // plaid-2 kept (2 tx refs), plaid-1 and plaid-3 removed
    expect(result.state.accounts.map((a) => a.id)).toContain("plaid-2");
    expect(result.state.accounts.map((a) => a.id)).not.toContain("plaid-1");
    expect(result.state.accounts.map((a) => a.id)).not.toContain("plaid-3");
  });

  it("reparents transactions from removed account to keeper", () => {
    const state = makeState({
      accounts: [
        { id: "plaid-1", name: "Share Savings", balance: Money.fromCents(500), ownerUserId: "user-los" },
        { id: "plaid-2", name: "Share Savings", balance: Money.fromCents(500), ownerUserId: "user-los" },
      ],
      transactions: [
        { id: "tx-1", postedAt: "2024-01-01", description: "A", amount: Money.fromCents(-100), accountId: "plaid-1" },
        { id: "tx-2", postedAt: "2024-01-02", description: "B", amount: Money.fromCents(-200), accountId: "plaid-2" },
        { id: "tx-3", postedAt: "2024-01-03", description: "C", amount: Money.fromCents(-50), accountId: "plaid-2" },
      ],
    });

    const result = deduplicateAccounts(state);
    // plaid-2 kept (2 refs), plaid-1 removed (1 ref)
    // tx-1 should be reparented to plaid-2
    const reparented = result.state.transactions.find((t) => t.id === "tx-1");
    expect(reparented?.accountId).toBe("plaid-2");
  });

  it("updates seededAccountIds when duplicate was seeded", () => {
    const state = makeState({
      accounts: [
        { id: "plaid-1", name: "Share Savings", balance: Money.fromCents(500), ownerUserId: "user-los" },
        { id: "plaid-2", name: "Share Savings", balance: Money.fromCents(500), ownerUserId: "user-los" },
      ],
      transactions: [
        { id: "tx-1", postedAt: "2024-01-01", description: "A", amount: Money.fromCents(-100), accountId: "plaid-2" },
      ],
      seededAccountIds: ["plaid-1", "plaid-2"],
    });

    const result = deduplicateAccounts(state);
    // plaid-2 kept, plaid-1 removed → seededAccountIds should contain plaid-2 only (no dupe)
    expect(result.state.seededAccountIds).toContain("plaid-2");
    expect(result.state.seededAccountIds).not.toContain("plaid-1");
  });

  it("preserves non-Plaid accounts untouched", () => {
    const state = makeState({
      accounts: [
        { id: "acct-manual", name: "Cash", balance: Money.fromCents(1000) },
        { id: "plaid-1", name: "Checking", balance: Money.fromCents(500), ownerUserId: "user-los" },
        { id: "plaid-2", name: "Checking", balance: Money.fromCents(500), ownerUserId: "user-los" },
      ],
      transactions: [],
    });

    const result = deduplicateAccounts(state);
    expect(result.removedCount).toBe(1);
    expect(result.state.accounts.find((a) => a.id === "acct-manual")).toBeDefined();
  });

  it("is idempotent — running twice yields same result", () => {
    const state = makeState({
      accounts: [
        { id: "plaid-1", name: "Share Savings", balance: Money.fromCents(500), ownerUserId: "user-los" },
        { id: "plaid-2", name: "Share Savings", balance: Money.fromCents(500), ownerUserId: "user-los" },
      ],
      transactions: [],
    });

    const first = deduplicateAccounts(state);
    const second = deduplicateAccounts(first.state);
    expect(second.removedCount).toBe(0);
    expect(second.state.accounts.length).toBe(first.state.accounts.length);
  });
});
