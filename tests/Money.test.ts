import { Money } from "../src";

describe("Money value object", () => {
  it("creates money from cents", () => {
    const m = Money.fromCents(100);
    expect(m.cents).toBe(100);
  });

  it("adds two money values", () => {
    const a = Money.fromCents(100);
    const b = Money.fromCents(50);
    const result = a.add(b);

    expect(result.cents).toBe(150);
  });

  it("subtracts two money values", () => {
    const a = Money.fromCents(100);
    const b = Money.fromCents(40);
    const result = a.subtract(b);

    expect(result.cents).toBe(60);
  });

  it("compares money correctly", () => {
    const a = Money.fromCents(100);
    const b = Money.fromCents(200);

    expect(a.lessThan(b)).toBe(true);
    expect(b.greaterThan(a)).toBe(true);
    expect(a.equals(Money.fromCents(100))).toBe(true);
  });

  it("rejects non-integer cents", () => {
    expect(() => Money.fromCents(10.5)).toThrow(RangeError);
  });
});
