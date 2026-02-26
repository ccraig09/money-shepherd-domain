import { detectRecurring } from "../src";
import type { RecurringPattern } from "../src";

type HistoryEntry = {
  normalizedPayee: string;
  envelopeId: string;
  amountCents: number;
  postedAt: string;
};

function makeEntry(
  payee: string,
  envelopeId: string,
  amountCents: number,
  postedAt: string,
): HistoryEntry {
  return { normalizedPayee: payee, envelopeId, amountCents, postedAt };
}

describe("detectRecurring", () => {
  it("detects monthly recurring pattern with 3 occurrences", () => {
    const history: HistoryEntry[] = [
      makeEntry("netflix", "env-subs", -1599, "2026-01-15"),
      makeEntry("netflix", "env-subs", -1599, "2025-12-15"),
      makeEntry("netflix", "env-subs", -1599, "2025-11-15"),
    ];

    const patterns = detectRecurring(history);

    expect(patterns).toHaveLength(1);
    expect(patterns[0].normalizedPayee).toBe("netflix");
    expect(patterns[0].envelopeId).toBe("env-subs");
    expect(patterns[0].interval).toBe("monthly");
  });

  it("detects biweekly recurring pattern", () => {
    const history: HistoryEntry[] = [
      makeEntry("gym membership", "env-health", -5000, "2026-02-14"),
      makeEntry("gym membership", "env-health", -5000, "2026-01-31"),
      makeEntry("gym membership", "env-health", -5000, "2026-01-17"),
      makeEntry("gym membership", "env-health", -5000, "2026-01-03"),
    ];

    const patterns = detectRecurring(history);

    expect(patterns).toHaveLength(1);
    expect(patterns[0].interval).toBe("biweekly");
  });

  it("detects weekly recurring pattern", () => {
    const history: HistoryEntry[] = [
      makeEntry("cleaning service", "env-home", -7500, "2026-02-21"),
      makeEntry("cleaning service", "env-home", -7500, "2026-02-14"),
      makeEntry("cleaning service", "env-home", -7500, "2026-02-07"),
      makeEntry("cleaning service", "env-home", -7500, "2026-01-31"),
    ];

    const patterns = detectRecurring(history);

    expect(patterns).toHaveLength(1);
    expect(patterns[0].interval).toBe("weekly");
  });

  it("tolerates amount variation within ±10%", () => {
    const history: HistoryEntry[] = [
      makeEntry("spotify", "env-subs", -999, "2026-01-15"),
      makeEntry("spotify", "env-subs", -1050, "2025-12-15"),
      makeEntry("spotify", "env-subs", -1099, "2025-11-15"),
    ];

    const patterns = detectRecurring(history);

    expect(patterns).toHaveLength(1);
    expect(patterns[0].normalizedPayee).toBe("spotify");
  });

  it("rejects when amount varies more than ±10%", () => {
    const history: HistoryEntry[] = [
      makeEntry("amazon", "env-shopping", -1500, "2026-01-15"),
      makeEntry("amazon", "env-shopping", -8500, "2025-12-15"),
      makeEntry("amazon", "env-shopping", -2200, "2025-11-15"),
    ];

    const patterns = detectRecurring(history);

    expect(patterns).toHaveLength(0);
  });

  it("requires at least 3 occurrences", () => {
    const history: HistoryEntry[] = [
      makeEntry("hulu", "env-subs", -1299, "2026-01-15"),
      makeEntry("hulu", "env-subs", -1299, "2025-12-15"),
    ];

    const patterns = detectRecurring(history);

    expect(patterns).toHaveLength(0);
  });

  it("returns empty array when history is empty", () => {
    const patterns = detectRecurring([]);

    expect(patterns).toEqual([]);
  });

  it("rejects irregular intervals", () => {
    const history: HistoryEntry[] = [
      makeEntry("random store", "env-shopping", -2000, "2026-02-20"),
      makeEntry("random store", "env-shopping", -2000, "2026-01-05"),
      makeEntry("random store", "env-shopping", -2000, "2025-10-10"),
    ];

    const patterns = detectRecurring(history);

    expect(patterns).toHaveLength(0);
  });

  it("uses most recent envelope when payee assigned to different envelopes", () => {
    const history: HistoryEntry[] = [
      makeEntry("netflix", "env-entertainment", -1599, "2026-01-15"),
      makeEntry("netflix", "env-subs", -1599, "2025-12-15"),
      makeEntry("netflix", "env-subs", -1599, "2025-11-15"),
    ];

    const patterns = detectRecurring(history);

    expect(patterns).toHaveLength(1);
    expect(patterns[0].envelopeId).toBe("env-entertainment");
  });

  it("detects multiple recurring patterns from mixed history", () => {
    const history: HistoryEntry[] = [
      makeEntry("netflix", "env-subs", -1599, "2026-01-15"),
      makeEntry("netflix", "env-subs", -1599, "2025-12-15"),
      makeEntry("netflix", "env-subs", -1599, "2025-11-15"),
      makeEntry("spotify", "env-subs", -999, "2026-01-10"),
      makeEntry("spotify", "env-subs", -999, "2025-12-10"),
      makeEntry("spotify", "env-subs", -999, "2025-11-10"),
    ];

    const patterns = detectRecurring(history);

    expect(patterns).toHaveLength(2);
    const payees = patterns.map((p) => p.normalizedPayee).sort();
    expect(payees).toEqual(["netflix", "spotify"]);
  });
});
