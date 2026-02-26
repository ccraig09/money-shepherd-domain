import { calculateSnowball } from "../src/logic/snowballCalculator";
import type { DebtInfo, SnowballPlan } from "../src/logic/snowballCalculator";

describe("calculateSnowball", () => {
  test("returns empty plan when no debts provided", () => {
    const result = calculateSnowball([], 0);

    expect(result.payoffOrder).toEqual([]);
    expect(result.totalMonths).toBe(0);
    expect(result.totalInterestCents).toBe(0);
    expect(result.interestSavedCents).toBe(0);
  });

  test("single debt with zero interest pays off in expected months", () => {
    const debts: DebtInfo[] = [
      { id: "d1", name: "Store Card", balanceCents: 100000, minimumPaymentCents: 5000, annualRateBps: 0 },
    ];

    const result = calculateSnowball(debts, 0);

    // $1,000 balance / $50 min payment = 20 months
    expect(result.totalMonths).toBe(20);
    expect(result.totalInterestCents).toBe(0);
    expect(result.payoffOrder).toHaveLength(1);
    expect(result.payoffOrder[0].id).toBe("d1");
    expect(result.payoffOrder[0].payoffMonth).toBe(20);
  });

  test("single debt with interest accrues interest over time", () => {
    const debts: DebtInfo[] = [
      // $1,000 at 12% APR (1200 bps), $100/mo minimum
      { id: "d1", name: "Card", balanceCents: 100000, minimumPaymentCents: 10000, annualRateBps: 1200 },
    ];

    const result = calculateSnowball(debts, 0);

    // With 1% monthly interest on $1,000, paying $100/mo should take ~11 months
    expect(result.totalMonths).toBeGreaterThan(10);
    expect(result.totalMonths).toBeLessThan(13);
    expect(result.totalInterestCents).toBeGreaterThan(0);
  });

  test("snowball orders debts smallest balance first", () => {
    const debts: DebtInfo[] = [
      { id: "big", name: "Car Loan", balanceCents: 500000, minimumPaymentCents: 10000, annualRateBps: 0 },
      { id: "small", name: "Store Card", balanceCents: 50000, minimumPaymentCents: 2500, annualRateBps: 0 },
      { id: "mid", name: "Credit Card", balanceCents: 200000, minimumPaymentCents: 5000, annualRateBps: 0 },
    ];

    const result = calculateSnowball(debts, 0);

    expect(result.payoffOrder[0].id).toBe("small");
    expect(result.payoffOrder[1].id).toBe("mid");
    expect(result.payoffOrder[2].id).toBe("big");
    // small pays off first
    expect(result.payoffOrder[0].payoffMonth).toBeLessThan(result.payoffOrder[1].payoffMonth);
  });

  test("extra payment accelerates payoff", () => {
    const debts: DebtInfo[] = [
      { id: "d1", name: "Card", balanceCents: 100000, minimumPaymentCents: 5000, annualRateBps: 0 },
    ];

    const withoutExtra = calculateSnowball(debts, 0);
    const withExtra = calculateSnowball(debts, 5000); // extra $50/mo

    // $1,000 / $50 = 20 months vs $1,000 / $100 = 10 months
    expect(withExtra.totalMonths).toBeLessThan(withoutExtra.totalMonths);
    expect(withExtra.totalMonths).toBe(10);
  });

  test("rolled-over minimums snowball into next debt", () => {
    const debts: DebtInfo[] = [
      { id: "small", name: "Store", balanceCents: 10000, minimumPaymentCents: 5000, annualRateBps: 0 },
      { id: "big", name: "Card", balanceCents: 100000, minimumPaymentCents: 5000, annualRateBps: 0 },
    ];

    const result = calculateSnowball(debts, 0);

    // small: $100 / $50 = 2 months
    expect(result.payoffOrder[0].id).toBe("small");
    expect(result.payoffOrder[0].payoffMonth).toBe(2);
    // big: after month 2, $50 min rolls into big → $100/mo on remaining $90,000
    // $900 / $100 = 9 more months → month 11
    expect(result.payoffOrder[1].id).toBe("big");
    expect(result.payoffOrder[1].payoffMonth).toBe(11);
  });

  test("skips debts with zero balance", () => {
    const debts: DebtInfo[] = [
      { id: "paid", name: "Paid Off", balanceCents: 0, minimumPaymentCents: 5000, annualRateBps: 1200 },
      { id: "active", name: "Active", balanceCents: 50000, minimumPaymentCents: 5000, annualRateBps: 0 },
    ];

    const result = calculateSnowball(debts, 0);

    expect(result.payoffOrder).toHaveLength(1);
    expect(result.payoffOrder[0].id).toBe("active");
  });

  test("calculates interest saved vs minimum-only strategy", () => {
    const debts: DebtInfo[] = [
      { id: "small", name: "Store", balanceCents: 50000, minimumPaymentCents: 5000, annualRateBps: 2400 },
      { id: "big", name: "Card", balanceCents: 200000, minimumPaymentCents: 5000, annualRateBps: 1800 },
    ];

    // With $50 extra, snowball should save interest vs just paying minimums
    const result = calculateSnowball(debts, 5000);

    expect(result.interestSavedCents).toBeGreaterThan(0);
    expect(result.totalInterestCents).toBeGreaterThan(0);
  });

  test("handles very large extra payment that exceeds total minimums", () => {
    const debts: DebtInfo[] = [
      { id: "d1", name: "Card", balanceCents: 100000, minimumPaymentCents: 5000, annualRateBps: 0 },
    ];

    // Extra payment of $200 on top of $50 min → $250/mo
    const result = calculateSnowball(debts, 20000);

    // $1,000 / $250 = 4 months
    expect(result.totalMonths).toBe(4);
  });

  test("caps simulation at 360 months to prevent infinite loops", () => {
    const debts: DebtInfo[] = [
      // Minimum payment barely covers interest → would take very long
      { id: "d1", name: "Trap", balanceCents: 10000000, minimumPaymentCents: 100, annualRateBps: 2400 },
    ];

    const result = calculateSnowball(debts, 0);

    expect(result.totalMonths).toBeLessThanOrEqual(360);
  });

  test("each debt in payoff order includes interest paid", () => {
    const debts: DebtInfo[] = [
      { id: "d1", name: "Card", balanceCents: 100000, minimumPaymentCents: 10000, annualRateBps: 1200 },
    ];

    const result = calculateSnowball(debts, 0);

    expect(result.payoffOrder[0].interestPaidCents).toBeGreaterThan(0);
    expect(result.payoffOrder[0].interestPaidCents).toBe(result.totalInterestCents);
  });
});
