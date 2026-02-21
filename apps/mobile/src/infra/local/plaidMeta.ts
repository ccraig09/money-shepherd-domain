import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "ms_plaid_refresh_";

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export async function savePlaidRefreshAt(
  userId: string,
  iso: string
): Promise<void> {
  await AsyncStorage.setItem(keyFor(userId), iso);
}

export async function loadPlaidRefreshAt(
  userId: string
): Promise<string | null> {
  return AsyncStorage.getItem(keyFor(userId));
}

export async function clearPlaidRefreshAt(userId: string): Promise<void> {
  await AsyncStorage.removeItem(keyFor(userId));
}
