import React from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useAppStore } from "../src/store/useAppStore";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../src/ui/tokens";

export default function CreateEnvelopeScreen() {
  const state = useAppStore((s) => s.state);
  const createEnvelope = useAppStore((s) => s.createEnvelope);

  const [name, setName] = React.useState("");
  const [isGiving, setIsGiving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    const normalized = name.trim().replace(/\s+/g, " ");

    if (!normalized) {
      setError("Name is required.");
      return;
    }

    const duplicate = state?.budget.envelopes.find(
      (e) => e.name.toLowerCase() === normalized.toLowerCase(),
    );
    if (duplicate) {
      setError(`An envelope named "${duplicate.name}" already exists.`);
      return;
    }

    setSaving(true);
    try {
      await createEnvelope(normalized, isGiving ? "giving" : undefined);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.sectionLabel}>Envelope name</Text>
        <TextInput
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (error) setError(null);
          }}
          placeholder="e.g. Groceries, Bills, Gas"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
          style={[styles.input, error ? styles.inputError : null]}
          accessibilityLabel="Envelope name"
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Giving toggle */}
        <Pressable
          style={[styles.givingToggle, isGiving && styles.givingToggleActive]}
          onPress={() => setIsGiving(!isGiving)}
          accessibilityLabel="Mark as giving envelope"
          accessibilityRole="switch"
          accessibilityState={{ checked: isGiving }}
        >
          <View style={styles.givingToggleContent}>
            <Text style={[styles.givingLabel, isGiving && styles.givingLabelActive]}>
              Giving
            </Text>
            <Text style={[styles.givingHint, isGiving && styles.givingHintActive]}>
              Set aside for generosity
            </Text>
          </View>
          <View style={[styles.toggleDot, isGiving && styles.toggleDotActive]} />
        </Pressable>

        <Pressable
          onPress={handleSave}
          disabled={saving || !name.trim()}
          style={[styles.saveBtn, (saving || !name.trim()) && styles.saveBtnDisabled]}
          accessibilityLabel="Save envelope"
        >
          <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          style={styles.cancelBtn}
          accessibilityLabel="Cancel"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Color.surface },
  container: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: Color.textMid,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: Spacing.base,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.subtitle,
    color: Color.textDark,
  },
  inputError: { borderColor: Color.error },
  errorText: { fontSize: FontSize.small, color: Color.error, marginTop: Spacing.xs },

  // Giving toggle
  givingToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    padding: Spacing.base,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.border,
    backgroundColor: Color.surface,
  },
  givingToggleActive: {
    borderColor: Color.giving,
    backgroundColor: Color.givingSurface,
  },
  givingToggleContent: { flex: 1 },
  givingLabel: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.semibold,
    color: Color.textDark,
  },
  givingLabelActive: { color: Color.giving },
  givingHint: {
    fontSize: FontSize.small,
    color: Color.textMuted,
    marginTop: 2,
  },
  givingHintActive: { color: Color.giving },
  toggleDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Color.border,
    marginLeft: Spacing.md,
  },
  toggleDotActive: {
    borderColor: Color.giving,
    backgroundColor: Color.giving,
  },

  saveBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Color.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Color.textOnColor, fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  cancelBtn: {
    marginTop: Spacing.md,
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  cancelText: { fontSize: FontSize.body, color: Color.textMuted },
});
