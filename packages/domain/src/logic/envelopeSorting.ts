import type { Envelope } from "../models/Envelope";

/**
 * Sorts envelopes with giving envelopes first, then the rest.
 * Within each group, envelopes are sorted alphabetically by name.
 * Does not mutate the original array.
 */
export function sortEnvelopesGivingFirst(envelopes: Envelope[]): Envelope[] {
  return [...envelopes].sort((a, b) => {
    const aIsGiving = a.type === "giving";
    const bIsGiving = b.type === "giving";

    if (aIsGiving && !bIsGiving) return -1;
    if (!aIsGiving && bIsGiving) return 1;

    return a.name.localeCompare(b.name);
  });
}
