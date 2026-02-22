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
            placeholderTextColor="#aaa"
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
  flex: { flex: 1, backgroundColor: "#fff" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorText: { fontSize: 15, color: "#d94f4f" },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  backBtnText: { fontSize: 14, color: "#555" },
  content: { paddingBottom: 40 },
  amountCard: {
    alignItems: "center",
    paddingVertical: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#eee",
    backgroundColor: "#f9f9f9",
    gap: 4,
  },
  amount: { fontSize: 32, fontWeight: "800" },
  amountType: { fontSize: 13, color: "#888" },
  income: { color: "#2d9e6b" },
  expense: { color: "#d94f4f" },
  detailSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#f0f0f0",
  },
  detailLabel: { fontSize: 14, color: "#888", width: 100 },
  detailValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#111",
    flex: 1,
    textAlign: "right",
  },
  noteSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: "#111",
    minHeight: 80,
    textAlignVertical: "top",
  },
  noteFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  charCount: { fontSize: 12, color: "#aaa" },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#4f8ef7",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
