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
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../../src/ui/tokens";
import { useThemedStyles, useTheme } from "@/src/ui/ThemeProvider";
import {
  hasBiometricHardware,
  isBiometricEnrolled,
  getBiometricTypeLabel,
  saveBiometricPreference,
} from "../../src/infra/local/biometric";

export default function PinSetupScreen() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const setGuardReady = useAppStore((s) => s.setGuardReady);

  const [pin, setPin] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Biometric opt-in step
  const [showBiometricOptIn, setShowBiometricOptIn] = React.useState(false);
  const [biometricLabel, setBiometricLabel] = React.useState("Biometric");
  const [isFinishing, setIsFinishing] = React.useState(false);

  const confirmRef = React.useRef<TextInput>(null);

  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  async function finishSetup() {
    setIsFinishing(true);
    try {
      await bootstrap();
      setGuardReady();
    } catch (err: any) {
      console.error("[PinSetup] finishSetup error:", err);
    } finally {
      setIsFinishing(false);
    }
  }

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

      // Check biometric availability before finishing
      const [hasHw, enrolled] = await Promise.all([
        hasBiometricHardware(),
        isBiometricEnrolled(),
      ]);

      if (hasHw && enrolled) {
        const label = await getBiometricTypeLabel();
        setBiometricLabel(label);
        setIsSaving(false);
        setShowBiometricOptIn(true);
        return;
      }

      // No biometric — finish immediately
      await bootstrap();
      setGuardReady();
    } catch (err: any) {
      setError("Failed to save PIN. Please try again.");
      console.error("[PinSetup] onSave error:", err);
    } finally {
      setIsSaving(false);
    }
  }

  async function onEnableBiometric() {
    await saveBiometricPreference(true);
    await finishSetup();
  }

  async function onSkipBiometric() {
    await finishSetup();
  }

  if (showBiometricOptIn) {
    return (
      <View style={styles.flex}>
        <View style={styles.container}>
          <View style={styles.biometricIcon}>
            <Text style={styles.biometricIconText}>
              {biometricLabel.includes("Face") ? "\u{1F9D1}" : "\u{1F91A}"}
            </Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Enable {biometricLabel}?</Text>
            <Text style={styles.subtitle}>
              Unlock Money Shepherd faster with {biometricLabel}. You can always
              use your PIN instead.
            </Text>
          </View>

          <Pressable
            onPress={onEnableBiometric}
            disabled={isFinishing}
            style={[styles.saveBtn, isFinishing && styles.saveBtnDisabled]}
          >
            {isFinishing ? (
              <ActivityIndicator color={colors.textOnColor} />
            ) : (
              <Text style={styles.saveBtnText}>Enable {biometricLabel}</Text>
            )}
          </Pressable>

          <Pressable
            onPress={onSkipBiometric}
            disabled={isFinishing}
            style={styles.skipBtn}
          >
            <Text style={styles.skipBtnText}>Skip for now</Text>
          </Pressable>
        </View>
      </View>
    );
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
            placeholderTextColor={colors.textDisabled}
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
            placeholderTextColor={colors.textDisabled}
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
            <ActivityIndicator color={colors.textOnColor} />
          ) : (
            <Text style={styles.saveBtnText}>Set PIN</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.surface },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  header: { gap: Spacing.sm },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.extrabold, color: c.textDark },
  subtitle: { fontSize: 14, color: c.textMid, lineHeight: 20 },
  section: { gap: Spacing.sm },
  label: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: c.textDark },
  pinInput: {
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 10,
    color: c.textDark,
    textAlign: "center",
  },
  errorText: { fontSize: FontSize.small, color: c.error, marginTop: -8 },
  saveBtn: {
    backgroundColor: c.primary,
    paddingVertical: Spacing.base,
    borderRadius: Radius.xl,
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: c.textOnColor, fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  biometricIcon: {
    alignItems: "center",
  },
  biometricIconText: {
    fontSize: 48,
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  skipBtnText: {
    color: c.textMid,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});
