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
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";
import { formatMoney } from "../../src/lib/moneyFormat";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../../src/ui/tokens";

const MAX_NOTE_LENGTH = 200;

export default function TransactionDetailScreen() {
  const { transactionId } = useLocalSearchParams<{
    transactionId: string;
  }>();
  const state = useAppStore((s) => s.state);
  const setTransactionNote = useAppStore((s) => s.setTransactionNote);

  const tx = state?.transactions.find((t) => t.id === transactionId);
  const note = (transactionId && state?.transactionNotes?.[transactionId]) || "";

  const [draft, setDraft] = React.useState(note);
  const [saving, setSaving] = React.useState(false);
  const dirty = draft.trim() !== note;

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
    } finally {
      setSaving(false);
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
          <Text
            style={[
              styles.amount,
              isExpense ? styles.expense : styles.income,
            ]}
          >
            {isExpense ? "-" : "+"}${formatMoney(Math.abs(tx.amount.cents))}
          </Text>
          <Text style={styles.amountType}>
            {isExpense ? "Expense" : "Income"}
          </Text>
        </View>

        {/* Details */}
        <View style={styles.detailSection}>
          <DetailRow
            label="Description"
            value={tx.description || "Manual transaction"}
          />
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

        {/* Note */}
        <View style={styles.noteSection}>
          <Text style={styles.sectionLabel}>Note</Text>
          <TextInput
            value={draft}
            onChangeText={(v) => setDraft(v.slice(0, MAX_NOTE_LENGTH))}
            placeholder="Add a note…"
            placeholderTextColor={Color.textDisabled}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
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
  errorText: { fontSize: FontSize.body, color: Color.error },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.border,
  },
  backBtnText: { fontSize: 14, color: Color.textMid },
  content: { paddingBottom: Spacing.bottomPad },
  amountCard: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
    backgroundColor: Color.surfaceLight,
    gap: Spacing.xs,
  },
  amount: { fontSize: 32, fontWeight: FontWeight.extrabold },
  amountType: { fontSize: FontSize.small, color: Color.textMuted },
  income: { color: Color.success },
  expense: { color: Color.error },
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
    borderColor: Color.borderLight,
  },
  detailLabel: { fontSize: 14, color: Color.textMuted, width: 100 },
  detailValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    color: Color.textDark,
    flex: 1,
    textAlign: "right",
  },
  noteSection: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
  },
  sectionLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: Color.textMid,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    fontSize: FontSize.body,
    color: Color.textDark,
    minHeight: 80,
    textAlignVertical: "top",
  },
  noteFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  charCount: { fontSize: FontSize.caption, color: Color.textDisabled },
  saveBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Color.primary,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Color.textOnColor, fontSize: 14, fontWeight: FontWeight.semibold },
});
