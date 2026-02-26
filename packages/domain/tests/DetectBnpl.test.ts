import { isBnplTransaction, BNPL_MERCHANTS } from "../src";

describe("isBnplTransaction", () => {
  it("detects exact BNPL merchant names", () => {
    expect(isBnplTransaction("Affirm")).toBe(true);
    expect(isBnplTransaction("Klarna")).toBe(true);
    expect(isBnplTransaction("Afterpay")).toBe(true);
    expect(isBnplTransaction("Sezzle")).toBe(true);
    expect(isBnplTransaction("Zip")).toBe(true);
  });

  it("detects PayPal Pay Later variant", () => {
    expect(isBnplTransaction("PayPal Pay Later")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isBnplTransaction("AFFIRM")).toBe(true);
    expect(isBnplTransaction("klarna")).toBe(true);
    expect(isBnplTransaction("afterPay")).toBe(true);
  });

  it("detects BNPL merchants with transaction suffixes", () => {
    expect(isBnplTransaction("AFFIRM *PURCHASE")).toBe(true);
    expect(isBnplTransaction("KLARNA *PAYMENT 12345")).toBe(true);
    expect(isBnplTransaction("AFTERPAY US INC")).toBe(true);
    expect(isBnplTransaction("SEZZLE *ORDER-9876")).toBe(true);
    expect(isBnplTransaction("ZIP PAY PURCHASE")).toBe(true);
  });

  it("detects BNPL merchants with POS prefixes", () => {
    expect(isBnplTransaction("POS Debit - Affirm Payment")).toBe(true);
    expect(isBnplTransaction("Purchase Authorized on 02/15 Klarna")).toBe(true);
  });

  it("rejects non-BNPL merchants", () => {
    expect(isBnplTransaction("Walmart")).toBe(false);
    expect(isBnplTransaction("Netflix")).toBe(false);
    expect(isBnplTransaction("Amazon")).toBe(false);
    expect(isBnplTransaction("Target")).toBe(false);
  });

  it("rejects empty payee", () => {
    expect(isBnplTransaction("")).toBe(false);
  });

  it("rejects partial false matches", () => {
    expect(isBnplTransaction("Affirming Life Church")).toBe(false);
    expect(isBnplTransaction("Zippy's Restaurant")).toBe(false);
  });

  it("exports a static BNPL_MERCHANTS list", () => {
    expect(Array.isArray(BNPL_MERCHANTS)).toBe(true);
    expect(BNPL_MERCHANTS.length).toBeGreaterThanOrEqual(6);
  });
});
