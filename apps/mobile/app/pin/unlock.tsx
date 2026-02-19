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

export default function PinUnlockScreen() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const setGuardReady = useAppStore((s) => s.setGuardReady);

  const [pin, setPin] = React.useState("");
  const [isChecking, setIsChecking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const inputRef = React.useRef<TextInput>(null);

  React.useEffect(() => {
    // Auto-focus on mount
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

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
          placeholderTextColor="#aaa"
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
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.unlockBtnText}>Unlock</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const PRIMARY = "#1a1a2e";
const ACCENT = "#4f8ef7";

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 24,
  },
  header: { gap: 8 },
  title: { fontSize: 28, fontWeight: "800", color: PRIMARY },
  subtitle: { fontSize: 14, color: "#555", lineHeight: 20 },
  pinInput: {
    borderWidth: 1.5,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 10,
    color: PRIMARY,
    textAlign: "center",
  },
  errorText: { fontSize: 13, color: "#d94f4f", marginTop: -8 },
  unlockBtn: {
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  unlockBtnDisabled: { opacity: 0.6 },
  unlockBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
