import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ms_sync_meta_v1";

export type SyncMeta = {
  householdId: string;
  rev: number;
  userId: string; // user-los or user-wife
};

export async function loadSyncMeta(): Promise<SyncMeta | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as SyncMeta) : null;
}

export async function saveSyncMeta(meta: SyncMeta): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(meta));
}

export async function clearSyncMeta(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
