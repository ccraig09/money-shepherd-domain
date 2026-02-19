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
import { savePinHash } from "../../src/infra/local/pin";
import { useAppStore } from "../../src/store/useAppStore";

export default function PinSetupScreen() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const setGuardReady = useAppStore((s) => s.setGuardReady);

  const [pin, setPin] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const confirmRef = React.useRef<TextInput>(null);

  async function onSave() {
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }
    if (pin !== confirm) {
      setError("PINs don't match. Try again.");
      setConfirm("");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await savePinHash(pin);
      await bootstrap();
      setGuardReady();
    } catch (err: any) {
      setError("Failed to save PIN. Please try again.");
      console.error("[PinSetup] onSave error:", err);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Set a PIN</Text>
          <Text style={styles.subtitle}>
            Choose a 4-digit PIN your household will use to unlock the app.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>New PIN</Text>
          <TextInput
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
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Confirm PIN</Text>
          <TextInput
            ref={confirmRef}
            value={confirm}
            onChangeText={(v) => {
              setConfirm(v);
              if (error) setError(null);
            }}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="••••"
            placeholderTextColor="#aaa"
            style={styles.pinInput}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={onSave}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          onPress={onSave}
          disabled={isSaving}
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Set PIN</Text>
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
  section: { gap: 8 },
  label: { fontSize: 15, fontWeight: "600", color: PRIMARY },
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
  saveBtn: {
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
