import React from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import type { EnvelopeType } from "@money-shepherd/domain";
import { useAppStore } from "../src/store/useAppStore";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../src/ui/tokens";
import { useThemedStyles, useTheme } from "@/src/ui/ThemeProvider";

const TYPE_OPTIONS: { value: EnvelopeType; label: string; hint: string }[] = [
  { value: "spending", label: "Spending", hint: "Day-to-day expenses" },
  { value: "giving", label: "Giving", hint: "Set aside for generosity" },
  { value: "debt", label: "Debt", hint: "Track payoff progress" },
  { value: "savings", label: "Savings", hint: "Save toward a goal" },
];

export default function CreateEnvelopeScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  const state = useAppStore((s) => s.state);
  const createEnvelope = useAppStore((s) => s.createEnvelope);
  const createEnvelopeGroup = useAppStore((s) => s.createEnvelopeGroup);

  const [name, setName] = React.useState("");
  const [selectedType, setSelectedType] = React.useState<EnvelopeType>("spending");
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [newGroupModalVisible, setNewGroupModalVisible] = React.useState(false);
  const [newGroupName, setNewGroupName] = React.useState("");

  const groups = state?.envelopeGroups ?? [];

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
      await createEnvelope(
        normalized,
        selectedType === "spending" ? undefined : selectedType,
        selectedGroupId ?? undefined,
      );
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
            const accentColor = opt.value === "giving" ? colors.giving
              : opt.value === "debt" ? colors.debt
              : opt.value === "savings" ? colors.primary
              : colors.textMid;
            const surfaceColor = opt.value === "giving" ? colors.givingSurface
              : opt.value === "debt" ? colors.debtSurface
              : opt.value === "savings" ? colors.primarySurface
              : colors.surface;
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

        {/* Group picker */}
        <Text style={styles.sectionLabel}>Group</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
          <View style={styles.groupRow}>
            <Pressable
              style={[styles.groupChip, selectedGroupId === null && styles.groupChipActive]}
              onPress={() => setSelectedGroupId(null)}
              accessibilityLabel="No group"
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedGroupId === null }}
            >
              <Text style={[styles.groupChipText, selectedGroupId === null && styles.groupChipTextActive]}>
                No group
              </Text>
            </Pressable>
            {groups.map((g) => (
              <Pressable
                key={g.id}
                style={[styles.groupChip, selectedGroupId === g.id && styles.groupChipActive]}
                onPress={() => setSelectedGroupId(g.id)}
                accessibilityLabel={`Group: ${g.name}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedGroupId === g.id }}
              >
                <Text style={[styles.groupChipText, selectedGroupId === g.id && styles.groupChipTextActive]}>
                  {g.name}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.groupChipNew}
              onPress={() => {
                setNewGroupName("");
                setNewGroupModalVisible(true);
              }}
              accessibilityLabel="Create new group"
            >
              <Text style={styles.groupChipNewText}>+ New</Text>
            </Pressable>
          </View>
        </ScrollView>

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

      {/* New group modal */}
      <Modal
        visible={newGroupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNewGroupModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setNewGroupModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>New Group</Text>
            <TextInput
              style={styles.modalInput}
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Group name"
              placeholderTextColor={colors.textSubtle}
              autoFocus
            />
            <Pressable
              onPress={async () => {
                const trimmed = newGroupName.trim().replace(/\s+/g, " ");
                if (!trimmed) return;
                await createEnvelopeGroup(trimmed);
                // Find the newly created group and select it
                const updated = useAppStore.getState().state?.envelopeGroups ?? [];
                const created = updated.find((g) => g.name === trimmed);
                if (created) setSelectedGroupId(created.id);
                setNewGroupModalVisible(false);
              }}
              style={[styles.modalSaveBtn, !newGroupName.trim() && styles.saveBtnDisabled]}
              disabled={!newGroupName.trim()}
            >
              <Text style={styles.modalSaveBtnText}>Create</Text>
            </Pressable>
            <Pressable
              onPress={() => setNewGroupModalVisible(false)}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.surface },
  container: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: c.textMid,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: Spacing.base,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.subtitle,
    color: c.textDark,
  },
  inputError: { borderColor: c.error },
  errorText: { fontSize: FontSize.small, color: c.error, marginTop: Spacing.xs },
  warningText: { fontSize: FontSize.small, color: c.warning, marginTop: Spacing.xs },

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
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  typeChipLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: c.textDark,
  },
  typeChipHint: {
    fontSize: FontSize.caption,
    color: c.textMuted,
    marginTop: 2,
  },

  // Group picker
  groupScroll: { marginBottom: Spacing.xs },
  groupRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  groupChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  groupChipActive: {
    borderColor: c.primary,
    backgroundColor: c.primarySurface,
  },
  groupChipText: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.medium,
    color: c.textMid,
  },
  groupChipTextActive: {
    color: c.primary,
    fontWeight: FontWeight.semibold,
  },
  groupChipNew: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: c.borderLight,
    borderStyle: "dashed" as const,
  },
  groupChipNewText: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: c.primary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: c.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: "85%",
    maxWidth: 360,
    gap: Spacing.md,
  },
  modalTitle: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, color: c.textDark, textAlign: "center" },
  modalInput: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.body,
    color: c.textDark,
  },
  modalSaveBtn: {
    backgroundColor: c.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  modalSaveBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: c.textOnColor },
  modalCancelBtn: {
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  modalCancelBtnText: { fontSize: FontSize.body, color: c.textMuted },

  saveBtn: {
    marginTop: Spacing.lg,
    backgroundColor: c.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: c.textOnColor, fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  cancelBtn: {
    marginTop: Spacing.md,
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  cancelText: { fontSize: FontSize.body, color: c.textMuted },
});
