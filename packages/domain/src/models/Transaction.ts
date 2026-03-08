import { Money } from "./Money";

export type Transaction = {
  id: string;
  accountId: string;
  amount: Money; // +income, -expense
  description: string;
  postedAt: string; // ISO string
  isPending?: boolean; // true for pending bank transactions (not yet posted)
  envelopeId?: string; // reserved for Phase 4/5
  createdByUserId?: string; // who created this manual transaction
};
