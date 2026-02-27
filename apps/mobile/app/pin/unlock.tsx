import React from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { verifyPin } from "../../src/infra/local/pin";
import { useAppStore } from "../../src/store/useAppStore";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../../src/ui/tokens";
import {
  hasBiometricHardware,
  isBiometricEnrolled,
  loadBiometricPreference,
  authenticateWithBiometric,
  getBiometricTypeLabel,
} from "../../src/infra/local/biometric";

export default function PinUnlockScreen() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const setGuardReady = useAppStore((s) => s.setGuardReady);

  const [pin, setPin] = React.useState("");
  const [isChecking, setIsChecking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = React.useState(false);
  const [biometricLabel, setBiometricLabel] = React.useState("Biometric");

  const inputRef = React.useRef<TextInput>(null);

  const attemptBiometric = React.useCallback(async () => {
    const result = await authenticateWithBiometric();
    if (result.success) {
      await bootstrap();
      setGuardReady();
    }
  }, [bootstrap, setGuardReady]);

  React.useEffect(() => {
    let cancelled = false;
    async function init() {
      const [prefOn, hasHw, enrolled] = await Promise.all([
        loadBiometricPreference(),
        hasBiometricHardware(),
        isBiometricEnrolled(),
      ]);
      const available = prefOn && hasHw && enrolled;
      if (cancelled) return;
      setBiometricAvailable(available);
      if (available) {
        const label = await getBiometricTypeLabel();
        if (!cancelled) setBiometricLabel(label);
        attemptBiometric();
      } else {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [attemptBiometric]);

  async function onSubmit() {
    if (!/^\d{4}$/.test(pin)) {
      setError("Enter your 4-digit PIN.");
      return;
    }

    setError(null);
    setIsChecking(true);
    try {
      const ok = await verifyPin(pin);
      if (!ok) {
        setError("Incorrect PIN. Try again.");
        setPin("");
        return;
      }
      await bootstrap();
      setGuardReady();
    } catch (err: any) {
      setError("Something went wrong. Try again.");
      console.error("[PinUnlock] onSubmit error:", err);
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Enter your household PIN to continue.</Text>
        </View>

        <TextInput
          ref={inputRef}
          value={pin}
          onChangeText={(v) => {
            setPin(v);
            if (error) setError(null);
          }}
          keyboardType="number-pad"
          maxLength={4}
          placeholder="••••"
          placeholderTextColor={Color.textDisabled}
          style={styles.pinInput}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={onSubmit}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          onPress={onSubmit}
          disabled={isChecking}
          style={[styles.unlockBtn, isChecking && styles.unlockBtnDisabled]}
        >
          {isChecking ? (
            <ActivityIndicator color={Color.textOnColor} />
          ) : (
            <Text style={styles.unlockBtnText}>Unlock</Text>
          )}
        </Pressable>

        {biometricAvailable && (
          <Pressable onPress={attemptBiometric} style={styles.biometricBtn}>
            <Text style={styles.biometricBtnText}>Use {biometricLabel}</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Color.surface },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  header: { gap: Spacing.sm },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.extrabold, color: Color.textDark },
  subtitle: { fontSize: 14, color: Color.textMid, lineHeight: 20 },
  pinInput: {
    borderWidth: 1.5,
    borderColor: Color.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 10,
    color: Color.textDark,
    textAlign: "center",
  },
  errorText: { fontSize: FontSize.small, color: Color.error, marginTop: -8 },
  unlockBtn: {
    backgroundColor: Color.primary,
    paddingVertical: Spacing.base,
    borderRadius: Radius.xl,
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  unlockBtnDisabled: { opacity: 0.6 },
  unlockBtnText: { color: Color.textOnColor, fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  biometricBtn: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  biometricBtnText: {
    color: Color.primary,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});
