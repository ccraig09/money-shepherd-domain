import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ms_last_ai_tip";

export async function saveAiTip(tip: string): Promise<void> {
  await AsyncStorage.setItem(KEY, tip);
}

export async function loadAiTip(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function clearAiTip(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
