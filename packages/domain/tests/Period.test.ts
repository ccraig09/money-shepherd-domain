import { Money } from "../src";
import {
  getCurrentPeriod,
  getPeriodLabel,
  getSpendingInPeriod,
  getFundingInPeriod,
} from "../src/logic/periodHelpers";
import type { BudgetPeriod, Allocation } from "../src/models/BudgetPeriod";
import type { Transaction } from "../src/models/Transaction";
import type { TransactionAssignment } from "../src/models/TransactionAssignment";

describe("getCurrentPeriod", () => {
  test("mid-month returns first and last day of that month", () => {
    const period = getCurrentPeriod("2026-02-15");

    expect(period.startDate).toBe("2026-02-01");
    expect(period.endDate).toBe("2026-02-28");
    expect(period.label).toBe("February 2026");
  });

  test("first day of month returns that month's bounds", () => {
    const period = getCurrentPeriod("2026-01-01");

    expect(period.startDate).toBe("2026-01-01");
    expect(period.endDate).toBe("2026-01-31");
  });

  test("last day of month returns that month's bounds", () => {
    const period = getCurrentPeriod("2026-12-31");

    expect(period.startDate).toBe("2026-12-01");
    expect(period.endDate).toBe("2026-12-31");
  });

  test("leap year February has 29 days", () => {
    const period = getCurrentPeriod("2028-02-10");

    expect(period.endDate).toBe("2028-02-29");
  });

  test("non-leap year February has 28 days", () => {
    const period = getCurrentPeriod("2027-02-10");

    expect(period.endDate).toBe("2027-02-28");
  });
});

describe("getPeriodLabel", () => {
  test("returns the label from the period", () => {
    const period: BudgetPeriod = {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      label: "January 2026",
    };

    expect(getPeriodLabel(period)).toBe("January 2026");
  });
});

describe("getSpendingInPeriod", () => {
  const febPeriod: BudgetPeriod = {
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    label: "February 2026",
  };

  const groceriesId = "env-groceries";

  const makeTx = (
    id: string,
    cents: number,
    postedAt: string,
  ): Transaction => ({
    id,
    accountId: "acc-1",
    amount: Money.fromCents(cents),
    description: "test",
    postedAt,
  });

  const makeAssignment = (
    transactionId: string,
    envelopeId: string,
  ): TransactionAssignment => ({
    transactionId,
    envelopeId,
    assignedByUserId: "user-1",
    assignedAt: "2026-02-15T00:00:00Z",
  });

  test("sums expenses assigned to envelope within period", () => {
    const transactions = [
      makeTx("tx-1", -5000, "2026-02-10"),
      makeTx("tx-2", -3000, "2026-02-20"),
    ];
    const assignments = [
      makeAssignment("tx-1", groceriesId),
      makeAssignment("tx-2", groceriesId),
    ];

    const spent = getSpendingInPeriod(
      transactions,
      assignments,
      groceriesId,
      febPeriod,
    );

    expect(spent.cents).toBe(8000);
  });

  test("ignores transactions outside the period", () => {
    const transactions = [
      makeTx("tx-1", -5000, "2026-01-31"),
      makeTx("tx-2", -3000, "2026-03-01"),
      makeTx("tx-3", -1000, "2026-02-15"),
    ];
    const assignments = [
      makeAssignment("tx-1", groceriesId),
      makeAssignment("tx-2", groceriesId),
      makeAssignment("tx-3", groceriesId),
    ];

    const spent = getSpendingInPeriod(
      transactions,
      assignments,
      groceriesId,
      febPeriod,
    );

    expect(spent.cents).toBe(1000);
  });

  test("ignores transactions assigned to a different envelope", () => {
    const transactions = [
      makeTx("tx-1", -5000, "2026-02-10"),
      makeTx("tx-2", -3000, "2026-02-20"),
    ];
    const assignments = [
      makeAssignment("tx-1", groceriesId),
      makeAssignment("tx-2", "env-other"),
    ];

    const spent = getSpendingInPeriod(
      transactions,
      assignments,
      groceriesId,
      febPeriod,
    );

    expect(spent.cents).toBe(5000);
  });

  test("ignores unassigned transactions", () => {
    const transactions = [makeTx("tx-1", -5000, "2026-02-10")];

    const spent = getSpendingInPeriod(
      transactions,
      [],
      groceriesId,
      febPeriod,
    );

    expect(spent.cents).toBe(0);
  });

  test("ignores income transactions (positive amounts)", () => {
    const transactions = [
      makeTx("tx-1", 10000, "2026-02-10"),
      makeTx("tx-2", -2000, "2026-02-15"),
    ];
    const assignments = [
      makeAssignment("tx-1", groceriesId),
      makeAssignment("tx-2", groceriesId),
    ];

    const spent = getSpendingInPeriod(
      transactions,
      assignments,
      groceriesId,
      febPeriod,
    );

    expect(spent.cents).toBe(2000);
  });

  test("includes transactions on period boundary dates", () => {
    const transactions = [
      makeTx("tx-1", -1000, "2026-02-01"),
      makeTx("tx-2", -2000, "2026-02-28"),
    ];
    const assignments = [
      makeAssignment("tx-1", groceriesId),
      makeAssignment("tx-2", groceriesId),
    ];

    const spent = getSpendingInPeriod(
      transactions,
      assignments,
      groceriesId,
      febPeriod,
    );

    expect(spent.cents).toBe(3000);
  });
});

describe("getFundingInPeriod", () => {
  const febPeriod: BudgetPeriod = {
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    label: "February 2026",
  };

  const groceriesId = "env-groceries";

  const makeAllocation = (
    envelopeId: string,
    cents: number,
    allocatedAt: string,
  ): Allocation => ({
    envelopeId,
    amount: Money.fromCents(cents),
    allocatedAt,
  });

  test("sums allocations to envelope within period", () => {
    const allocations = [
      makeAllocation(groceriesId, 20000, "2026-02-05"),
      makeAllocation(groceriesId, 10000, "2026-02-20"),
    ];

    const funded = getFundingInPeriod(allocations, groceriesId, febPeriod);

    expect(funded.cents).toBe(30000);
  });

  test("ignores allocations outside the period", () => {
    const allocations = [
      makeAllocation(groceriesId, 20000, "2026-01-15"),
      makeAllocation(groceriesId, 10000, "2026-02-10"),
      makeAllocation(groceriesId, 5000, "2026-03-01"),
    ];

    const funded = getFundingInPeriod(allocations, groceriesId, febPeriod);

    expect(funded.cents).toBe(10000);
  });

  test("ignores allocations to a different envelope", () => {
    const allocations = [
      makeAllocation(groceriesId, 20000, "2026-02-05"),
      makeAllocation("env-other", 10000, "2026-02-10"),
    ];

    const funded = getFundingInPeriod(allocations, groceriesId, febPeriod);

    expect(funded.cents).toBe(20000);
  });

  test("returns zero when no allocations match", () => {
    const funded = getFundingInPeriod([], groceriesId, febPeriod);

    expect(funded.cents).toBe(0);
  });
});
