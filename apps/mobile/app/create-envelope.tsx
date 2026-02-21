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

export default function CreateEnvelopeScreen() {
  const state = useAppStore((s) => s.state);
  const createEnvelope = useAppStore((s) => s.createEnvelope);

  const [name, setName] = React.useState("");
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
      await createEnvelope(normalized);
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
  flex: { flex: 1, backgroundColor: "#fff" },
  container: {
    padding: 20,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111",
  },
  inputError: { borderColor: "#d94f4f" },
  errorText: { fontSize: 13, color: "#d94f4f", marginTop: 4 },
  saveBtn: {
    marginTop: 24,
    backgroundColor: "#4f8ef7",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelBtn: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 10,
  },
  cancelText: { fontSize: 15, color: "#888" },
});
