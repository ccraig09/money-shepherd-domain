import { isTransferTransaction, isTransferByCategory } from "../src/logic/detectTransfer";

describe("isTransferTransaction", () => {
  it("detects 'Transfer To Checking' pattern", () => {
    expect(isTransferTransaction("Transfer To Checking -1415")).toBe(true);
  });

  it("detects 'Transfer From Savings' pattern", () => {
    expect(isTransferTransaction("Transfer From Savings -8932")).toBe(true);
  });

  it("detects 'From checking balance' (SoFi roundup credit)", () => {
    expect(isTransferTransaction("From checking balance")).toBe(true);
  });

  it("detects 'Emergency Fund Vault' (SoFi roundup debit)", () => {
    expect(isTransferTransaction("Emergency Fund Vault")).toBe(true);
  });

  it("detects 'To Checking - 8512' pattern", () => {
    expect(isTransferTransaction("To Checking - 8512")).toBe(true);
  });

  it("detects 'From Savings - 4567' pattern", () => {
    expect(isTransferTransaction("From Savings - 4567")).toBe(true);
  });

  it("does not flag normal merchants", () => {
    expect(isTransferTransaction("Trader Joe's")).toBe(false);
    expect(isTransferTransaction("Amazon")).toBe(false);
    expect(isTransferTransaction("T-Mobile")).toBe(false);
    expect(isTransferTransaction("State Farm")).toBe(false);
  });

  it("does not flag empty string", () => {
    expect(isTransferTransaction("")).toBe(false);
  });

  it("does not flag merchants containing 'from' or 'to' in name", () => {
    expect(isTransferTransaction("Fromaggio Pizza")).toBe(false);
    expect(isTransferTransaction("Toronto Store")).toBe(false);
  });

  it("detects credit card bill payments", () => {
    expect(isTransferTransaction("Credit Card Payment")).toBe(true);
    expect(isTransferTransaction("Payment To Visa")).toBe(true);
    expect(isTransferTransaction("Payment To Mastercard")).toBe(true);
  });

  it("detects ACH and wire transfers", () => {
    expect(isTransferTransaction("ACH Transfer 12345")).toBe(true);
    expect(isTransferTransaction("Wire Transfer")).toBe(true);
    expect(isTransferTransaction("Federal Wire Transfer")).toBe(true);
  });

  it("does not flag P2P payments as transfers (those are real spending)", () => {
    expect(isTransferTransaction("Venmo")).toBe(false);
    expect(isTransferTransaction("Zelle")).toBe(false);
    expect(isTransferTransaction("Apple Cash Sent Money")).toBe(false);
  });
});

describe("isTransferByCategory", () => {
  it("detects TRANSFER_IN", () => {
    expect(isTransferByCategory("TRANSFER_IN")).toBe(true);
  });

  it("detects TRANSFER_OUT", () => {
    expect(isTransferByCategory("TRANSFER_OUT")).toBe(true);
  });

  it("does not flag FOOD_AND_DRINK", () => {
    expect(isTransferByCategory("FOOD_AND_DRINK")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isTransferByCategory(null)).toBe(false);
    expect(isTransferByCategory(undefined)).toBe(false);
  });
});
