export type DebtInfo = {
  id: string;
  name: string;
  /** Outstanding balance in cents */
  balanceCents: number;
  /** Monthly minimum payment in cents */
  minimumPaymentCents: number;
  /** Annual interest rate in basis points (e.g. 1800 = 18.00%) */
  annualRateBps: number;
};

export type DebtPayoff = {
  id: string;
  name: string;
  /** Month number when this debt reaches zero */
  payoffMonth: number;
  /** Total interest paid on this debt in cents */
  interestPaidCents: number;
};

export type SnowballPlan = {
  payoffOrder: DebtPayoff[];
  totalMonths: number;
  totalInterestCents: number;
  /** Interest saved compared to minimum-only payments (no snowball rollover) */
  interestSavedCents: number;
};

const MAX_MONTHS = 360;

/**
 * Calculates a debt snowball payoff plan.
 *
 * Snowball method: pay minimums on all debts, apply extra to
 * the smallest balance first. When a debt is paid off, roll
 * its minimum into the next smallest.
 */
export function calculateSnowball(
  debts: DebtInfo[],
  extraMonthlyPaymentCents: number,
): SnowballPlan {
  const active = debts.filter((d) => d.balanceCents > 0);
  if (active.length === 0) {
    return { payoffOrder: [], totalMonths: 0, totalInterestCents: 0, interestSavedCents: 0 };
  }

  const snowballResult = simulate(active, extraMonthlyPaymentCents, true);
  const minimumOnlyResult = simulate(active, extraMonthlyPaymentCents, false);

  const interestSaved = minimumOnlyResult.totalInterestCents - snowballResult.totalInterestCents;

  return {
    payoffOrder: snowballResult.payoffOrder,
    totalMonths: snowballResult.totalMonths,
    totalInterestCents: snowballResult.totalInterestCents,
    interestSavedCents: Math.max(0, interestSaved),
  };
}

type SimResult = {
  payoffOrder: DebtPayoff[];
  totalMonths: number;
  totalInterestCents: number;
};

function simulate(
  debts: DebtInfo[],
  extraCents: number,
  snowball: boolean,
): SimResult {
  // Sort by balance ascending (snowball order)
  const sorted = [...debts].sort((a, b) => a.balanceCents - b.balanceCents);

  const balances = sorted.map((d) => d.balanceCents);
  const minimums = sorted.map((d) => d.minimumPaymentCents);
  const monthlyRates = sorted.map((d) => d.annualRateBps / 12 / 10000);
  const interestAccum = sorted.map(() => 0);
  const payoffMonths = sorted.map(() => 0);
  const paidOff = sorted.map(() => false);

  let month = 0;
  let rolledOverCents = 0;

  while (month < MAX_MONTHS && balances.some((b, i) => !paidOff[i] && b > 0)) {
    month++;

    // Accrue interest
    for (let i = 0; i < sorted.length; i++) {
      if (paidOff[i]) continue;
      const interest = Math.round(balances[i] * monthlyRates[i]);
      balances[i] += interest;
      interestAccum[i] += interest;
    }

    // Determine extra allocation
    let availableExtra = extraCents + (snowball ? rolledOverCents : 0);

    // Pay minimums first
    for (let i = 0; i < sorted.length; i++) {
      if (paidOff[i]) continue;
      const payment = Math.min(minimums[i], balances[i]);
      balances[i] -= payment;
      if (balances[i] <= 0) {
        balances[i] = 0;
        paidOff[i] = true;
        payoffMonths[i] = month;
        rolledOverCents += minimums[i];
      }
    }

    // Apply extra to smallest unpaid (snowball target)
    for (let i = 0; i < sorted.length; i++) {
      if (paidOff[i] || availableExtra <= 0) continue;
      const payment = Math.min(availableExtra, balances[i]);
      balances[i] -= payment;
      availableExtra -= payment;
      if (balances[i] <= 0) {
        balances[i] = 0;
        paidOff[i] = true;
        payoffMonths[i] = month;
        rolledOverCents += minimums[i];
      }
    }
  }

  // Mark any unpaid debts at MAX_MONTHS
  for (let i = 0; i < sorted.length; i++) {
    if (!paidOff[i]) payoffMonths[i] = MAX_MONTHS;
  }

  const payoffOrder: DebtPayoff[] = sorted.map((d, i) => ({
    id: d.id,
    name: d.name,
    payoffMonth: payoffMonths[i],
    interestPaidCents: interestAccum[i],
  }));

  // Sort by payoff month, then by original balance for ties
  payoffOrder.sort((a, b) => a.payoffMonth - b.payoffMonth);

  const totalMonths = Math.max(...payoffMonths);
  const totalInterestCents = interestAccum.reduce((sum, v) => sum + v, 0);

  return { payoffOrder, totalMonths, totalInterestCents };
}
