import { normalizePayee } from "./normalizePayee";

/** Known BNPL (Buy Now, Pay Later) merchant identifiers after normalization. */
export const BNPL_MERCHANTS: readonly string[] = [
  "affirm",
  "klarna",
  "afterpay",
  "sezzle",
  "zip",
  "paypal pay later",
];

/**
 * Returns true if the transaction payee matches a known BNPL merchant.
 *
 * Uses normalizePayee to strip noise, then checks whether the
 * normalized result starts with any known BNPL merchant name.
 * Start-of-string matching avoids false positives like "Zippy's".
 */
export function isBnplTransaction(rawPayee: string): boolean {
  const normalized = normalizePayee(rawPayee);
  if (normalized === "") return false;

  return BNPL_MERCHANTS.some(
    (merchant) =>
      normalized === merchant || normalized.startsWith(merchant + " "),
  );
}
