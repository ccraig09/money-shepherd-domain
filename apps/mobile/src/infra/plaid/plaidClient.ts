import { getFunctions, httpsCallable } from "firebase/functions";
import {
  create,
  open,
  LinkLogLevel,
  LinkIOSPresentationStyle,
  type LinkSuccess,
  type LinkExit,
  type LinkTokenConfiguration,
  type LinkOpenProps,
} from "react-native-plaid-link-sdk";
import { getFirebase } from "../firebase/firebaseClient";

const functions = getFunctions(getFirebase().app);

interface CreateLinkTokenResponse {
  linkToken: string;
  expiration: string;
}

/**
 * Calls the Cloud Function to obtain a short-lived Plaid link token.
 * PLAID_SECRET never leaves the server.
 */
export async function requestLinkToken(userId: string): Promise<string> {
  const fn = httpsCallable<{ userId: string }, CreateLinkTokenResponse>(
    functions,
    "createLinkToken"
  );
  const result = await fn({ userId });
  return result.data.linkToken;
}

interface ExchangeTokenResponse {
  accessToken: string;
  itemId: string;
}

/**
 * Exchanges a public_token from Plaid Link for a long-lived access_token.
 * The exchange happens server-side via Cloud Function.
 */
export async function exchangePublicToken(
  publicToken: string,
  userId: string
): Promise<ExchangeTokenResponse> {
  const fn = httpsCallable<
    { publicToken: string; userId: string },
    ExchangeTokenResponse
  >(functions, "exchangePublicToken");
  const result = await fn({ publicToken, userId });
  return result.data;
}

export interface PlaidAccountInfo {
  plaidAccountId: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
}

/**
 * Fetches the accounts for a connected Plaid item.
 */
export async function fetchAccounts(
  accessToken: string
): Promise<PlaidAccountInfo[]> {
  const fn = httpsCallable<
    { accessToken: string },
    { accounts: PlaidAccountInfo[] }
  >(functions, "getAccounts");
  const result = await fn({ accessToken });
  return result.data.accounts;
}

export interface PlaidSyncedTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  merchant_name: string | null;
  name: string | null;
}

export interface SyncTransactionsResult {
  added: PlaidSyncedTransaction[];
  modified: PlaidSyncedTransaction[];
  removed: string[];
  nextCursor: string;
  hasMore: boolean;
}

/**
 * Fetches new/modified/removed transactions for a connected Plaid item.
 */
export async function syncTransactions(
  accessToken: string,
  cursor?: string
): Promise<SyncTransactionsResult> {
  const fn = httpsCallable<
    { accessToken: string; cursor?: string },
    SyncTransactionsResult
  >(functions, "syncTransactions");
  const result = await fn({ accessToken, cursor });
  return result.data;
}

export interface PlaidLinkCallbacks {
  onSuccess: (publicToken: string, metadata: LinkSuccess["metadata"]) => void;
  onExit: (error: LinkExit["error"] | null) => void;
}

/**
 * Initializes the Plaid Link SDK with the given link token,
 * then opens the Link UI sheet.
 */
export function openPlaidLink(
  linkToken: string,
  callbacks: PlaidLinkCallbacks
): void {
  const tokenConfig: LinkTokenConfiguration = {
    token: linkToken,
    noLoadingState: false,
  };

  create(tokenConfig);

  const openProps: LinkOpenProps = {
    onSuccess: (success: LinkSuccess) => {
      callbacks.onSuccess(
        success.publicToken,
        success.metadata
      );
    },
    onExit: (exit: LinkExit) => {
      callbacks.onExit(exit.error ?? null);
    },
    iOSPresentationStyle: LinkIOSPresentationStyle.MODAL,
    logLevel: LinkLogLevel.ERROR,
  };

  open(openProps);
}
