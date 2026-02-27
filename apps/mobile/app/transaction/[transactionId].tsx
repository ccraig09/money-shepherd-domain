import React from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";
import { formatMoney } from "../../src/lib/moneyFormat";
import { parseDollars, formatCents } from "../../src/lib/moneyInput";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../../src/ui/tokens";
import { useThemedStyles, useTheme } from "@/src/ui/ThemeProvider";

const MAX_NOTE_LENGTH = 200;

export default function TransactionDetailScreen() {
  const { transactionId } = useLocalSearchParams<{
    transactionId: string;
  }>();
  const state = useAppStore((s) => s.state);
  const setTransactionNote = useAppStore((s) => s.setTransactionNote);
  const unassignTransaction = useAppStore((s) => s.unassignTransaction);
  const editTransactionAction = useAppStore((s) => s.editTransaction);
  const deleteTransactionAction = useAppStore((s) => s.deleteTransaction);

  const tx = state?.transactions.find((t) => t.id === transactionId);
  const note = (transactionId && state?.transactionNotes?.[transactionId]) || "";

  const [draft, setDraft] = React.useState(note);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [unassigning, setUnassigning] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const dirty = draft.trim() !== note;

  // Edit mode state
  const [editing, setEditing] = React.useState(false);
  const [editDesc, setEditDesc] = React.useState("");
  const [editAmount, setEditAmount] = React.useState("");
  const [editError, setEditError] = React.useState("");
  const [editSaving, setEditSaving] = React.useState(false);

  const isPlaid = tx?.id.startsWith("plaid-tx-") ?? false;

  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  // Sync draft if note changes externally
  React.useEffect(() => {
    setDraft(note);
  }, [note]);

  if (!state || !transactionId || !tx) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Transaction not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const isExpense = tx.amount.cents < 0;
  const account = state.accounts.find((a) => a.id === tx.accountId);
  const assignment =
    state.inbox.assignmentsByTransactionId[transactionId];
  const envelope = assignment
    ? state.budget.envelopes.find((e) => e.id === assignment.envelopeId)
    : null;

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }

  async function handleSaveNote() {
    const trimmed = draft.trim();
    if (trimmed === note) return;
    setSaving(true);
    try {
      await setTransactionNote(transactionId!, trimmed);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function handleUnassign() {
    Alert.alert(
      "Unassign Transaction",
      "This will return the transaction to the Inbox and restore the envelope balance.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unassign",
          style: "destructive",
          onPress: async () => {
            setUnassigning(true);
            try {
              await unassignTransaction(transactionId!);
              router.back();
            } finally {
              setUnassigning(false);
            }
          },
        },
      ],
    );
  }

  function handleDelete() {
    Alert.alert(
      "Delete Transaction",
      "This will permanently remove this transaction and reverse its effects on your budget.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteTransactionAction(transactionId!);
              router.back();
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  function enterEditMode() {
    setEditDesc(tx!.description);
    setEditAmount(formatCents(Math.abs(tx!.amount.cents)));
    setEditError("");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditError("");
  }

  async function handleSaveEdit() {
    setEditError("");

    const trimmedDesc = editDesc.trim();
    if (!trimmedDesc) {
      setEditError("Description is required.");
      return;
    }

    const descChanged = trimmedDesc !== tx!.description;
    let amountCents: number | undefined;

    if (!isPlaid) {
      const parsed = parseDollars(editAmount);
      if (!parsed.ok) {
        setEditError(parsed.error);
        return;
      }
      const signedCents = isExpense ? -parsed.cents : parsed.cents;
      if (signedCents !== tx!.amount.cents) {
        amountCents = signedCents;
      }
    }

    if (!descChanged && amountCents === undefined) {
      setEditing(false);
      return;
    }

    setEditSaving(true);
    try {
      await editTransactionAction({
        transactionId: transactionId!,
        ...(descChanged ? { description: trimmedDesc } : {}),
        ...(amountCents !== undefined ? { amountCents } : {}),
      });
      setEditing(false);
    } catch (err: any) {
      setEditError(err?.message ?? "Failed to save changes.");
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{ title: tx.description || "Transaction" }}
      />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        {/* Amount */}
        <View style={styles.amountCard}>
          {editing && !isPlaid ? (
            <View style={styles.editAmountRow}>
              <Text style={[styles.amount, isExpense ? styles.expense : styles.income]}>
                {isExpense ? "-$" : "+$"}
              </Text>
              <TextInput
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="decimal-pad"
                style={[styles.editAmountInput, isExpense ? styles.expense : styles.income]}
                accessibilityLabel="Edit amount"
              />
            </View>
          ) : (
            <Text
              style={[
                styles.amount,
                isExpense ? styles.expense : styles.income,
              ]}
            >
              {isExpense ? "-" : "+"}${formatMoney(Math.abs(tx.amount.cents))}
            </Text>
          )}
          <Text style={styles.amountType}>
            {isExpense ? "Expense" : "Income"}
            {isPlaid && editing ? " (amount locked)" : ""}
          </Text>
        </View>

        {/* Details */}
        <View style={styles.detailSection}>
          {editing ? (
            <View style={styles.editDescRow}>
              <Text style={styles.detailLabel}>Description</Text>
              <TextInput
                value={editDesc}
                onChangeText={setEditDesc}
                style={styles.editDescInput}
                accessibilityLabel="Edit description"
              />
            </View>
          ) : (
            <DetailRow
              label="Description"
              value={tx.description || "Manual transaction"}
            />
          )}
          <DetailRow label="Account" value={account?.name ?? tx.accountId} />
          <DetailRow label="Date" value={formatDate(tx.postedAt)} />
          <DetailRow
            label="Envelope"
            value={
              envelope
                ? envelope.name
                : assignment
                  ? "Unknown envelope"
                  : "Unassigned"
            }
          />
        </View>

        {/* Edit error */}
        {editError ? (
          <Text style={styles.editErrorText}>{editError}</Text>
        ) : null}

        {/* Edit / Save / Cancel buttons */}
        <View style={styles.editSection}>
          {editing ? (
            <View style={styles.editBtnRow}>
              <Pressable
                onPress={cancelEdit}
                style={styles.cancelBtn}
                accessibilityRole="button"
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveEdit}
                disabled={editSaving}
                style={[styles.saveEditBtn, editSaving && styles.saveBtnDisabled]}
                accessibilityRole="button"
              >
                <Text style={styles.saveEditBtnText}>
                  {editSaving ? "Saving…" : "Save Changes"}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={enterEditMode}
              style={styles.editBtn}
              accessibilityLabel="Edit transaction"
              accessibilityRole="button"
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          )}
        </View>

        {/* Unassign action — only for assigned expenses */}
        {assignment && isExpense && !editing && (
          <View style={styles.unassignSection}>
            <Pressable
              onPress={handleUnassign}
              disabled={unassigning}
              style={[styles.unassignBtn, unassigning && styles.saveBtnDisabled]}
              accessibilityLabel="Unassign transaction"
              accessibilityRole="button"
            >
              <Text style={styles.unassignBtnText}>
                {unassigning ? "Unassigning…" : "Unassign from Envelope"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Delete — manual transactions only, hidden in edit mode */}
        {!isPlaid && !editing && (
          <View style={styles.deleteSection}>
            <Pressable
              onPress={handleDelete}
              disabled={deleting}
              style={[styles.deleteBtn, deleting && styles.saveBtnDisabled]}
              accessibilityLabel="Delete transaction"
              accessibilityRole="button"
            >
              <Text style={styles.deleteBtnText}>
                {deleting ? "Deleting…" : "Delete Transaction"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Note */}
        {!editing && (
          <View style={styles.noteSection}>
            <Text style={styles.sectionLabel}>Note</Text>
            <TextInput
              value={draft}
              onChangeText={(v) => setDraft(v.slice(0, MAX_NOTE_LENGTH))}
              placeholder="Add a note…"
              placeholderTextColor={colors.textDisabled}
              multiline
              maxLength={MAX_NOTE_LENGTH}
              onBlur={handleSaveNote}
              style={styles.noteInput}
              accessibilityLabel="Transaction note"
            />
            <View style={styles.noteFooter}>
              <Text style={styles.charCount}>
                {draft.trim().length}/{MAX_NOTE_LENGTH}
              </Text>
              {saved && !dirty && (
                <Text style={styles.savedLabel}>Saved</Text>
              )}
              {dirty && (
                <Pressable
                  onPress={handleSaveNote}
                  disabled={saving}
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                >
                  <Text style={styles.saveBtnText}>
                    {saving ? "Saving…" : "Save"}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.surface },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  errorText: { fontSize: FontSize.body, color: c.error },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  backBtnText: { fontSize: 14, color: c.textMid },
  content: { paddingBottom: Spacing.bottomPad },
  amountCard: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
    backgroundColor: c.surfaceLight,
    gap: Spacing.xs,
  },
  amount: { fontSize: 32, fontWeight: FontWeight.extrabold },
  amountType: { fontSize: FontSize.small, color: c.textMuted },
  income: { color: c.success },
  expense: { color: c.error },
  detailSection: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    gap: Spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
  },
  detailLabel: { fontSize: 14, color: c.textMuted, width: 100 },
  detailValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    color: c.textDark,
    flex: 1,
    textAlign: "right",
  },
  editSection: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
  },
  editBtn: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.primary,
    alignItems: "center" as const,
  },
  editBtnText: {
    color: c.primary,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  editBtnRow: {
    flexDirection: "row" as const,
    gap: Spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center" as const,
  },
  cancelBtnText: {
    color: c.textMid,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  saveEditBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: c.primary,
    alignItems: "center" as const,
  },
  saveEditBtnText: {
    color: c.textOnColor,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  editDescRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
    gap: Spacing.xs,
  },
  editDescInput: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.body,
    color: c.textDark,
  },
  editAmountRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  editAmountInput: {
    fontSize: 32,
    fontWeight: FontWeight.extrabold,
    minWidth: 80,
    textAlign: "center" as const,
  },
  editErrorText: {
    color: c.error,
    fontSize: FontSize.small,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },
  noteSection: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
  },
  sectionLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: c.textMid,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    fontSize: FontSize.body,
    color: c.textDark,
    minHeight: 80,
    textAlignVertical: "top",
  },
  noteFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  charCount: { fontSize: FontSize.caption, color: c.textDisabled },
  saveBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: c.primary,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: c.textOnColor, fontSize: 14, fontWeight: FontWeight.semibold },
  savedLabel: { fontSize: FontSize.caption, color: c.success, fontWeight: FontWeight.semibold },
  unassignSection: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
  },
  unassignBtn: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.error,
    alignItems: "center" as const,
  },
  unassignBtnText: {
    color: c.error,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  deleteSection: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
  },
  deleteBtn: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: c.error,
    alignItems: "center" as const,
  },
  deleteBtnText: {
    color: c.textOnColor,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});
