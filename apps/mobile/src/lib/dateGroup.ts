/**
 * Groups items by date for SectionList rendering.
 * Returns "Today", "Yesterday", or a formatted date string.
 */

function startOfDay(date: Date): string {
  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export function formatDateLabel(iso: string, now: Date = new Date()): string {
  const today = startOfDay(now);
  const yesterday = startOfDay(new Date(now.getTime() - 86_400_000));
  const dateKey = iso.slice(0, 10);

  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";

  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateKey;
  }
}

type HasPostedAt = { postedAt: string };

export type DateSection<T extends HasPostedAt> = {
  title: string;
  data: T[];
};

/** Groups already-sorted (newest-first) items into date sections. */
export function groupByDate<T extends HasPostedAt>(items: T[]): DateSection<T>[] {
  const now = new Date();
  const sections: DateSection<T>[] = [];
  let current: DateSection<T> | null = null;

  for (const item of items) {
    const label = formatDateLabel(item.postedAt, now);
    if (!current || current.title !== label) {
      current = { title: label, data: [] };
      sections.push(current);
    }
    current.data.push(item);
  }

  return sections;
}
