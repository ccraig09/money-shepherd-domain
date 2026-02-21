import type { Transaction } from "@money-shepherd/domain";

/**
 * Content fingerprint for a transaction: accountId|postedAt|amount.cents.
 * Used to detect the same real transaction across Plaid reconnects
 * (where the plaid-tx-* ID changes but the content is identical).
 */
function fingerprint(t: Transaction): string {
  return `${t.accountId}|${t.postedAt}|${t.amount.cents}`;
}

/**
 * Merges incoming transactions into an existing list, deduplicating by:
 * 1. Primary: exact id match
 * 2. Secondary: content fingerprint (accountId|postedAt|amount) for plaid-tx-* transactions
 *
 * Returns a new array sorted by postedAt descending (newest first).
 * Idempotent: merging the same batch multiple times produces the same result.
 */
export function mergeTransactions(
  existing: Transaction[],
  incoming: Transaction[]
): Transaction[] {
  const existingIds = new Set(existing.map((t) => t.id));
  const existingFingerprints = new Set(existing.map(fingerprint));

  const newOnly = incoming.filter((t) => {
    if (existingIds.has(t.id)) return false;
    // Secondary dedup: only for Plaid transactions
    if (t.id.startsWith("plaid-tx-") && existingFingerprints.has(fingerprint(t))) {
      return false;
    }
    return true;
  });

  return [...existing, ...newOnly].sort(
    (a, b) => b.postedAt.localeCompare(a.postedAt)
  );
}
