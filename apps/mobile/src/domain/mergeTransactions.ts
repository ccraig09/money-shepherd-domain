import type { Transaction } from "@money-shepherd/domain";

/**
 * Merges incoming transactions into an existing list, deduplicating by id.
 * Returns a new array sorted by postedAt descending (newest first).
 * Idempotent: merging the same batch multiple times produces the same result.
 */
export function mergeTransactions(
  existing: Transaction[],
  incoming: Transaction[]
): Transaction[] {
  const existingIds = new Set(existing.map((t) => t.id));
  const newOnly = incoming.filter((t) => !existingIds.has(t.id));

  return [...existing, ...newOnly].sort(
    (a, b) => b.postedAt.localeCompare(a.postedAt)
  );
}
