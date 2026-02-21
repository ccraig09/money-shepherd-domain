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
  /** Maps plaidAccountId → internalAccountId (handles reconnect ID changes) */
  accountIdMap: Record<string, string>;
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
  const accountIdMap: Record<string, string> = {};

  // Build name→account index for reconnect matching (plaid-* accounts only)
  const existingByName = new Map<string, Account>();
  for (const a of existingAccounts) {
    if (a.id.startsWith("plaid-")) {
      existingByName.set(a.name, a);
    }
  }

  for (const pa of plaidAccounts) {
    const directId = `plaid-${pa.plaidAccountId}`;
    const displayName = pa.officialName ?? pa.name;

    let resolvedId: string;

    if (existingById.has(directId)) {
      // Exact ID match — same Plaid account ID as before
      resolvedId = directId;
    } else {
      // Reconnect case: Plaid assigned a new account ID. Try matching by name.
      const nameMatch = existingByName.get(displayName);
      if (nameMatch) {
        resolvedId = nameMatch.id;
      } else {
        // Genuinely new account
        resolvedId = directId;
        mergedAccounts.push({
          id: resolvedId,
          name: displayName,
          balance: Money.fromCents(0),
        });
        existingById.set(resolvedId, mergedAccounts[mergedAccounts.length - 1]);
      }
    }

    accountIdMap[pa.plaidAccountId] = resolvedId;

    mappings.push({
      plaidAccountId: pa.plaidAccountId,
      internalAccountId: resolvedId,
      userId,
    });
  }

  return { accounts: mergedAccounts, mappings, accountIdMap };
}
