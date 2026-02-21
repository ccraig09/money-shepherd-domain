import { formatMoney } from "../moneyFormat";

describe("formatMoney", () => {
  it("formats whole dollars with two decimal places", () => {
    expect(formatMoney(1000)).toBe("10.00");
  });

  it("formats cents only", () => {
    expect(formatMoney(50)).toBe("0.50");
  });

  it("pads a single-digit cent remainder to two places", () => {
    expect(formatMoney(101)).toBe("1.01");
  });

  it("formats zero as 0.00", () => {
    expect(formatMoney(0)).toBe("0.00");
  });

  it("formats negative cents with leading minus", () => {
    expect(formatMoney(-399)).toBe("-3.99");
  });

  it("adds thousands separator for amounts >= $1,000", () => {
    expect(formatMoney(100050)).toBe("1,000.50");
  });

  it("adds thousands separator for large amounts", () => {
    expect(formatMoney(1234567)).toBe("12,345.67");
  });

  it("handles negative large amounts", () => {
    expect(formatMoney(-100000)).toBe("-1,000.00");
  });
});
