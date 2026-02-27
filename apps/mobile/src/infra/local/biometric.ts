import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Lazy-load to avoid crash in Expo Go where native module isn't available
let LocalAuthentication: typeof import("expo-local-authentication") | null = null;
try {
  LocalAuthentication = require("expo-local-authentication");
} catch {
  // Native module not available (Expo Go) — functions return safe defaults
}

const PREF_KEY = "ms_biometric_enabled_v1";

export async function hasBiometricHardware(): Promise<boolean> {
  if (!LocalAuthentication) return false;
  return LocalAuthentication.hasHardwareAsync();
}

export async function isBiometricEnrolled(): Promise<boolean> {
  if (!LocalAuthentication) return false;
  return LocalAuthentication.isEnrolledAsync();
}

export async function authenticateWithBiometric(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!LocalAuthentication) return { success: false, error: "not_available" };
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

export async function getBiometricTypeLabel(): Promise<string> {
  if (!LocalAuthentication) return "Biometric";
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === "ios" ? "Face ID" : "Face Unlock";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return "Iris";
  }
  return "Biometric";
}
