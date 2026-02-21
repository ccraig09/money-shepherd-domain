import type { Account } from "@money-shepherd/domain";
import type { PlaidTokenData } from "../infra/local/secureTokens";

export interface AccountPickerItem {
  account: Account;
  isPlaid: boolean;
  isConnected: boolean;
}

/**
 * Builds a sorted picker list that marks each account as connected or disconnected.
 *
 * Sort order: manual accounts → connected Plaid → disconnected Plaid.
 *
 * A Plaid account is "connected" if any stored token's `accountIdMap` values
 * contain its internal ID. Falls back to legacy `accountIds` for pre-migration tokens.
 */
export function buildAccountPickerList(
  accounts: Account[],
  tokens: PlaidTokenData[],
): AccountPickerItem[] {
  const connectedPlaidIds = new Set<string>();
  for (const token of tokens) {
    if (token.accountIdMap) {
      for (const internalId of Object.values(token.accountIdMap)) {
        connectedPlaidIds.add(internalId);
      }
    } else if (token.accountIds) {
      // Legacy fallback: pre-migration tokens still use accountIds
      for (const pid of token.accountIds) {
        connectedPlaidIds.add(`plaid-${pid}`);
      }
    }
  }

  const items: AccountPickerItem[] = accounts.map((account) => {
    const isPlaid = account.id.startsWith("plaid-");
    const isConnected = isPlaid ? connectedPlaidIds.has(account.id) : true;
    return { account, isPlaid, isConnected };
  });

  // Sort: manual first, then connected Plaid, then disconnected Plaid
  items.sort((a, b) => {
    const order = (item: AccountPickerItem) => {
      if (!item.isPlaid) return 0;
      if (item.isConnected) return 1;
      return 2;
    };
    return order(a) - order(b);
  });

  return items;
}
