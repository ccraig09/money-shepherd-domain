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
  ScrollView,
} from "react-native";
import { saveSyncMeta } from "../../src/infra/local/syncMeta";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppStore } from "../../src/store/useAppStore";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../../src/ui/tokens";
import { useThemedStyles, useTheme } from "@/src/ui/ThemeProvider";

const HOUSEHOLD_ID = "household-los-jackia";
const PIN_KEY_PREFIX = "ms_pin_hash_v1:";

/** Not cryptographic — stores a simple hash to avoid plaintext PIN on device. */
function simpleHash(pin: string): string {
  let h = 0;
  for (let i = 0; i < pin.length; i++) h = (h * 31 + pin.charCodeAt(i)) >>> 0;
  return String(h);
}

type UserChoice = "user-los" | "user-jackia";

const USERS: { id: UserChoice; label: string }[] = [
  { id: "user-los", label: "Los" },
  { id: "user-jackia", label: "Jackia" },
];

export default function SetupScreen() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const setGuardReady = useAppStore((s) => s.setGuardReady);

  const [userId, setUserId] = React.useState<UserChoice>("user-los");
  const [pin, setPin] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  async function onSave() {
    const trimmed = pin.trim();

    if (!/^\d{4}$/.test(trimmed)) {
      setError("PIN must be exactly 4 digits (e.g. 1234).");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const pinHash = simpleHash(trimmed);

      // Store per-user PIN hash locally (device only)
      await AsyncStorage.setItem(PIN_KEY_PREFIX + userId, pinHash);

      // Persist device identity + expected remote revision
      await saveSyncMeta({
        householdId: HOUSEHOLD_ID,
        rev: 0,
        userId,
      });

      setPin("");
      await bootstrap();
      setGuardReady();
    } catch (err: any) {
      setError("Failed to save setup. Please try again.");
      console.error("[SetupScreen] onSave error:", err);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Money Shepherd</Text>
          <Text style={styles.subtitle}>
            Set up this device so we know who is using it and how to sync your
            household data.
          </Text>
        </View>

        {/* User picker */}
        <View style={styles.section}>
          <Text style={styles.label}>Who is using this device?</Text>
          <View style={styles.userRow}>
            {USERS.map((u) => {
              const selected = userId === u.id;
              return (
                <Pressable
                  key={u.id}
                  onPress={() => setUserId(u.id)}
                  style={[styles.userBtn, selected && styles.userBtnSelected]}
                >
                  <Text
                    style={[
                      styles.userBtnText,
                      selected && styles.userBtnTextSelected,
                    ]}
                  >
                    {u.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* PIN field */}
        <View style={styles.section}>
          <Text style={styles.label}>4-digit PIN</Text>
          <Text style={styles.hint}>
            Used to lock this device. Not connected to Firebase.
          </Text>
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
          />
        </View>

        {/* Inline error */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Save button */}
        <Pressable
          onPress={onSave}
          disabled={isSaving}
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.textOnColor} />
          ) : (
            <Text style={styles.saveBtnText}>Save and continue</Text>
          )}
        </Pressable>

        {/* Footer metadata */}
        <Text style={styles.meta}>Household: {HOUSEHOLD_ID}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.surface },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  header: { gap: Spacing.sm },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.extrabold, color: c.textDark },
  subtitle: { fontSize: 14, color: c.textMid, lineHeight: 20 },
  section: { gap: Spacing.sm },
  label: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: c.textDark },
  hint: { fontSize: FontSize.caption, color: c.textMuted },
  userRow: { flexDirection: "row", gap: Spacing.md },
  userBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: c.border,
    alignItems: "center",
  },
  userBtnSelected: {
    borderColor: c.primary,
    backgroundColor: c.primarySurface,
  },
  userBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: c.textMuted },
  userBtnTextSelected: { color: c.primary },
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
  errorText: {
    fontSize: FontSize.small,
    color: c.error,
    marginTop: -8,
  },
  saveBtn: {
    backgroundColor: c.primary,
    paddingVertical: Spacing.base,
    borderRadius: Radius.xl,
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: c.textOnColor, fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  meta: {
    fontSize: 11,
    color: c.textSubtle,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
});
