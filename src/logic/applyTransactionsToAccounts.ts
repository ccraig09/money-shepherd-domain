import { Account } from "../models/Account";
import { Transaction } from "../models/Transaction";
import { applyTransactionToAccount } from "./applyTransactionToAccount";

export type ApplyLedgerResult = {
  accounts: Account[];
  appliedTransactionIds: Set<string>;
};

export function applyTransactionsToAccounts(
  accounts: Account[],
  transactions: Transaction[],
  appliedTransactionIds: Set<string> = new Set(),
): ApplyLedgerResult {
  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  for (const tx of transactions) {
    // idempotency guard
    if (appliedTransactionIds.has(tx.id)) continue;

    const account = accountsById.get(tx.accountId);
    if (!account) {
      // For now: ignore unknown account transactions.
      // Later we can throw a domain error if you prefer strictness.
      continue;
    }

    const updated = applyTransactionToAccount(account, tx.amount);
    accountsById.set(updated.id, updated);
    appliedTransactionIds.add(tx.id);
  }

  return {
    accounts: Array.from(accountsById.values()),
    appliedTransactionIds,
  };
}
