const POS_PREFIXES = /^(?:pos\s+debit\s*-\s*|purchase\s+authorized\s+on\s+\d{2}\/\d{2}\s+)/i;
const SQUARE_TST_PREFIX = /^(?:sq|tst)\s*\*\s*/i;
const PAYPAL_PREFIX = /^paypal\s*\*\s*/i;
const TRAILING_ALPHANUMERIC_REF = /\*[A-Z0-9]+$/i;
const TRAILING_STORE_NUMBER = /\s+[#-]?\s*\d{2,}$/;
const PAYMENT_SUFFIX = /\s+payment$/i;
const CORPORATE_SUFFIXES = /\s+(?:llc|inc|co|corp|ltd)\.?\s*$/i;

const US_STATES =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|" +
  "MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|" +
  "SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|PR|VI|GU|AS|MP";
const CITY_STATE_SUFFIX = new RegExp(
  `\\s+[A-Za-z]+(?:\\s+[A-Za-z]+){0,2}\\s+(?:${US_STATES})$`,
  "i",
);

export function normalizePayee(raw: string): string {
  let result = raw.trim();

  if (result === "") return "";

  // Strip prefixes
  result = result.replace(POS_PREFIXES, "");
  result = result.replace(SQUARE_TST_PREFIX, "");
  result = result.replace(PAYPAL_PREFIX, "");

  // Strip trailing noise (order matters: refs → numbers → suffixes → location)
  result = result.replace(TRAILING_ALPHANUMERIC_REF, "");
  result = result.replace(TRAILING_STORE_NUMBER, "");
  result = result.replace(PAYMENT_SUFFIX, "");
  result = result.replace(CORPORATE_SUFFIXES, "");
  result = result.replace(CITY_STATE_SUFFIX, "");

  result = result.replace(/\s+/g, " ").trim().toLowerCase();

  return result;
}
