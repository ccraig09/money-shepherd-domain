import { normalizePayee } from "./normalizePayee";

/** Keywords that indicate an inter-account transfer after normalization. */
export const TRANSFER_KEYWORDS: readonly string[] = [
  // Inter-account movements
  "transfer to",
  "transfer from",
  "from checking",
  "from savings",
  "to checking",
  "to savings",
  "emergency fund vault",
  "from checking balance",
  "to checking balance",
  "from savings balance",
  "to savings balance",
  // Credit card bill payments (normalizePayee strips trailing " payment")
  "credit card",
  "payment to credit card",
  "payment to mastercard",
  "payment to visa",
  "payment to amex",
  "payment to discover",
  // ACH and wire transfers between own accounts
  "ach transfer",
  "wire transfer",
  "federal wire",
  "fed wire",
];

/**
 * Returns true if the transaction payee matches a known transfer pattern.
 *
 * Uses normalizePayee to strip noise, then checks whether the
 * normalized result starts with any known transfer keyword.
 */
export function isTransferTransaction(rawPayee: string): boolean {
  const normalized = normalizePayee(rawPayee);
  if (normalized === "") return false;

  return TRANSFER_KEYWORDS.some(
    (keyword) =>
      normalized === keyword || normalized.startsWith(keyword + " "),
  );
}

/**
 * Returns true if the Plaid personal_finance_category primary indicates a transfer.
 * Plaid uses "TRANSFER_IN", "TRANSFER_OUT", etc.
 */
export function isTransferByCategory(
  categoryPrimary?: string | null,
): boolean {
  if (!categoryPrimary) return false;
  return categoryPrimary.startsWith("TRANSFER");
}
