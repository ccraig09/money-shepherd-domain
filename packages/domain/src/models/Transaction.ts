import { Money } from "./Money";

export type Transaction = {
  id: string;
  accountId: string;
  amount: Money; // +income, -expense
  description: string;
  postedAt: string; // ISO string
  envelopeId?: string; // reserved for Phase 4/5
  createdByUserId?: string; // who created this manual transaction
};
