import { formatTimeAgo } from "../timeAgo";

// Fixed "now" for deterministic tests: 2024-06-15T12:00:00Z
const NOW = new Date("2024-06-15T12:00:00.000Z").getTime();

function ago(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatTimeAgo", () => {
  it('returns "just now" for timestamps less than 1 minute ago', () => {
    expect(formatTimeAgo(ago(0), NOW)).toBe("just now");
    expect(formatTimeAgo(ago(30 * SECOND), NOW)).toBe("just now");
    expect(formatTimeAgo(ago(59 * SECOND), NOW)).toBe("just now");
  });

  it('returns "Xm ago" for minutes', () => {
    expect(formatTimeAgo(ago(1 * MINUTE), NOW)).toBe("1m ago");
    expect(formatTimeAgo(ago(2 * MINUTE), NOW)).toBe("2m ago");
    expect(formatTimeAgo(ago(59 * MINUTE), NOW)).toBe("59m ago");
  });

  it('returns "Xh ago" for hours', () => {
    expect(formatTimeAgo(ago(1 * HOUR), NOW)).toBe("1h ago");
    expect(formatTimeAgo(ago(3 * HOUR), NOW)).toBe("3h ago");
    expect(formatTimeAgo(ago(23 * HOUR), NOW)).toBe("23h ago");
  });

  it('returns "Xd ago" for days', () => {
    expect(formatTimeAgo(ago(1 * DAY), NOW)).toBe("1d ago");
    expect(formatTimeAgo(ago(7 * DAY), NOW)).toBe("7d ago");
  });

  it('returns "just now" for future timestamps', () => {
    const future = new Date(NOW + 5 * MINUTE).toISOString();
    expect(formatTimeAgo(future, NOW)).toBe("just now");
  });
});
