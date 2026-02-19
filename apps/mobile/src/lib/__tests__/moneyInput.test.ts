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
});

// ---------------------------------------------------------------------------
// parseDollars — rejected inputs
// ---------------------------------------------------------------------------

describe("parseDollars — rejected inputs", () => {
  it("rejects an empty string", () => {
    const result = parseDollars("");
    expect(result.ok).toBe(false);
  });

  it("rejects a whitespace-only string", () => {
    const result = parseDollars("   ");
    expect(result.ok).toBe(false);
  });

  it("rejects a negative value", () => {
    const result = parseDollars("-10");
    expect(result.ok).toBe(false);
  });

  it("rejects three decimal places", () => {
    const result = parseDollars("10.505");
    expect(result.ok).toBe(false);
  });

  it("rejects non-numeric input", () => {
    const result = parseDollars("abc");
    expect(result.ok).toBe(false);
  });

  it("rejects input with a currency symbol", () => {
    const result = parseDollars("$10");
    expect(result.ok).toBe(false);
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
