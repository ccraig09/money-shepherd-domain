import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PREF_KEY = "ms_biometric_enabled_v1";

export async function hasBiometricHardware(): Promise<boolean> {
  return LocalAuthentication.hasHardwareAsync();
}

export async function isBiometricEnrolled(): Promise<boolean> {
  return LocalAuthentication.isEnrolledAsync();
}

export async function authenticateWithBiometric(): Promise<{
  success: boolean;
  error?: string;
}> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock Money Shepherd",
    fallbackLabel: "Use PIN",
    disableDeviceFallback: true,
  });
  if (result.success) return { success: true };
  return { success: false, error: result.error };
}

export async function loadBiometricPreference(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PREF_KEY);
  return value === "true";
}

export async function saveBiometricPreference(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(PREF_KEY, enabled ? "true" : "false");
}
