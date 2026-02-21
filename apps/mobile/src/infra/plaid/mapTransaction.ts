import { Money } from "@money-shepherd/domain";
import type { Transaction } from "@money-shepherd/domain";

export interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  merchant_name: string | null;
  name: string | null;
}

/**
 * Maps a single Plaid transaction into a domain Transaction.
 *
 * Sign convention:
 *   Plaid: positive = money leaving account (debit/expense)
 *   Domain: negative = expense, positive = income
 *   → We negate the Plaid amount.
 *
 * @param accountMap - Record<plaidAccountId, internalAccountId>
 */
export function mapPlaidTransaction(
  plaidTx: PlaidTransaction,
  accountMap: Record<string, string>
): Transaction {
  const cents = Math.round(plaidTx.amount * -100) || 0;

  const accountId =
    accountMap[plaidTx.account_id] ?? `plaid-${plaidTx.account_id}`;

  const description =
    plaidTx.merchant_name ?? plaidTx.name ?? "Unknown transaction";

  const postedAt = new Date(plaidTx.date + "T00:00:00.000Z").toISOString();

  return {
    id: `plaid-tx-${plaidTx.transaction_id}`,
    accountId,
    amount: Money.fromCents(cents),
    description,
    postedAt,
  };
}

export function mapPlaidTransactions(
  plaidTxs: PlaidTransaction[],
  accountMap: Record<string, string>
): Transaction[] {
  return plaidTxs.map((tx) => mapPlaidTransaction(tx, accountMap));
}
