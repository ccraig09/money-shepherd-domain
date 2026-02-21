import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "plaid_token_";

export interface PlaidTokenData {
  accessToken: string;
  itemId: string;
  institutionName: string;
}

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

/**
 * Reads raw storage and migrates single-object format to array if needed.
 */
async function readTokens(userId: string): Promise<PlaidTokenData[]> {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  // Migrate: old format was a single object, new format is an array
  if (!Array.isArray(parsed)) {
    const migrated = [parsed as PlaidTokenData];
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(migrated));
    return migrated;
  }
  return parsed as PlaidTokenData[];
}

export async function addPlaidToken(
  userId: string,
  data: PlaidTokenData
): Promise<void> {
  const existing = await readTokens(userId);
  // Replace if same itemId already stored (re-connect), otherwise append
  const filtered = existing.filter((t) => t.itemId !== data.itemId);
  filtered.push(data);
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(filtered));
}

export async function loadPlaidTokens(
  userId: string
): Promise<PlaidTokenData[]> {
  return readTokens(userId);
}

export async function removePlaidToken(
  userId: string,
  itemId: string
): Promise<void> {
  const existing = await readTokens(userId);
  const filtered = existing.filter((t) => t.itemId !== itemId);
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(filtered));
}

export async function clearAllPlaidTokens(userId: string): Promise<void> {
  await AsyncStorage.removeItem(keyFor(userId));
}
