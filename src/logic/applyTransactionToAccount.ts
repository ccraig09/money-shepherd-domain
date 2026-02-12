import { Account } from "../models/Account";
import { Money } from "../models/Money";

export function applyTransactionToAccount(
  account: Account,
  amount: Money,
): Account {
  const newBalance = account.balance.add(amount);

  return {
    ...account,
    balance: newBalance,
  };
}
