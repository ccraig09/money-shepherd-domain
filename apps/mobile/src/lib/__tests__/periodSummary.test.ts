import { Money } from "@money-shepherd/domain";
import type { Transaction, TransactionAssignment, Envelope } from "@money-shepherd/domain";
import { getThisMonthSummary } from "../periodSummary";

const makeTx = (id: string, cents: number, postedAt: string): Transaction => ({
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

describe("getThisMonthSummary", () => {
  const now = "2026-02-15";

  test("computes income, spending, and net for current month", () => {
    const transactions = [
      makeTx("tx-1", 200000, "2026-02-01"), // income $2000
      makeTx("tx-2", -5000, "2026-02-10"),  // expense $50
      makeTx("tx-3", -3000, "2026-02-20"),  // expense $30
    ];

    const result = getThisMonthSummary(transactions, {}, [], now);

    expect(result.incomeCents).toBe(200000);
    expect(result.spendingCents).toBe(8000);
    expect(result.netCents).toBe(192000);
  });

  test("ignores transactions outside the current month", () => {
    const transactions = [
      makeTx("tx-1", 100000, "2026-01-15"), // last month
      makeTx("tx-2", -5000, "2026-03-01"),  // next month
      makeTx("tx-3", -2000, "2026-02-10"),  // this month
    ];

    const result = getThisMonthSummary(transactions, {}, [], now);

    expect(result.incomeCents).toBe(0);
    expect(result.spendingCents).toBe(2000);
    expect(result.netCents).toBe(-2000);
  });

  test("returns zeros when no transactions exist", () => {
    const result = getThisMonthSummary([], {}, [], now);

    expect(result.incomeCents).toBe(0);
    expect(result.spendingCents).toBe(0);
    expect(result.netCents).toBe(0);
  });

  test("computes per-envelope spending for current month", () => {
    const transactions = [
      makeTx("tx-1", -5000, "2026-02-10"),
      makeTx("tx-2", -3000, "2026-02-20"),
      makeTx("tx-3", -1000, "2026-02-25"),
    ];
    const assignments: Record<string, TransactionAssignment> = {
      "tx-1": makeAssignment("tx-1", "env-groceries"),
      "tx-2": makeAssignment("tx-2", "env-groceries"),
      "tx-3": makeAssignment("tx-3", "env-rent"),
    };
    const envelopes: Envelope[] = [
      { id: "env-groceries", name: "Groceries", balance: Money.fromCents(0) },
      { id: "env-rent", name: "Rent", balance: Money.fromCents(0) },
    ];

    const result = getThisMonthSummary(transactions, assignments, envelopes, now);

    expect(result.spentByEnvelope["env-groceries"]).toBe(8000);
    expect(result.spentByEnvelope["env-rent"]).toBe(1000);
  });

  test("envelope with no spending this month gets zero", () => {
    const envelopes: Envelope[] = [
      { id: "env-groceries", name: "Groceries", balance: Money.fromCents(0) },
    ];

    const result = getThisMonthSummary([], {}, envelopes, now);

    expect(result.spentByEnvelope["env-groceries"]).toBe(0);
  });
});
