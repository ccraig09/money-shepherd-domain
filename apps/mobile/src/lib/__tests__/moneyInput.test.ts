import { parseDollars, formatCents } from "../moneyInput";

// ---------------------------------------------------------------------------
// parseDollars — accepted inputs
// ---------------------------------------------------------------------------

describe("parseDollars — accepted inputs", () => {
  it("parses a whole-dollar string to cents", () => {
    const result = parseDollars("10");
    expect(result).toEqual({ ok: true, cents: 1000 });
  });

  it("parses a one-decimal string to cents", () => {
    const result = parseDollars("10.5");
    expect(result).toEqual({ ok: true, cents: 1050 });
  });

  it("parses a two-decimal string to cents", () => {
    const result = parseDollars("10.50");
    expect(result).toEqual({ ok: true, cents: 1050 });
  });

  it("parses zero correctly", () => {
    const result = parseDollars("0");
    expect(result).toEqual({ ok: true, cents: 0 });
  });

  it("trims surrounding whitespace before parsing", () => {
    const result = parseDollars("  10.50  ");
    expect(result).toEqual({ ok: true, cents: 1050 });
  });

  it("accepts .50 shorthand as 50 cents", () => {
    expect(parseDollars(".50")).toEqual({ ok: true, cents: 50 });
  });

  it("accepts .5 shorthand as 50 cents", () => {
    expect(parseDollars(".5")).toEqual({ ok: true, cents: 50 });
  });
});

// ---------------------------------------------------------------------------
// parseDollars — rejected inputs
// ---------------------------------------------------------------------------

describe("parseDollars — rejected inputs", () => {
  it("rejects an empty string", () => {
    expect(parseDollars("")).toEqual({ ok: false, error: "Amount is required." });
  });

  it("rejects a whitespace-only string", () => {
    expect(parseDollars("   ")).toEqual({ ok: false, error: "Amount is required." });
  });

  it("rejects a lone dot", () => {
    expect(parseDollars(".")).toEqual({ ok: false, error: "Enter an amount like 10.50." });
  });

  it("rejects multiple dots", () => {
    expect(parseDollars("1.2.3")).toEqual({ ok: false, error: "Enter an amount like 10.50." });
  });

  it("rejects three decimal places with specific message", () => {
    expect(parseDollars("10.505")).toEqual({ ok: false, error: "Use at most 2 decimal places." });
  });

  it("rejects a negative value", () => {
    const result = parseDollars("-10");
    expect(result.ok).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(parseDollars("abc")).toEqual({ ok: false, error: "Enter a valid amount (e.g. 10 or 10.50)." });
  });

  it("rejects input with a currency symbol", () => {
    expect(parseDollars("$10")).toEqual({ ok: false, error: "Enter a valid amount (e.g. 10 or 10.50)." });
  });
});

// ---------------------------------------------------------------------------
// formatCents — display formatting
// ---------------------------------------------------------------------------

describe("formatCents", () => {
  it("formats positive cents as dollars with two decimal places", () => {
    expect(formatCents(1050)).toBe("10.50");
  });

  it("formats negative cents with a leading minus sign", () => {
    expect(formatCents(-399)).toBe("-3.99");
  });

  it("formats zero as '0.00'", () => {
    expect(formatCents(0)).toBe("0.00");
  });

  it("pads a single-digit cent remainder to two places", () => {
    expect(formatCents(101)).toBe("1.01");
  });

  it("formats a large positive value correctly", () => {
    expect(formatCents(100000)).toBe("1000.00");
  });
});
