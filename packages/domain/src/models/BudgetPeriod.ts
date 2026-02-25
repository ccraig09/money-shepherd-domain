import { Money } from "./Money";

export type BudgetPeriod = {
  startDate: string; // ISO date "YYYY-MM-DD"
  endDate: string; // ISO date "YYYY-MM-DD"
  label: string; // e.g. "February 2026"
};

export type Allocation = {
  envelopeId: string;
  amount: Money;
  allocatedAt: string; // ISO date "YYYY-MM-DD"
};
