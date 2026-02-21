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

export async function savePlaidToken(
  userId: string,
  data: PlaidTokenData
): Promise<void> {
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(data));
}

export async function loadPlaidToken(
  userId: string
): Promise<PlaidTokenData | null> {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  if (!raw) return null;
  return JSON.parse(raw) as PlaidTokenData;
}

export async function clearPlaidToken(userId: string): Promise<void> {
  await AsyncStorage.removeItem(keyFor(userId));
}

export async function hasPlaidToken(userId: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  return raw !== null;
}
