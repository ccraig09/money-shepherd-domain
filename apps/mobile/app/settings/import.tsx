import React from "react";
import {
  Text,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";
import { validateImport } from "../../src/domain/importData";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../../src/ui/tokens";

export default function ImportScreen() {
  const importState = useAppStore((s) => s.importState);

  const [json, setJson] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  function handleValidate() {
    setError(null);

    const trimmed = json.trim();
    if (!trimmed) {
      setError("Please paste your export JSON above.");
      return;
    }

    const result = validateImport(trimmed);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    Alert.alert(
      "Import Data",
      `This will overwrite all local data with the imported backup (household: ${result.state.householdId}). This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Import",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await importState(result.state);
              router.back();
            } catch {
              setError("Import failed. Please try again.");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Import Data</Text>
        <Text style={styles.hint}>
          Paste the JSON from a previous export below. This will replace all
          local data.
        </Text>

        <TextInput
          style={styles.input}
          value={json}
          onChangeText={(t) => {
            setJson(t);
            if (error) setError(null);
          }}
          placeholder='Paste export JSON here…'
          placeholderTextColor={Color.textSubtle}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={handleValidate}
          disabled={busy || !json.trim()}
          style={[
            styles.importBtn,
            (busy || !json.trim()) && styles.importBtnDisabled,
          ]}
          accessibilityLabel="Validate and import"
        >
          <Text style={styles.importBtnText}>
            {busy ? "Importing…" : "Validate & Import"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          style={styles.cancelBtn}
          accessibilityLabel="Cancel"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: Color.surface },
  content: {
    padding: Spacing.lg,
    paddingTop: 60,
    gap: Spacing.base,
    paddingBottom: Spacing.bottomPad,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.extrabold,
    color: Color.textDark,
  },
  hint: {
    fontSize: FontSize.body,
    color: Color.textMid,
    lineHeight: 20,
  },
  input: {
    minHeight: 200,
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    fontSize: FontSize.caption,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Color.textDark,
    backgroundColor: Color.surfaceLight,
  },
  error: {
    fontSize: FontSize.body,
    color: Color.error,
    fontWeight: FontWeight.medium,
  },
  importBtn: {
    backgroundColor: Color.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  importBtnDisabled: { opacity: 0.4 },
  importBtnText: {
    color: Color.textOnColor,
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
  },
  cancelBtn: { alignItems: "center", paddingVertical: Spacing.sm },
  cancelText: { fontSize: FontSize.body, color: Color.textMuted },
});
