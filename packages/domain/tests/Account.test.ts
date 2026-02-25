import { Money } from "../src";
import { Account, AccountType } from "../src/models/Account";
import { applyTransactionToAccount } from "../src/logic/applyTransactionToAccount";

describe("AccountType", () => {
  it("allows depository, credit, loan, and investment types", () => {
    const types: AccountType[] = ["depository", "credit", "loan", "investment"];
    const account: Account = {
      id: "acc-1",
      name: "Checking",
      balance: Money.fromCents(1000),
      accountType: "depository",
    };

    expect(account.accountType).toBe("depository");
    expect(types).toHaveLength(4);
  });

  it("is optional — accounts without accountType are valid", () => {
    const account: Account = {
      id: "acc-1",
      name: "Manual Checking",
      balance: Money.fromCents(500),
    };

    expect(account.accountType).toBeUndefined();
  });

  it("preserves accountType through applyTransactionToAccount", () => {
    const account: Account = {
      id: "acc-1",
      name: "Credit Card",
      balance: Money.fromCents(-3000),
      accountType: "credit",
    };

    const updated = applyTransactionToAccount(account, Money.fromCents(500));

    expect(updated.accountType).toBe("credit");
    expect(updated.balance.cents).toBe(-2500);
  });
});

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
