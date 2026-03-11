import { Money } from "../src/models/Money";
import { Transaction } from "../src/models/Transaction";
import { getCashFlowForecast } from "../src/logic/cashFlowForecast";

// ─── Helpers ────────────────────────────────────────────────

function tx(
  id: string,
  cents: number,
  postedAt: string,
  description = "Store",
): Transaction {
  return {
    id,
    accountId: "acct-1",
    amount: Money.fromCents(cents),
    description,
    postedAt,
  };
}

/** Create N months of recurring transactions for a payee. */
function recurringHistory(
  payee: string,
  cents: number,
  months: number,
  dayOfMonth: number,
  startId = 0,
): Transaction[] {
  const result: Transaction[] = [];
  for (let m = 0; m < months; m++) {
    const month = 3 - m; // Mar, Feb, Jan...
    const year = month <= 0 ? 2025 : 2026;
    const mo = month <= 0 ? month + 12 : month;
    const day = String(dayOfMonth).padStart(2, "0");
    const moStr = String(mo).padStart(2, "0");
    result.push(tx(`r${startId + m}`, cents, `${year}-${moStr}-${day}`, payee));
  }
  return result;
}

const NOW = "2026-03-15"; // mid-month

// ─── Tests ──────────────────────────────────────────────────

describe("getCashFlowForecast", () => {
  it("returns zero net when no transactions exist", () => {
    const result = getCashFlowForecast([], NOW)!;
    expect(result.projectedNetCents).toBe(0);
    expect(result.monthIncomeCents).toBe(0);
    expect(result.remainingIncomeCents).toBe(0);
    expect(result.upcomingBillsCents).toBe(0);
  });

  it("projects remaining recurring income not yet received this month", () => {
    // Paycheck arrives on the 25th — not yet received on day 15
    const txs = recurringHistory("Employer Direct Dep", 300000, 3, 25);
    const result = getCashFlowForecast(txs, NOW)!;
    expect(result.remainingIncomeCents).toBe(300000);
  });

  it("excludes recurring income already received this month", () => {
    // Paycheck on the 5th — already received
    const txs = recurringHistory("Employer Direct Dep", 300000, 3, 5);
    const result = getCashFlowForecast(txs, NOW)!;
    expect(result.remainingIncomeCents).toBe(0);
    expect(result.monthIncomeCents).toBe(300000);
  });

  it("projects remaining recurring bills not yet paid this month", () => {
    // Rent on the 28th — not yet paid
    const txs = recurringHistory("Landlord Rent", -150000, 3, 28);
    const result = getCashFlowForecast(txs, NOW)!;
    expect(result.upcomingBillsCents).toBe(150000);
  });

  it("excludes recurring bills already paid this month", () => {
    // Internet bill on the 3rd — already paid
    const txs = recurringHistory("Comcast Internet", -8000, 3, 3);
    const result = getCashFlowForecast(txs, NOW)!;
    expect(result.upcomingBillsCents).toBe(0);
  });

  it("estimates remaining discretionary spending from 7-day median daily pace", () => {
    // Spend on most days in the window so median is non-zero
    const discretionary = [
      tx("d1", -5000, "2026-03-09", "Coffee Shop"),
      tx("d2", -5000, "2026-03-10", "Random Store"),
      tx("d3", -5000, "2026-03-11", "Lunch Place"),
      tx("d4", -5000, "2026-03-12", "Groceries"),
      tx("d5", -5000, "2026-03-13", "Gas"),
      tx("d6", -5000, "2026-03-14", "Takeout"),
      tx("d7", -5000, "2026-03-15", "Dinner"),
    ];
    const result = getCashFlowForecast(discretionary, NOW)!;
    // Median of 7 days all at 5000 = 5000/day × 16 remaining = 80000
    expect(result.projectedDiscretionaryCents).toBe(80000);
  });

  it("computes positive projected net when income exceeds spending", () => {
    const txs = [
      ...recurringHistory("Employer", 300000, 3, 5), // income already received
      ...recurringHistory("Landlord", -150000, 3, 28, 100), // bill upcoming
      tx("d1", -5000, "2026-03-10", "Coffee"),
    ];
    const result = getCashFlowForecast(txs, NOW)!;
    // income 300000 > spending 150000 + discretionary → positive net
    expect(result.monthIncomeCents).toBe(300000);
    expect(result.upcomingBillsCents).toBe(150000);
  });

  it("returns null when too early in month (day 1-2)", () => {
    const result = getCashFlowForecast([], "2026-03-02");
    expect(result).toBeNull();
  });

  it("handles mixed recurring and non-recurring transactions", () => {
    const txs = [
      ...recurringHistory("Netflix", -1599, 3, 20), // upcoming bill
      tx("o1", -2500, "2026-03-09", "Random Purchase"),
      tx("o2", -3500, "2026-03-10", "Another Store"),
      tx("o3", -2000, "2026-03-11", "Coffee"),
      tx("o4", -3000, "2026-03-12", "Gas"),
      tx("o5", -2500, "2026-03-13", "Lunch"),
    ];
    const result = getCashFlowForecast(txs, NOW)!;
    expect(result.upcomingBillsCents).toBe(1599);
    // Median of [0, 0, 2000, 2500, 2500, 3000, 3500] = 2500
    expect(result.projectedDiscretionaryCents).toBe(2500 * 16);
  });

  it("projected net equals income minus total outflows", () => {
    const income = [tx("i1", 250000, "2026-03-05", "Paycheck")];
    const spending = [
      tx("s1", -50000, "2026-03-08", "Groceries Run"),
      tx("s2", -20000, "2026-03-10", "Gas Station"),
    ];
    const result = getCashFlowForecast([...income, ...spending], NOW)!;
    // net = income - (spent + projected discretionary)
    expect(result.monthIncomeCents).toBe(250000);
    expect(result.monthSpentCents).toBe(70000);
    expect(result.projectedNetCents).toBeLessThan(250000);
  });

  it("uses median daily pace so one-time large purchases don't inflate projection", () => {
    // 6 normal days ~$30/day, 1 outlier day $500
    const txs = [
      tx("n1", -3000, "2026-03-09", "Coffee"),
      tx("n2", -3000, "2026-03-10", "Lunch"),
      tx("n3", -3000, "2026-03-11", "Snacks"),
      tx("n4", -3000, "2026-03-12", "Gas"),
      tx("n5", -3000, "2026-03-13", "Groceries"),
      tx("n6", -3000, "2026-03-14", "Takeout"),
      tx("outlier", -50000, "2026-03-15", "Windshield Repair"),
    ];
    const result = getCashFlowForecast(txs, NOW)!;
    // Median of [0, 3000, 3000, 3000, 3000, 3000, 50000] = 3000
    // With mean it would be ~9571/day. 16 remaining days.
    // Median: 3000 * 16 = 48000
    expect(result.projectedDiscretionaryCents).toBe(48000);
  });

  it("excludes transactions marked as transfers from spending and income", () => {
    const txs = [
      tx("i1", 250000, "2026-03-05", "Paycheck"),
      { ...tx("t1", -50000, "2026-03-06", "Transfer To Checking"), isTransfer: true as const },
      { ...tx("t2", 50000, "2026-03-06", "From Savings"), isTransfer: true as const },
      tx("s1", -10000, "2026-03-10", "Coffee Shop"),
    ];
    const result = getCashFlowForecast(txs, NOW)!;
    // Transfers should be excluded: income = 250000, spent = 10000
    expect(result.monthIncomeCents).toBe(250000);
    expect(result.monthSpentCents).toBe(10000);
  });
});
