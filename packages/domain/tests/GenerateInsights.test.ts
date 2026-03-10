import { generateInsights, Money } from "../src";

function makeEnvelope(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? "env-1",
    name: overrides.name ?? "Groceries",
    balance: overrides.balance ?? Money.fromCents(5000),
    goal: overrides.goal,
    target: overrides.target,
    type: overrides.type ?? "spending",
  };
}

function makeTx(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? "tx-1",
    accountId: overrides.accountId ?? "acct-1",
    amount: overrides.amount ?? Money.fromCents(-2500),
    description: overrides.description ?? "Store",
    postedAt: overrides.postedAt ?? "2026-02-15T12:00:00Z",
    pending: false,
  };
}

function baseContext(overrides: Partial<Record<string, any>> = {}) {
  return {
    envelopes: overrides.envelopes ?? [],
    transactions: overrides.transactions ?? [],
    assignedTransactionIds: overrides.assignedTransactionIds ?? new Set(),
    availableToAssignCents: overrides.availableToAssignCents ?? 0,
    now: overrides.now ?? "2026-02-15",
    aiTip: overrides.aiTip,
  };
}

describe("generateInsights", () => {
  it("returns empty array when there is nothing to report", () => {
    const result = generateInsights(baseContext());
    expect(result).toEqual([]);
  });

  describe("overspent-envelope", () => {
    it("flags envelopes with negative balance", () => {
      const ctx = baseContext({
        envelopes: [makeEnvelope({ balance: Money.fromCents(-1500), name: "Dining" })],
      });
      const result = generateInsights(ctx);
      const insight = result.find((i) => i.type === "overspent-envelope");
      expect(insight).toBeDefined();
      expect(insight!.severity).toBe("warning");
      expect(insight!.message).toContain("Dining");
      expect(insight!.message).toContain("$15.00");
      expect(insight!.envelopeId).toBe("env-1");
    });

    it("ignores envelopes with zero or positive balance", () => {
      const ctx = baseContext({
        envelopes: [makeEnvelope({ balance: Money.fromCents(0) })],
      });
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "overspent-envelope")).toBeUndefined();
    });
  });

  describe("nearly-depleted", () => {
    it("warns when envelope is over 90% spent relative to goal", () => {
      const ctx = baseContext({
        envelopes: [
          makeEnvelope({
            balance: Money.fromCents(500), // $5 left
            goal: Money.fromCents(10000),  // $100 goal
            name: "Food",
          }),
        ],
        now: "2026-02-15", // mid-month, 13 days left
      });
      const result = generateInsights(ctx);
      const insight = result.find((i) => i.type === "nearly-depleted");
      expect(insight).toBeDefined();
      expect(insight!.severity).toBe("warning");
      expect(insight!.message).toContain("Food");
      expect(insight!.message).toMatch(/\d+ days left/);
    });

    it("does not flag envelopes with no goal", () => {
      const ctx = baseContext({
        envelopes: [makeEnvelope({ balance: Money.fromCents(100) })],
        now: "2026-02-15",
      });
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "nearly-depleted")).toBeUndefined();
    });

    it("does not flag envelopes above 10% remaining", () => {
      const ctx = baseContext({
        envelopes: [
          makeEnvelope({ balance: Money.fromCents(2000), goal: Money.fromCents(10000) }),
        ],
        now: "2026-02-15",
      });
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "nearly-depleted")).toBeUndefined();
    });
  });

  describe("unassigned-transactions", () => {
    it("nudges when there are unassigned expense transactions", () => {
      const txs = [
        makeTx({ id: "tx-1" }),
        makeTx({ id: "tx-2" }),
        makeTx({ id: "tx-3" }),
      ];
      const ctx = baseContext({
        transactions: txs,
        assignedTransactionIds: new Set(["tx-1"]),
      });
      const result = generateInsights(ctx);
      const insight = result.find((i) => i.type === "unassigned-transactions");
      expect(insight).toBeDefined();
      expect(insight!.severity).toBe("info");
      expect(insight!.message).toContain("2");
    });

    it("does not flag when all expenses are assigned", () => {
      const txs = [makeTx({ id: "tx-1" })];
      const ctx = baseContext({
        transactions: txs,
        assignedTransactionIds: new Set(["tx-1"]),
      });
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "unassigned-transactions")).toBeUndefined();
    });

    it("ignores income transactions for unassigned count", () => {
      const txs = [makeTx({ id: "tx-1", amount: Money.fromCents(5000) })]; // income
      const ctx = baseContext({ transactions: txs });
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "unassigned-transactions")).toBeUndefined();
    });
  });

  describe("idle-funds", () => {
    it("nudges when available to assign is positive", () => {
      const ctx = baseContext({ availableToAssignCents: 50000 });
      const result = generateInsights(ctx);
      const insight = result.find((i) => i.type === "idle-funds");
      expect(insight).toBeDefined();
      expect(insight!.severity).toBe("info");
      expect(insight!.message).toContain("$500.00");
    });

    it("does not flag when available is zero or negative", () => {
      const ctx = baseContext({ availableToAssignCents: 0 });
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "idle-funds")).toBeUndefined();
    });
  });

  describe("debt-milestone", () => {
    it("celebrates when debt envelope crosses 25% threshold", () => {
      const ctx = baseContext({
        envelopes: [
          makeEnvelope({
            type: "debt",
            name: "Visa",
            balance: Money.fromCents(30000),  // $300 paid
            target: Money.fromCents(100000),  // $1000 total
          }),
        ],
      });
      const result = generateInsights(ctx);
      const insight = result.find((i) => i.type === "debt-milestone");
      expect(insight).toBeDefined();
      expect(insight!.severity).toBe("success");
      expect(insight!.message).toContain("Visa");
      expect(insight!.message).toContain("30%");
    });

    it("does not flag debt envelopes under 25%", () => {
      const ctx = baseContext({
        envelopes: [
          makeEnvelope({
            type: "debt",
            name: "Visa",
            balance: Money.fromCents(1000),
            target: Money.fromCents(100000),
          }),
        ],
      });
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "debt-milestone")).toBeUndefined();
    });

    it("does not flag debt envelopes without a target", () => {
      const ctx = baseContext({
        envelopes: [makeEnvelope({ type: "debt", name: "Visa" })],
      });
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "debt-milestone")).toBeUndefined();
    });
  });

  describe("positive-net", () => {
    it("encourages when income exceeds spending this month", () => {
      const txs = [
        makeTx({ id: "tx-1", amount: Money.fromCents(500000), postedAt: "2026-02-10T00:00:00Z" }),  // +$5000 income
        makeTx({ id: "tx-2", amount: Money.fromCents(-200000), postedAt: "2026-02-12T00:00:00Z" }), // -$2000 expense
      ];
      const ctx = baseContext({
        transactions: txs,
        now: "2026-02-15",
      });
      const result = generateInsights(ctx);
      const insight = result.find((i) => i.type === "positive-net");
      expect(insight).toBeDefined();
      expect(insight!.severity).toBe("success");
      expect(insight!.message).toContain("$3,000.00");
    });

    it("does not flag when spending exceeds income", () => {
      const txs = [
        makeTx({ id: "tx-1", amount: Money.fromCents(100000), postedAt: "2026-02-10T00:00:00Z" }),
        makeTx({ id: "tx-2", amount: Money.fromCents(-200000), postedAt: "2026-02-12T00:00:00Z" }),
      ];
      const ctx = baseContext({
        transactions: txs,
        now: "2026-02-15",
      });
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "positive-net")).toBeUndefined();
    });

    it("only considers transactions from the current month", () => {
      const txs = [
        makeTx({ id: "tx-1", amount: Money.fromCents(500000), postedAt: "2026-01-10T00:00:00Z" }),  // last month income
        makeTx({ id: "tx-2", amount: Money.fromCents(-200000), postedAt: "2026-02-12T00:00:00Z" }), // this month expense
      ];
      const ctx = baseContext({
        transactions: txs,
        now: "2026-02-15",
      });
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "positive-net")).toBeUndefined();
    });
  });

  describe("ai-tip", () => {
    it("includes AI tip when provided", () => {
      const ctx = baseContext({ aiTip: "Your grocery spending is trending down — great progress!" });
      const result = generateInsights(ctx);
      const insight = result.find((i) => i.type === "ai-tip");
      expect(insight).toBeDefined();
      expect(insight!.severity).toBe("info");
      expect(insight!.message).toBe("Your grocery spending is trending down — great progress!");
    });

    it("does not include AI tip when omitted", () => {
      const ctx = baseContext();
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "ai-tip")).toBeUndefined();
    });

    it("does not include AI tip when empty string", () => {
      const ctx = baseContext({ aiTip: "" });
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "ai-tip")).toBeUndefined();
    });

    it("places AI tip after warnings but before other info insights", () => {
      const ctx = baseContext({
        envelopes: [makeEnvelope({ balance: Money.fromCents(-1500), name: "Dining" })],
        availableToAssignCents: 50000,
        aiTip: "Consider reducing dining out this month.",
      });
      const result = generateInsights(ctx);
      const types = result.map((i) => i.type);
      const warningIdx = types.indexOf("overspent-envelope");
      const aiIdx = types.indexOf("ai-tip");
      const idleIdx = types.indexOf("idle-funds");
      expect(warningIdx).toBeLessThan(aiIdx);
      expect(aiIdx).toBeLessThan(idleIdx);
    });
  });

  describe("unusual-charge", () => {
    it("flags a merchant charge that is >2× the historical average and >$50", () => {
      const txs = [
        // 3 historical charges for "Walmart" in January (~$60 avg)
        makeTx({ id: "tx-1", description: "Walmart", amount: Money.fromCents(-5500), postedAt: "2026-01-05T00:00:00Z" }),
        makeTx({ id: "tx-2", description: "Walmart", amount: Money.fromCents(-6500), postedAt: "2026-01-15T00:00:00Z" }),
        makeTx({ id: "tx-3", description: "Walmart", amount: Money.fromCents(-6000), postedAt: "2026-01-25T00:00:00Z" }),
        // This month: $320 charge (>2× avg and >$50)
        makeTx({ id: "tx-4", description: "Walmart", amount: Money.fromCents(-32000), postedAt: "2026-02-10T00:00:00Z" }),
      ];
      const ctx = baseContext({ transactions: txs, now: "2026-02-15" });
      const result = generateInsights(ctx);
      const insight = result.find((i) => i.type === "unusual-charge");
      expect(insight).toBeDefined();
      expect(insight!.severity).toBe("warning");
      expect(insight!.message).toContain("Walmart");
      expect(insight!.message).toContain("$320.00");
    });

    it("does not flag when charge is below 2× average", () => {
      const txs = [
        makeTx({ id: "tx-1", description: "Walmart", amount: Money.fromCents(-6000), postedAt: "2026-01-05T00:00:00Z" }),
        makeTx({ id: "tx-2", description: "Walmart", amount: Money.fromCents(-6000), postedAt: "2026-01-15T00:00:00Z" }),
        // This month: $100 (1.67× avg, below 2× threshold)
        makeTx({ id: "tx-3", description: "Walmart", amount: Money.fromCents(-10000), postedAt: "2026-02-10T00:00:00Z" }),
      ];
      const ctx = baseContext({ transactions: txs, now: "2026-02-15" });
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "unusual-charge")).toBeUndefined();
    });

    it("does not flag small charges even if ratio is high", () => {
      const txs = [
        // Historical: $2 avg
        makeTx({ id: "tx-1", description: "Coffee", amount: Money.fromCents(-200), postedAt: "2026-01-05T00:00:00Z" }),
        makeTx({ id: "tx-2", description: "Coffee", amount: Money.fromCents(-200), postedAt: "2026-01-15T00:00:00Z" }),
        // This month: $10 (5× avg but only $10 — below $50 threshold)
        makeTx({ id: "tx-3", description: "Coffee", amount: Money.fromCents(-1000), postedAt: "2026-02-10T00:00:00Z" }),
      ];
      const ctx = baseContext({ transactions: txs, now: "2026-02-15" });
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "unusual-charge")).toBeUndefined();
    });

    it("needs at least 2 historical charges to establish a baseline", () => {
      const txs = [
        makeTx({ id: "tx-1", description: "Walmart", amount: Money.fromCents(-6000), postedAt: "2026-01-05T00:00:00Z" }),
        makeTx({ id: "tx-2", description: "Walmart", amount: Money.fromCents(-30000), postedAt: "2026-02-10T00:00:00Z" }),
      ];
      const ctx = baseContext({ transactions: txs, now: "2026-02-15" });
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "unusual-charge")).toBeUndefined();
    });
  });

  describe("spending-spike", () => {
    it("warns when this month's daily pace is >1.5× last month", () => {
      const txs = [
        // Last month (Feb): $1000 total over 28 days = ~$35.71/day
        makeTx({ id: "tx-1", amount: Money.fromCents(-100000), postedAt: "2026-02-15T00:00:00Z" }),
        // This month (Mar): $800 in first 10 days = $80/day (2.24× pace)
        makeTx({ id: "tx-2", amount: Money.fromCents(-80000), postedAt: "2026-03-05T00:00:00Z" }),
      ];
      const ctx = baseContext({ transactions: txs, now: "2026-03-10" });
      const result = generateInsights(ctx);
      const insight = result.find((i) => i.type === "spending-spike");
      expect(insight).toBeDefined();
      expect(insight!.severity).toBe("warning");
      expect(insight!.message).toMatch(/\d+% above last month/);
    });

    it("does not warn when pace is below 1.5×", () => {
      const txs = [
        // Last month: $3000 over 28 days = ~$107/day
        makeTx({ id: "tx-1", amount: Money.fromCents(-300000), postedAt: "2026-02-15T00:00:00Z" }),
        // This month: $1200 in 10 days = $120/day (1.12× — below threshold)
        makeTx({ id: "tx-2", amount: Money.fromCents(-120000), postedAt: "2026-03-05T00:00:00Z" }),
      ];
      const ctx = baseContext({ transactions: txs, now: "2026-03-10" });
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "spending-spike")).toBeUndefined();
    });

    it("does not warn in the first 4 days of the month", () => {
      const txs = [
        makeTx({ id: "tx-1", amount: Money.fromCents(-100000), postedAt: "2026-02-15T00:00:00Z" }),
        makeTx({ id: "tx-2", amount: Money.fromCents(-50000), postedAt: "2026-03-02T00:00:00Z" }),
      ];
      const ctx = baseContext({ transactions: txs, now: "2026-03-03" });
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "spending-spike")).toBeUndefined();
    });

    it("does not warn when there is no last month spending", () => {
      const txs = [
        makeTx({ id: "tx-1", amount: Money.fromCents(-80000), postedAt: "2026-03-05T00:00:00Z" }),
      ];
      const ctx = baseContext({ transactions: txs, now: "2026-03-10" });
      const result = generateInsights(ctx);
      expect(result.find((i) => i.type === "spending-spike")).toBeUndefined();
    });
  });
});
