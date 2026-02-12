import { Money } from "../src";
import { Account } from "../src/models/Account";
import { applyTransactionToAccount } from "../src/logic/applyTransactionToAccount";

describe("Account aggregate", () => {
  it("applies a positive transaction (deposit)", () => {
    const account: Account = {
      id: "acc-1",
      name: "Checking",
      balance: Money.fromCents(1000),
    };

    const updated = applyTransactionToAccount(account, Money.fromCents(500));

    expect(updated.balance.cents).toBe(1500);
  });

  it("applies a negative transaction (withdrawal)", () => {
    const account: Account = {
      id: "acc-1",
      name: "Checking",
      balance: Money.fromCents(1000),
    };

    const updated = applyTransactionToAccount(account, Money.fromCents(-200));

    expect(updated.balance.cents).toBe(800);
  });

  it("does not mutate the original account", () => {
    const account: Account = {
      id: "acc-1",
      name: "Checking",
      balance: Money.fromCents(1000),
    };

    const updated = applyTransactionToAccount(account, Money.fromCents(100));

    expect(account.balance.cents).toBe(1000);
    expect(updated.balance.cents).toBe(1100);
  });
});
