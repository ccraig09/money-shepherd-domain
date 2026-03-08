import { Money } from "./Money";

export type AccountType = "depository" | "credit" | "loan" | "investment";

export type Account = {
  id: string;
  name: string;
  balance: Money;
  accountType?: AccountType;
  /** The userId who linked this account (e.g. "user-los"). */
  ownerUserId?: string;
  /** Institution name from Plaid Link metadata (e.g. "Navy Federal"). */
  institutionName?: string;
};
