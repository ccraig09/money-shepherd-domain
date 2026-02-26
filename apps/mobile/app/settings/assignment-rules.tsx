import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { useAppStore } from "../../src/store/useAppStore";
import { HelpTooltip } from "../../src/ui/components/HelpTooltip";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../../src/ui/tokens";
import type { AssignmentRule } from "@money-shepherd/domain";

export default function AssignmentRulesScreen() {
  const state = useAppStore((s) => s.state);
  const addRule = useAppStore((s) => s.addAssignmentRule);
  const removeRule = useAppStore((s) => s.removeAssignmentRule);
  const reorderRules = useAppStore((s) => s.reorderAssignmentRules);

  const [showForm, setShowForm] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<AssignmentRule | null>(null);
  const [pattern, setPattern] = React.useState("");
  const [matchType, setMatchType] = React.useState<"contains" | "exact">("contains");
  const [selectedEnvelopeId, setSelectedEnvelopeId] = React.useState<string | null>(null);

  if (!state) return null;

  const rules = state.assignmentRules ?? [];
  const envelopes = state.budget.envelopes;

  function envelopeName(envelopeId: string): string {
    return envelopes.find((e) => e.id === envelopeId)?.name ?? envelopeId;
  }

  function openAddForm() {
    setEditingRule(null);
    setPattern("");
    setMatchType("contains");
    setSelectedEnvelopeId(null);
    setShowForm(true);
  }

  function openEditForm(rule: AssignmentRule) {
    setEditingRule(rule);
    setPattern(rule.pattern);
    setMatchType(rule.matchType);
    setSelectedEnvelopeId(rule.envelopeId);
    setShowForm(true);
  }

  async function handleSave() {
    if (!pattern.trim() || !selectedEnvelopeId) return;

    if (editingRule) {
      await removeRule(editingRule.id);
    }
    const priority = editingRule?.priority ?? rules.length + 1;
    await addRule({ pattern: pattern.trim(), matchType, envelopeId: selectedEnvelopeId, priority });
    setShowForm(false);
  }

  function handleDelete(rule: AssignmentRule) {
    Alert.alert("Delete Rule", `Remove rule "${rule.pattern}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeRule(rule.id) },
    ]);
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return;
    const ids = rules.map((r) => r.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    await reorderRules(ids);
  }

  async function handleMoveDown(index: number) {
    if (index >= rules.length - 1) return;
    const ids = rules.map((r) => r.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    await reorderRules(ids);
  }

  if (showForm) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.formContainer}>
        <Text style={styles.formTitle}>
          {editingRule ? "Edit Rule" : "New Rule"}
        </Text>

        <Text style={styles.label}>Pattern</Text>
        <TextInput
          style={styles.input}
          value={pattern}
          onChangeText={setPattern}
          placeholder="e.g. walmart, starbucks"
          placeholderTextColor={Color.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Match Type</Text>
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, matchType === "contains" && styles.toggleBtnActive]}
            onPress={() => setMatchType("contains")}
          >
            <Text style={[styles.toggleText, matchType === "contains" && styles.toggleTextActive]}>
              Contains
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, matchType === "exact" && styles.toggleBtnActive]}
            onPress={() => setMatchType("exact")}
          >
            <Text style={[styles.toggleText, matchType === "exact" && styles.toggleTextActive]}>
              Exact
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Assign to Envelope</Text>
        <FlatList
          data={envelopes}
          keyExtractor={(e) => e.id}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedEnvelopeId;
            return (
              <Pressable
                style={[styles.envelopeOption, isSelected && styles.envelopeOptionSelected]}
                onPress={() => setSelectedEnvelopeId(item.id)}
              >
                <Text style={[styles.envelopeOptionText, isSelected && styles.envelopeOptionTextSelected]}>
                  {item.name}
                </Text>
              </Pressable>
            );
          }}
        />

        <View style={styles.formActions}>
          <Pressable
            style={[styles.saveBtn, (!pattern.trim() || !selectedEnvelopeId) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!pattern.trim() || !selectedEnvelopeId}
          >
            <Text style={styles.saveBtnText}>
              {editingRule ? "Update Rule" : "Add Rule"}
            </Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={() => setShowForm(false)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.subtitle}>
            Rules override payee memorization. Higher = checked first.
          </Text>
          <HelpTooltip
            title="How Suggestions Work"
            body={
              "Money Shepherd suggests envelopes two ways:\n\n" +
              "1. Memorization (automatic) — When you assign a transaction, the app remembers that payee. " +
              "Next time the same merchant appears, it suggests the same envelope.\n\n" +
              "2. Rules (this screen) — You create patterns like \"walmart\" or \"amazon\" that match " +
              "transactions and suggest an envelope. Rules override memorization.\n\n" +
              "Example: A \"contains walmart\" rule catches WALMART #1234, WALMART SUPERCENTER, " +
              "and WALMART GROCERY — all suggesting your Groceries envelope."
            }
          />
        </View>
      </View>

      {rules.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No rules yet.</Text>
          <Text style={styles.emptyHint}>
            Rules auto-suggest envelopes for transactions matching a pattern.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rules.sort((a, b) => a.priority - b.priority)}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <View style={styles.ruleRow}>
              <View style={styles.ruleReorder}>
                <Pressable
                  onPress={() => handleMoveUp(index)}
                  disabled={index === 0}
                  hitSlop={4}
                  style={index === 0 ? styles.reorderDisabled : undefined}
                >
                  <Text style={styles.reorderText}>▲</Text>
                </Pressable>
                <Text style={styles.priorityText}>{item.priority}</Text>
                <Pressable
                  onPress={() => handleMoveDown(index)}
                  disabled={index === rules.length - 1}
                  hitSlop={4}
                  style={index === rules.length - 1 ? styles.reorderDisabled : undefined}
                >
                  <Text style={styles.reorderText}>▼</Text>
                </Pressable>
              </View>
              <Pressable style={styles.ruleMain} onPress={() => openEditForm(item)}>
                <Text style={styles.rulePattern} numberOfLines={1}>
                  {item.matchType === "exact" ? `"${item.pattern}"` : `*${item.pattern}*`}
                </Text>
                <Text style={styles.ruleEnvelope} numberOfLines={1}>
                  → {envelopeName(item.envelopeId)}
                </Text>
              </Pressable>
              <Pressable onPress={() => handleDelete(item)} hitSlop={8} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>✕</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      <View style={styles.footer}>
        <Pressable style={styles.addBtn} onPress={openAddForm}>
          <Text style={styles.addBtnText}>+ Add Rule</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Color.surface },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.border,
    gap: Spacing.xs,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  subtitle: { fontSize: FontSize.caption, color: Color.textMuted },
  empty: { padding: Spacing.xl, alignItems: "center", gap: Spacing.sm },
  emptyText: { fontSize: FontSize.subtitle, fontWeight: FontWeight.semibold, color: Color.textMid },
  emptyHint: { fontSize: FontSize.body, color: Color.textMuted, textAlign: "center" },
  list: { paddingVertical: Spacing.sm },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
    gap: Spacing.sm,
  },
  ruleReorder: { alignItems: "center", gap: 2, width: 28 },
  reorderText: { fontSize: 12, color: Color.textMuted },
  reorderDisabled: { opacity: 0.3 },
  priorityText: { fontSize: FontSize.caption, fontWeight: FontWeight.bold, color: Color.textMid },
  ruleMain: { flex: 1, gap: 2 },
  rulePattern: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Color.textDark },
  ruleEnvelope: { fontSize: FontSize.caption, color: Color.primary },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.surfaceLight,
  },
  deleteBtnText: { fontSize: FontSize.body, color: Color.error },
  footer: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
  },
  addBtn: {
    backgroundColor: Color.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  addBtnText: { color: Color.textOnColor, fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },

  // Form styles
  formContainer: { padding: Spacing.base, paddingTop: 60, gap: Spacing.md, paddingBottom: Spacing.bottomPad },
  formTitle: { fontSize: FontSize.title, fontWeight: FontWeight.bold, color: Color.textDark },
  label: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Color.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.body,
    color: Color.textDark,
    backgroundColor: Color.surfaceLight,
  },
  toggleRow: { flexDirection: "row", gap: Spacing.sm },
  toggleBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.border,
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: Color.primarySurface,
    borderColor: Color.primary,
  },
  toggleText: { fontSize: FontSize.body, color: Color.textMid, fontWeight: FontWeight.medium },
  toggleTextActive: { color: Color.primary, fontWeight: FontWeight.bold },
  envelopeOption: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
  },
  envelopeOptionSelected: { backgroundColor: Color.primarySurface },
  envelopeOptionText: { fontSize: FontSize.body, color: Color.textDark },
  envelopeOptionTextSelected: { color: Color.primary, fontWeight: FontWeight.bold },
  formActions: { gap: Spacing.sm, marginTop: Spacing.md },
  saveBtn: {
    backgroundColor: Color.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: Color.textOnColor, fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  cancelBtn: { alignItems: "center", paddingVertical: Spacing.sm },
  cancelBtnText: { fontSize: FontSize.body, color: Color.textMuted },
});
