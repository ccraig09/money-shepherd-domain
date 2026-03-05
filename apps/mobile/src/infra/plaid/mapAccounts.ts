import { Money } from "@money-shepherd/domain";
import type { Account, AccountType } from "@money-shepherd/domain";
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
 * Converts a Plaid account type string to our domain AccountType.
 * Unknown types default to "depository" (safe — treated as cash).
 */
function toAccountType(plaidType: string): AccountType {
  switch (plaidType) {
    case "depository": return "depository";
    case "credit": return "credit";
    case "loan": return "loan";
    case "investment": return "investment";
    default: return "depository";
  }
}

/**
 * Converts Plaid balance to domain cents with correct sign per account type.
 *
 * Plaid returns `balances.current` as a positive number for all types:
 * - depository: money you HAVE → store as positive
 * - credit: money you OWE → store as negative
 * - loan: principal OWED → store as negative
 * - investment: portfolio VALUE → store as positive
 */
function toBalanceCents(balanceCurrentCents: number | null, accountType: AccountType): number {
  if (balanceCurrentCents == null) return 0;
  if (accountType === "credit" || accountType === "loan") return -balanceCurrentCents;
  return balanceCurrentCents;
}

/**
 * Maps Plaid accounts into domain Account objects, merging with
 * existing accounts to prevent duplicates on re-connect.
 *
 * Account IDs are derived deterministically from plaidAccountId
 * so the same Plaid account always maps to the same internal ID.
 *
 * Balance is set from Plaid's balances.current (sign-converted per type).
 * Existing Plaid account balances are updated with fresh Plaid data.
 */
export function mapPlaidAccounts(
  plaidAccounts: PlaidAccountInfo[],
  userId: string,
  existingAccounts: Account[],
  /** Restrict name-based reconnect matching to these account IDs (this user's own accounts). */
  userOwnedAccountIds?: Set<string>,
): MapAccountsResult {
  const existingById = new Map(existingAccounts.map((a) => [a.id, a]));
  const mergedAccounts = [...existingAccounts];
  const mappings: AccountMapping[] = [];
  const accountIdMap: Record<string, string> = {};

  // Build name→account index for reconnect matching (plaid-* accounts owned by this user only).
  // Without userId scoping, two users with same-named accounts at the same institution
  // (e.g., both have "Share Savings") would incorrectly share accounts.
  const existingByName = new Map<string, Account>();
  for (const a of existingAccounts) {
    if (a.id.startsWith("plaid-")) {
      if (!userOwnedAccountIds || userOwnedAccountIds.has(a.id)) {
        existingByName.set(a.name, a);
      }
    }
  }

  for (const pa of plaidAccounts) {
    const directId = `plaid-${pa.plaidAccountId}`;
    const displayName = pa.officialName ?? pa.name;
    const accountType = toAccountType(pa.type);
    const balanceCents = toBalanceCents(pa.balanceCurrentCents, accountType);

    let resolvedId: string;

    if (existingById.has(directId)) {
      // Exact ID match — update balance from fresh Plaid data
      resolvedId = directId;
      const idx = mergedAccounts.findIndex((a) => a.id === resolvedId);
      if (idx !== -1) {
        mergedAccounts[idx] = {
          ...mergedAccounts[idx],
          balance: Money.fromCents(balanceCents),
          accountType,
        };
      }
    } else {
      // Reconnect case: Plaid assigned a new account ID. Try matching by name.
      const nameMatch = existingByName.get(displayName);
      if (nameMatch) {
        resolvedId = nameMatch.id;
        const idx = mergedAccounts.findIndex((a) => a.id === resolvedId);
        if (idx !== -1) {
          mergedAccounts[idx] = {
            ...mergedAccounts[idx],
            balance: Money.fromCents(balanceCents),
            accountType,
          };
        }
      } else {
        // Genuinely new account
        resolvedId = directId;
        mergedAccounts.push({
          id: resolvedId,
          name: displayName,
          balance: Money.fromCents(balanceCents),
          accountType,
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
