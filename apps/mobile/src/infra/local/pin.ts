import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ms_pin_hash_v1";

/** Simple non-cryptographic hash for convenience PIN (not security-critical). */
function simpleHash(pin: string): string {
  let h = 0;
  for (let i = 0; i < pin.length; i++) h = (h * 31 + pin.charCodeAt(i)) >>> 0;
  return String(h);
}

export async function loadPinHash(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function savePinHash(pin: string): Promise<void> {
  await AsyncStorage.setItem(KEY, simpleHash(pin));
}

export async function clearPin(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export async function verifyPin(input: string): Promise<boolean> {
  const stored = await AsyncStorage.getItem(KEY);
  if (!stored) return false;
  return simpleHash(input) === stored;
}
