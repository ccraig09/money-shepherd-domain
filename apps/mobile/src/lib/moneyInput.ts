/**
 * Money input helpers — single source of truth for Phase 14 forms.
 *
 * All values are integer cents. No float math.
 */

export type ParseResult =
  | { ok: true; cents: number }
  | { ok: false; error: string };

/** Matches non-negative dollar strings with at most two decimal places. */
const VALID_AMOUNT = /^\d+(\.\d{1,2})?$/;

/**
 * Parse a raw UI string (e.g. "10", "10.5", "10.50") into integer cents.
 *
 * Rejects: empty, negative, more than two decimal places, non-numeric.
 * UI is responsible for sign (income vs. expense toggle).
 */
export function parseDollars(raw: string): ParseResult {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return { ok: false, error: "Amount is required." };
  }

  if (!VALID_AMOUNT.test(trimmed)) {
    return { ok: false, error: "Enter a valid amount (e.g. 10 or 10.50)." };
  }

  const [intPart, decPart = ""] = trimmed.split(".");
  const wholeCents = parseInt(intPart, 10) * 100;
  const fractionalCents = parseInt(decPart.padEnd(2, "0"), 10);

  return { ok: true, cents: wholeCents + fractionalCents };
}

/**
 * Format integer cents as a human-readable dollar string.
 *
 * Examples: 1050 → "10.50", -399 → "-3.99", 0 → "0.00"
 */
export function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const sign = cents < 0 ? "-" : "";
  return `${sign}${dollars}.${String(remainder).padStart(2, "0")}`;
}
