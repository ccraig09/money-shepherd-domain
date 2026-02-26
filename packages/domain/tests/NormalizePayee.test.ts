import { normalizePayee } from "../src";

describe("normalizePayee", () => {
  it("lowercases the input", () => {
    expect(normalizePayee("WALMART")).toBe("walmart");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizePayee("  Target  ")).toBe("target");
  });

  it("collapses multiple spaces to a single space", () => {
    expect(normalizePayee("WAL   MART")).toBe("wal mart");
  });

  it("strips trailing store numbers with hash", () => {
    expect(normalizePayee("WALMART #1234")).toBe("walmart");
  });

  it("strips trailing store numbers without hash", () => {
    expect(normalizePayee("WALMART 1234")).toBe("walmart");
  });

  it("strips trailing digits after dash", () => {
    expect(normalizePayee("TARGET - 5678")).toBe("target");
  });

  it("removes common corporate suffixes", () => {
    expect(normalizePayee("ACME LLC")).toBe("acme");
    expect(normalizePayee("ACME INC")).toBe("acme");
    expect(normalizePayee("ACME INC.")).toBe("acme");
    expect(normalizePayee("ACME CO")).toBe("acme");
    expect(normalizePayee("ACME CO.")).toBe("acme");
    expect(normalizePayee("ACME CORP")).toBe("acme");
    expect(normalizePayee("ACME CORP.")).toBe("acme");
    expect(normalizePayee("ACME LTD")).toBe("acme");
    expect(normalizePayee("ACME LTD.")).toBe("acme");
  });

  it("handles combined patterns: suffix + store number", () => {
    expect(normalizePayee("WALMART INC #1234")).toBe("walmart");
  });

  it("strips location identifiers", () => {
    expect(normalizePayee("CHICK-FIL-A ATLANTA GA")).toBe("chick-fil-a");
  });

  it("strips city/state patterns with two-letter state codes", () => {
    expect(normalizePayee("STARBUCKS NEW YORK NY")).toBe("starbucks");
    expect(normalizePayee("TARGET LOS ANGELES CA")).toBe("target");
  });

  it("returns empty string for empty input", () => {
    expect(normalizePayee("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizePayee("   ")).toBe("");
  });

  it("preserves meaningful hyphens in names", () => {
    expect(normalizePayee("CHICK-FIL-A")).toBe("chick-fil-a");
  });

  it("preserves already clean payees", () => {
    expect(normalizePayee("costco")).toBe("costco");
  });

  it("handles real-world Plaid payee examples", () => {
    expect(normalizePayee("UBER EATS")).toBe("uber eats");
    expect(normalizePayee("SQ *COFFEE SHOP")).toBe("coffee shop");
    expect(normalizePayee("TST* JOE'S PIZZA")).toBe("joe's pizza");
    expect(normalizePayee("AMZN MKTP US*1A2B3C")).toBe("amzn mktp us");
    expect(normalizePayee("VENMO PAYMENT")).toBe("venmo");
    expect(normalizePayee("ZELLE PAYMENT")).toBe("zelle");
    expect(normalizePayee("PAYPAL *EBAY")).toBe("ebay");
  });

  it("strips POS terminal prefixes", () => {
    expect(normalizePayee("POS DEBIT - WALMART")).toBe("walmart");
    expect(normalizePayee("PURCHASE AUTHORIZED ON 01/15 TARGET")).toBe("target");
  });

  it("handles asterisk-separated merchant names", () => {
    expect(normalizePayee("SQ *LOCAL CAFE")).toBe("local cafe");
    expect(normalizePayee("PAYPAL *SPOTIFY")).toBe("spotify");
  });
});
