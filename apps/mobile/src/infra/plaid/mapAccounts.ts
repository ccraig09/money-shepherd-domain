import { Money } from "@money-shepherd/domain";
import type { Account } from "@money-shepherd/domain";
import type { PlaidAccountInfo } from "./plaidClient";

export interface AccountMapping {
  plaidAccountId: string;
  internalAccountId: string;
  userId: string;
}

export interface MapAccountsResult {
  accounts: Account[];
  mappings: AccountMapping[];
}

/**
 * Maps Plaid accounts into domain Account objects, merging with
 * existing accounts to prevent duplicates on re-connect.
 *
 * Account IDs are derived deterministically from plaidAccountId
 * so the same Plaid account always maps to the same internal ID.
 */
export function mapPlaidAccounts(
  plaidAccounts: PlaidAccountInfo[],
  userId: string,
  existingAccounts: Account[]
): MapAccountsResult {
  const existingById = new Map(existingAccounts.map((a) => [a.id, a]));
  const mergedAccounts = [...existingAccounts];
  const mappings: AccountMapping[] = [];

  for (const pa of plaidAccounts) {
    const internalId = `plaid-${pa.plaidAccountId}`;
    const displayName = pa.officialName ?? pa.name;

    if (!existingById.has(internalId)) {
      mergedAccounts.push({
        id: internalId,
        name: displayName,
        balance: Money.fromCents(0),
      });
    }

    mappings.push({
      plaidAccountId: pa.plaidAccountId,
      internalAccountId: internalId,
      userId,
    });
  }

  return { accounts: mergedAccounts, mappings };
}
