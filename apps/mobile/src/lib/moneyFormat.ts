/**
 * Formats integer cents as a human-readable dollar string with
 * thousand separators and always two decimal places.
 *
 * Examples:
 *   1050     →  "10.50"
 *   100050   →  "1,000.50"
 *   -399     →  "-3.99"
 *   0        →  "0.00"
 *   1234567  →  "12,345.67"
 *
 * Uses Intl.NumberFormat (built-in, no external deps).
 */
const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(cents: number): string {
  return formatter.format(cents / 100);
}
