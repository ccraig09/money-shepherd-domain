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
import { Spacing, Radius, FontSize, FontWeight, Color } from "../../src/ui/tokens";

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
            placeholderTextColor={Color.textDisabled}
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
            placeholderTextColor={Color.textDisabled}
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
            <ActivityIndicator color={Color.textOnColor} />
          ) : (
            <Text style={styles.saveBtnText}>Set PIN</Text>
          )}
        </Pressable>
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
  section: { gap: Spacing.sm },
  label: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Color.textDark },
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
  saveBtn: {
    backgroundColor: Color.primary,
    paddingVertical: Spacing.base,
    borderRadius: Radius.xl,
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Color.textOnColor, fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
});
