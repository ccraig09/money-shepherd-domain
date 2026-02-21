import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

initializeApp();

const PLAID_CLIENT_ID = defineSecret("PLAID_CLIENT_ID");
const PLAID_SECRET = defineSecret("PLAID_SECRET");

function makePlaidClient(clientId: string, secret: string): PlaidApi {
  const config = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV ?? "sandbox"],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });
  return new PlaidApi(config);
}

interface CreateLinkTokenRequest {
  userId: string;
}

interface CreateLinkTokenResponse {
  linkToken: string;
  expiration: string;
}

/**
 * Creates a short-lived Plaid link token for the given user.
 * The link_token is used to open the Plaid Link UI on the mobile client.
 * PLAID_SECRET stays server-side — never returned to the client.
 */
export const createLinkToken = onCall<
  CreateLinkTokenRequest,
  Promise<CreateLinkTokenResponse>
>(
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in to connect a bank account.");
    }

    const { userId } = request.data;
    if (!userId || typeof userId !== "string") {
      throw new HttpsError("invalid-argument", "userId is required.");
    }

    const plaid = makePlaidClient(
      PLAID_CLIENT_ID.value(),
      PLAID_SECRET.value()
    );

    const response = await plaid.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Money Shepherd",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return {
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
    };
  }
);

interface ExchangeTokenRequest {
  publicToken: string;
  userId: string;
}

interface ExchangeTokenResponse {
  accessToken: string;
  itemId: string;
}

/**
 * Exchanges a short-lived public_token (from Plaid Link) for a
 * long-lived access_token + item_id.
 */
export const exchangePublicToken = onCall<
  ExchangeTokenRequest,
  Promise<ExchangeTokenResponse>
>(
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { publicToken, userId } = request.data;
    if (!publicToken || typeof publicToken !== "string") {
      throw new HttpsError("invalid-argument", "publicToken is required.");
    }
    if (!userId || typeof userId !== "string") {
      throw new HttpsError("invalid-argument", "userId is required.");
    }

    const plaid = makePlaidClient(
      PLAID_CLIENT_ID.value(),
      PLAID_SECRET.value()
    );

    const response = await plaid.itemPublicTokenExchange({
      public_token: publicToken,
    });

    return {
      accessToken: response.data.access_token,
      itemId: response.data.item_id,
    };
  }
);

interface GetAccountsRequest {
  accessToken: string;
}

interface PlaidAccountInfo {
  plaidAccountId: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
}

interface GetAccountsResponse {
  accounts: PlaidAccountInfo[];
}

/**
 * Fetches the list of accounts for a connected Plaid item.
 */
export const getAccounts = onCall<
  GetAccountsRequest,
  Promise<GetAccountsResponse>
>(
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { accessToken } = request.data;
    if (!accessToken || typeof accessToken !== "string") {
      throw new HttpsError("invalid-argument", "accessToken is required.");
    }

    const plaid = makePlaidClient(
      PLAID_CLIENT_ID.value(),
      PLAID_SECRET.value()
    );

    const response = await plaid.accountsGet({
      access_token: accessToken,
    });

    const accounts: PlaidAccountInfo[] = response.data.accounts.map((a) => ({
      plaidAccountId: a.account_id,
      name: a.name,
      officialName: a.official_name ?? null,
      type: a.type,
      subtype: a.subtype ?? null,
      mask: a.mask ?? null,
    }));

    return { accounts };
  }
);

interface SyncTransactionsRequest {
  accessToken: string;
  cursor?: string;
}

interface PlaidTransactionResult {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  merchant_name: string | null;
  name: string | null;
}

interface SyncTransactionsResponse {
  added: PlaidTransactionResult[];
  modified: PlaidTransactionResult[];
  removed: string[]; // transaction_ids
  nextCursor: string;
  hasMore: boolean;
}

/**
 * Fetches new/modified/removed transactions for a Plaid item.
 * Uses /transactions/sync for efficient incremental updates.
 */
export const syncTransactions = onCall<
  SyncTransactionsRequest,
  Promise<SyncTransactionsResponse>
>(
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { accessToken, cursor } = request.data;
    if (!accessToken || typeof accessToken !== "string") {
      throw new HttpsError("invalid-argument", "accessToken is required.");
    }

    const plaid = makePlaidClient(
      PLAID_CLIENT_ID.value(),
      PLAID_SECRET.value()
    );

    const response = await plaid.transactionsSync({
      access_token: accessToken,
      cursor: cursor ?? undefined,
    });

    const mapTx = (t: {
      transaction_id: string;
      account_id: string;
      amount: number;
      date: string;
      merchant_name?: string | null;
      name: string;
    }): PlaidTransactionResult => ({
      transaction_id: t.transaction_id,
      account_id: t.account_id,
      amount: t.amount,
      date: t.date,
      merchant_name: t.merchant_name ?? null,
      name: t.name ?? null,
    });

    return {
      added: response.data.added.map(mapTx),
      modified: response.data.modified.map(mapTx),
      removed: response.data.removed.map((r) => r.transaction_id),
      nextCursor: response.data.next_cursor,
      hasMore: response.data.has_more,
    };
  }
);
