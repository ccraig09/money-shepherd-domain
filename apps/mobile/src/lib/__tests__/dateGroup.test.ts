import { formatDateLabel, groupByDate } from "../dateGroup";

describe("formatDateLabel", () => {
  // Pin "now" to 2024-06-15T12:00:00Z for deterministic tests
  const now = new Date("2024-06-15T12:00:00.000Z");

  it("returns 'Today' for today's date", () => {
    expect(formatDateLabel("2024-06-15T09:30:00.000Z", now)).toBe("Today");
  });

  it("returns 'Yesterday' for yesterday's date", () => {
    expect(formatDateLabel("2024-06-14T18:00:00.000Z", now)).toBe("Yesterday");
  });

  it("returns formatted date for older dates", () => {
    const label = formatDateLabel("2024-06-10T12:00:00.000Z", now);
    // toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    expect(label).toMatch(/Jun\s+10,?\s+2024/);
  });

  it("returns formatted date for dates in a different month", () => {
    const label = formatDateLabel("2024-01-05T12:00:00.000Z", now);
    expect(label).toMatch(/Jan\s+5,?\s+2024/);
  });
});

describe("groupByDate", () => {
  const now = new Date("2024-06-15T12:00:00.000Z");

  // Freeze Date so groupByDate's internal `new Date()` returns our pinned time
  const RealDate = global.Date;
  beforeAll(() => {
    global.Date = class extends RealDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super("2024-06-15T12:00:00.000Z");
        } else {
          // @ts-ignore
          super(...args);
        }
      }

      static now() {
        return new RealDate("2024-06-15T12:00:00.000Z").getTime();
      }
    } as any;
    // Preserve toLocaleDateString etc.
    Object.setPrototypeOf(global.Date, RealDate);
  });

  afterAll(() => {
    global.Date = RealDate;
  });

  it("returns empty array for empty input", () => {
    expect(groupByDate([])).toEqual([]);
  });

  it("groups items by date with correct section titles", () => {
    const items = [
      { postedAt: "2024-06-15T10:00:00.000Z", id: "a" },
      { postedAt: "2024-06-15T08:00:00.000Z", id: "b" },
      { postedAt: "2024-06-14T20:00:00.000Z", id: "c" },
    ];
    const sections = groupByDate(items);
    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe("Today");
    expect(sections[0].data).toHaveLength(2);
    expect(sections[1].title).toBe("Yesterday");
    expect(sections[1].data).toHaveLength(1);
  });

  it("keeps items within the same section in their original order", () => {
    const items = [
      { postedAt: "2024-06-15T18:00:00.000Z", id: "first" },
      { postedAt: "2024-06-15T06:00:00.000Z", id: "second" },
    ];
    const sections = groupByDate(items);
    expect(sections[0].data[0].id).toBe("first");
    expect(sections[0].data[1].id).toBe("second");
  });

  it("creates a new section when the date changes", () => {
    const items = [
      { postedAt: "2024-06-15T12:00:00.000Z", id: "a" },
      { postedAt: "2024-06-10T12:00:00.000Z", id: "b" },
      { postedAt: "2024-06-10T08:00:00.000Z", id: "c" },
    ];
    const sections = groupByDate(items);
    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe("Today");
    expect(sections[1].data).toHaveLength(2);
  });
});
