export type RecurringPattern = {
  normalizedPayee: string;
  envelopeId: string;
  interval: "weekly" | "biweekly" | "monthly";
};

type HistoryEntry = {
  normalizedPayee: string;
  envelopeId: string;
  amountCents: number;
  postedAt: string;
};

const MIN_OCCURRENCES = 3;
const AMOUNT_TOLERANCE = 0.10;

const WEEKLY_DAYS = 7;
const BIWEEKLY_DAYS = 14;
const MONTHLY_DAYS = 30;

const INTERVAL_TOLERANCE = 0.30;

export function detectRecurring(history: HistoryEntry[]): RecurringPattern[] {
  if (history.length < MIN_OCCURRENCES) return [];

  const grouped = groupByPayee(history);
  const patterns: RecurringPattern[] = [];

  for (const [payee, entries] of grouped) {
    if (entries.length < MIN_OCCURRENCES) continue;

    const sorted = [...entries].sort(
      (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
    );

    if (!hasConsistentAmounts(sorted)) continue;

    const interval = detectInterval(sorted);
    if (!interval) continue;

    const envelopeId = sorted[0].envelopeId;

    patterns.push({ normalizedPayee: payee, envelopeId, interval });
  }

  return patterns;
}

function groupByPayee(entries: HistoryEntry[]): Map<string, HistoryEntry[]> {
  const map = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const key = entry.normalizedPayee;
    const list = map.get(key);
    if (list) {
      list.push(entry);
    } else {
      map.set(key, [entry]);
    }
  }
  return map;
}

function hasConsistentAmounts(sorted: HistoryEntry[]): boolean {
  const amounts = sorted.map((e) => Math.abs(e.amountCents));
  const avg = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
  if (avg === 0) return false;

  return amounts.every(
    (a) => Math.abs(a - avg) / avg <= AMOUNT_TOLERANCE,
  );
}

function detectInterval(
  sorted: HistoryEntry[],
): "weekly" | "biweekly" | "monthly" | null {
  const gaps: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = new Date(sorted[i].postedAt).getTime();
    const previous = new Date(sorted[i + 1].postedAt).getTime();
    const daysDiff = (current - previous) / (1000 * 60 * 60 * 24);
    gaps.push(daysDiff);
  }

  const avgGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;

  const candidates: { interval: "weekly" | "biweekly" | "monthly"; target: number }[] = [
    { interval: "weekly", target: WEEKLY_DAYS },
    { interval: "biweekly", target: BIWEEKLY_DAYS },
    { interval: "monthly", target: MONTHLY_DAYS },
  ];

  for (const { interval, target } of candidates) {
    const allMatch = gaps.every(
      (g) => Math.abs(g - target) / target <= INTERVAL_TOLERANCE,
    );
    if (allMatch && Math.abs(avgGap - target) / target <= INTERVAL_TOLERANCE) {
      return interval;
    }
  }

  return null;
}
