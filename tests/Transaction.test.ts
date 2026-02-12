import { Money } from "../src";
import { Transaction } from "../src/models/Transaction";

describe("Transaction model", () => {
  it("represents an expense as negative money", () => {
    const tx: Transaction = {
      id: "tx-1",
      accountId: "acc-1",
      amount: Money.fromCents(-500),
      description: "Groceries",
      postedAt: new Date().toISOString(),
    };

    expect(tx.amount.isNegative).toBe(true);
    expect(tx.amount.cents).toBe(-500);
  });

  it("represents income as positive money", () => {
    const tx: Transaction = {
      id: "tx-2",
      accountId: "acc-1",
      amount: Money.fromCents(1500),
      description: "Paycheck",
      postedAt: new Date().toISOString(),
    };

    expect(tx.amount.isPositive).toBe(true);
    expect(tx.amount.cents).toBe(1500);
  });
});
