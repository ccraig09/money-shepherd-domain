import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Key prefixes — per-item storage avoids SecureStore's ~2KB value limit */
const OLD_KEY_PREFIX = "plaid_token_"; // legacy AsyncStorage key (pre-migration)
const INDEX_PREFIX = "plaid_idx_";
const TOKEN_PREFIX = "plaid_tok_";

export interface PlaidTokenData {
  accessToken: string;
  itemId: string;
  institutionName: string;
  /** @deprecated Use accountIdMap instead */
  accountIds?: string[];
  /** Maps plaidAccountId → internalAccountId (survives reconnects) */
  accountIdMap?: Record<string, string>;
}

function indexKey(userId: string): string {
  return `${INDEX_PREFIX}${userId}`;
}

function tokenKey(userId: string, itemId: string): string {
  return `${TOKEN_PREFIX}${userId}_${itemId}`;
}

function oldAsyncKey(userId: string): string {
  return `${OLD_KEY_PREFIX}${userId}`;
}

/**
 * One-time migration from AsyncStorage (array-per-user) to SecureStore (per-item).
 * Handles both legacy single-object and array formats.
 * Runs transparently on first read, then deletes the old key.
 */
async function migrateFromAsyncStorage(userId: string): Promise<PlaidTokenData[]> {
  const raw = await AsyncStorage.getItem(oldAsyncKey(userId));
  if (!raw) return [];

  const parsed = JSON.parse(raw);
  const tokens: PlaidTokenData[] = Array.isArray(parsed) ? parsed : [parsed];

  const itemIds: string[] = [];
  for (const token of tokens) {
    await SecureStore.setItemAsync(tokenKey(userId, token.itemId), JSON.stringify(token));
    itemIds.push(token.itemId);
  }
  await SecureStore.setItemAsync(indexKey(userId), JSON.stringify(itemIds));

  // Remove old AsyncStorage key
  await AsyncStorage.removeItem(oldAsyncKey(userId));

  return tokens;
}

/**
 * Reads all tokens from SecureStore.
 * On first call per user, migrates from AsyncStorage if legacy data exists.
 */
async function readTokens(userId: string): Promise<PlaidTokenData[]> {
  const indexRaw = await SecureStore.getItemAsync(indexKey(userId));

  if (!indexRaw) {
    return migrateFromAsyncStorage(userId);
  }

  const itemIds: string[] = JSON.parse(indexRaw);
  const tokens: PlaidTokenData[] = [];
  for (const id of itemIds) {
    const raw = await SecureStore.getItemAsync(tokenKey(userId, id));
    if (raw) tokens.push(JSON.parse(raw));
  }
  return tokens;
}

export async function addPlaidToken(
  userId: string,
  data: PlaidTokenData,
): Promise<void> {
  const existing = await readTokens(userId);
  // Replace by itemId OR institutionName (reconnect creates a new Item for the same bank)
  const replaced = existing.filter(
    (t) => t.itemId !== data.itemId && t.institutionName !== data.institutionName,
  );

  // Delete SecureStore entries for tokens being replaced (same institution, different itemId)
  for (const old of existing) {
    if (old.itemId !== data.itemId && old.institutionName === data.institutionName) {
      await SecureStore.deleteItemAsync(tokenKey(userId, old.itemId));
    }
  }

  replaced.push(data);

  // Write new token
  await SecureStore.setItemAsync(tokenKey(userId, data.itemId), JSON.stringify(data));

  // Update index
  await SecureStore.setItemAsync(indexKey(userId), JSON.stringify(replaced.map((t) => t.itemId)));
}

export async function loadPlaidTokens(
  userId: string,
): Promise<PlaidTokenData[]> {
  return readTokens(userId);
}

export async function removePlaidToken(
  userId: string,
  itemId: string,
): Promise<void> {
  const existing = await readTokens(userId);
  const filtered = existing.filter((t) => t.itemId !== itemId);

  await SecureStore.deleteItemAsync(tokenKey(userId, itemId));
  await SecureStore.setItemAsync(indexKey(userId), JSON.stringify(filtered.map((t) => t.itemId)));
}

export async function clearAllPlaidTokens(userId: string): Promise<void> {
  const indexRaw = await SecureStore.getItemAsync(indexKey(userId));
  if (indexRaw) {
    const itemIds: string[] = JSON.parse(indexRaw);
    for (const id of itemIds) {
      await SecureStore.deleteItemAsync(tokenKey(userId, id));
    }
  }
  await SecureStore.deleteItemAsync(indexKey(userId));
}
