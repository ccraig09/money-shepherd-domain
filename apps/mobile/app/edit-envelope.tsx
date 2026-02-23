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
import { router, useLocalSearchParams } from "expo-router";
import { useAppStore } from "../src/store/useAppStore";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../src/ui/tokens";

export default function EditEnvelopeScreen() {
  const { envelopeId } = useLocalSearchParams<{ envelopeId: string }>();
  const state = useAppStore((s) => s.state);
  const renameEnvelope = useAppStore((s) => s.renameEnvelope);

  const envelope = state?.budget.envelopes.find((e) => e.id === envelopeId);

  const [name, setName] = React.useState(envelope?.name ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  if (!state || !envelope) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Envelope not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  async function handleSave() {
    const normalized = name.trim().replace(/\s+/g, " ");

    if (!normalized) {
      setError("Name is required.");
      return;
    }

    // No-op if unchanged
    if (normalized === envelope!.name) {
      router.back();
      return;
    }

    const duplicate = state!.budget.envelopes.find(
      (e) =>
        e.id !== envelopeId &&
        e.name.toLowerCase() === normalized.toLowerCase(),
    );
    if (duplicate) {
      setError(`An envelope named "${duplicate.name}" already exists.`);
      return;
    }

    setSaving(true);
    try {
      await renameEnvelope(envelopeId!, normalized);
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

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          accessibilityLabel="Save envelope name"
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving…" : "Save"}
          </Text>
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
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
  backBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.border,
  },
  backBtnText: { fontSize: FontSize.body, color: Color.textMid },
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
