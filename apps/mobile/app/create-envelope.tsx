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
import type { EnvelopeType } from "@money-shepherd/domain";
import { useAppStore } from "../src/store/useAppStore";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../src/ui/tokens";

const TYPE_OPTIONS: { value: EnvelopeType; label: string; hint: string }[] = [
  { value: "spending", label: "Spending", hint: "Day-to-day expenses" },
  { value: "giving", label: "Giving", hint: "Set aside for generosity" },
  { value: "debt", label: "Debt", hint: "Track payoff progress" },
  { value: "savings", label: "Savings", hint: "Save toward a goal" },
];

export default function CreateEnvelopeScreen() {
  const state = useAppStore((s) => s.state);
  const createEnvelope = useAppStore((s) => s.createEnvelope);

  const [name, setName] = React.useState("");
  const [selectedType, setSelectedType] = React.useState<EnvelopeType>("spending");
  const [error, setError] = React.useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = React.useState<string | null>(null);
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
      await createEnvelope(normalized, selectedType === "spending" ? undefined : selectedType);
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
            const normalized = v.trim().replace(/\s+/g, " ");
            const dup = normalized
              ? state?.budget.envelopes.find(
                  (e) => e.name.toLowerCase() === normalized.toLowerCase(),
                )
              : null;
            setDuplicateWarning(dup ? `An envelope named "${dup.name}" already exists` : null);
          }}
          placeholder="e.g. Groceries, Bills, Gas"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
          style={[styles.input, error ? styles.inputError : null]}
          accessibilityLabel="Envelope name"
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!error && duplicateWarning ? <Text style={styles.warningText}>{duplicateWarning}</Text> : null}

        {/* Type picker */}
        <Text style={styles.sectionLabel}>Type</Text>
        <View style={styles.typeRow}>
          {TYPE_OPTIONS.map((opt) => {
            const active = selectedType === opt.value;
            const accentColor = opt.value === "giving" ? Color.giving
              : opt.value === "debt" ? Color.debt
              : opt.value === "savings" ? Color.primary
              : Color.textMid;
            const surfaceColor = opt.value === "giving" ? Color.givingSurface
              : opt.value === "debt" ? Color.debtSurface
              : opt.value === "savings" ? Color.primarySurface
              : Color.surface;
            return (
              <Pressable
                key={opt.value}
                style={[
                  styles.typeChip,
                  active && { borderColor: accentColor, backgroundColor: surfaceColor },
                ]}
                onPress={() => setSelectedType(opt.value)}
                accessibilityLabel={`${opt.label} envelope type`}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.typeChipLabel, active && { color: accentColor }]}>
                  {opt.label}
                </Text>
                <Text style={[styles.typeChipHint, active && { color: accentColor }]}>
                  {opt.hint}
                </Text>
              </Pressable>
            );
          })}
        </View>

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
  warningText: { fontSize: FontSize.small, color: Color.warning, marginTop: Spacing.xs },

  // Type picker
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  typeChip: {
    flexBasis: "47%",
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.border,
    backgroundColor: Color.surface,
  },
  typeChipLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Color.textDark,
  },
  typeChipHint: {
    fontSize: FontSize.caption,
    color: Color.textMuted,
    marginTop: 2,
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
