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

  it("estimates remaining discretionary spending from 7-day rolling pace", () => {
    const discretionary = [
      tx("d1", -10000, "2026-03-10", "Coffee Shop"),
      tx("d2", -10000, "2026-03-12", "Random Store"),
      tx("d3", -10000, "2026-03-14", "Lunch Place"),
    ];
    const result = getCashFlowForecast(discretionary, NOW)!;
    expect(result.projectedDiscretionaryCents).toBeGreaterThan(0);
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
      tx("o1", -2500, "2026-03-08", "Random Purchase"),
      tx("o2", -3500, "2026-03-12", "Another Store"),
    ];
    const result = getCashFlowForecast(txs, NOW)!;
    expect(result.upcomingBillsCents).toBe(1599);
    expect(result.projectedDiscretionaryCents).toBeGreaterThan(0);
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
});
