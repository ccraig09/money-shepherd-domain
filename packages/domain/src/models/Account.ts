import { Money } from "./Money";

export type AccountType = "depository" | "credit" | "loan" | "investment";

export type Account = {
  id: string;
  name: string;
  balance: Money;
  accountType?: AccountType;
};
