import { Money } from "../src";
import { Account } from "../src/models/Account";
import { Transaction } from "../src/models/Transaction";
import { applyTransactionsToAccounts } from "../src/logic/applyTransactionsToAccounts";

describe("Ledger - applyTransactionsToAccounts", () => {
  it("applies transactions to the correct account balances", () => {
    const accounts: Account[] = [
      { id: "acc-1", name: "SoFi", balance: Money.fromCents(1000) },
      { id: "acc-2", name: "Navy Fed", balance: Money.fromCents(2000) },
    ];

    const txs: Transaction[] = [
      {
        id: "tx-1",
        accountId: "acc-1",
        amount: Money.fromCents(-200),
        description: "Coffee",
        postedAt: "2026-02-11T00:00:00.000Z",
      },
      {
        id: "tx-2",
        accountId: "acc-2",
        amount: Money.fromCents(500),
        description: "Transfer in",
        postedAt: "2026-02-11T00:00:00.000Z",
      },
    ];

    const result = applyTransactionsToAccounts(accounts, txs);

    const acc1 = result.accounts.find((a) => a.id === "acc-1")!;
    const acc2 = result.accounts.find((a) => a.id === "acc-2")!;

    expect(acc1.balance.cents).toBe(800);
    expect(acc2.balance.cents).toBe(2500);
  });

  it("is idempotent by transaction id (does not double-apply)", () => {
    const accounts: Account[] = [
      { id: "acc-1", name: "SoFi", balance: Money.fromCents(1000) },
    ];

    const tx: Transaction = {
      id: "tx-1",
      accountId: "acc-1",
      amount: Money.fromCents(-100),
      description: "Snack",
      postedAt: "2026-02-11T00:00:00.000Z",
    };

    const first = applyTransactionsToAccounts(accounts, [tx]);
    const second = applyTransactionsToAccounts(
      first.accounts,
      [tx],
      first.appliedTransactionIds,
    );

    const acc1 = second.accounts.find((a) => a.id === "acc-1")!;
    expect(acc1.balance.cents).toBe(900); // only applied once
  });

  it("ignores transactions for unknown accounts (for now)", () => {
    const accounts: Account[] = [
      { id: "acc-1", name: "SoFi", balance: Money.fromCents(1000) },
    ];

    const txs: Transaction[] = [
      {
        id: "tx-unknown",
        accountId: "acc-999",
        amount: Money.fromCents(-500),
        description: "Should be ignored",
        postedAt: "2026-02-11T00:00:00.000Z",
      },
    ];

    const result = applyTransactionsToAccounts(accounts, txs);
    const acc1 = result.accounts.find((a) => a.id === "acc-1")!;
    expect(acc1.balance.cents).toBe(1000);
  });
});
