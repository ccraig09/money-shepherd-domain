import React from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Keyboard,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAppStore } from "../src/store/useAppStore";
import { parseDollars } from "../src/lib/moneyInput";
import { formatMoney } from "../src/lib/moneyFormat";
import { MoneyInput } from "../src/ui/components/MoneyInput";
import { buildAccountPickerList } from "../src/lib/accountStatus";
import { loadPlaidTokens, type PlaidTokenData } from "../src/infra/local/secureTokens";
import { loadSyncMeta } from "../src/infra/local/syncMeta";

type TxKind = "income" | "expense";

export default function AddTransactionScreen() {
  const { kind: kindParam } = useLocalSearchParams<{ kind?: string }>();
  const state = useAppStore((s) => s.state);
  const addManualTransaction = useAppStore((s) => s.addManualTransaction);

  const accounts = React.useMemo(() => state?.accounts ?? [], [state?.accounts]);
  const [tokens, setTokens] = React.useState<PlaidTokenData[]>([]);

  React.useEffect(() => {
    loadSyncMeta().then((meta) => {
      if (meta?.userId) {
        loadPlaidTokens(meta.userId).then(setTokens);
      }
    });
  }, []);

  const pickerItems = React.useMemo(
    () => buildAccountPickerList(accounts, tokens),
    [accounts, tokens],
  );

  const [selectedAccountId, setSelectedAccountId] = React.useState<string>(
    accounts[0]?.id ?? "",
  );
  const [accountPickerOpen, setAccountPickerOpen] = React.useState(false);
  const descriptionRef = React.useRef<TextInput>(null);

  const [rawAmount, setRawAmount] = React.useState("");
  const [kind, setKind] = React.useState<TxKind>(
    kindParam === "income" ? "income" : "expense",
  );
  const [description, setDescription] = React.useState("");
  const [amountError, setAmountError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    Keyboard.dismiss();
    setAmountError(null);

    const parsed = parseDollars(rawAmount);
    if (!parsed.ok) {
      setAmountError(parsed.error);
      return;
    }
    if (parsed.cents === 0) {
      setAmountError("Amount must be greater than zero.");
      return;
    }
    if (!selectedAccountId) {
      return;
    }

    const amountCents = kind === "expense" ? -parsed.cents : parsed.cents;
    const desc = description.trim() || "Manual transaction";

    setSaving(true);
    try {
      await addManualTransaction({
        accountId: selectedAccountId,
        amountCents,
        description: desc,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const parsedPreview = parseDollars(rawAmount);
  const previewCents =
    parsedPreview.ok && parsedPreview.cents > 0
      ? kind === "expense"
        ? -parsedPreview.cents
        : parsedPreview.cents
      : null;
  const previewLabel =
    previewCents !== null
      ? `${previewCents > 0 ? "+" : "-"}$${formatMoney(Math.abs(previewCents))}`
      : `${kind === "expense" ? "-" : "+"}$0.00`;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Account</Text>
        <Pressable
          style={styles.selectField}
          onPress={() => setAccountPickerOpen(true)}
          accessibilityLabel="Select account"
        >
          <Text style={styles.selectFieldText} numberOfLines={1}>
            {(() => {
              const item = pickerItems.find((i) => i.account.id === selectedAccountId);
              if (!item) return "Select an account";
              const suffix = item.isPlaid && !item.isConnected ? " (Disconnected)" : "";
              return item.account.name + suffix;
            })()}
          </Text>
          <Text style={styles.selectChevron}>›</Text>
        </Pressable>

        <Modal
          visible={accountPickerOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setAccountPickerOpen(false)}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Account</Text>
            <Pressable onPress={() => setAccountPickerOpen(false)} hitSlop={12}>
              <Text style={styles.modalClose}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={pickerItems}
            keyExtractor={(i) => i.account.id}
            renderItem={({ item }) => {
              const isSelected = item.account.id === selectedAccountId;
              const isDisconnected = item.isPlaid && !item.isConnected;
              return (
                <Pressable
                  style={[
                    styles.modalRow,
                    isSelected && styles.modalRowSelected,
                  ]}
                  onPress={() => {
                    setSelectedAccountId(item.account.id);
                    setAccountPickerOpen(false);
                  }}
                >
                  <View style={styles.modalRowContent}>
                    <Text
                      style={[
                        styles.modalRowText,
                        isSelected && styles.modalRowTextSelected,
                        isDisconnected && styles.modalRowTextDisconnected,
                      ]}
                      numberOfLines={1}
                    >
                      {item.account.name}
                    </Text>
                    {isDisconnected && (
                      <Text style={styles.disconnectedLabel}>Disconnected</Text>
                    )}
                  </View>
                  {isSelected && (
                    <Text style={styles.modalCheck}>✓</Text>
                  )}
                </Pressable>
              );
            }}
          />
        </Modal>

        <Text style={styles.sectionLabel}>Type</Text>
        <View style={styles.row}>
          <Pressable
            onPress={() => setKind("income")}
            style={[
              styles.toggleBtn,
              kind === "income" && styles.incomeActive,
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                kind === "income" && styles.incomeText,
              ]}
            >
              Income
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setKind("expense")}
            style={[
              styles.toggleBtn,
              kind === "expense" && styles.expenseActive,
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                kind === "expense" && styles.expenseText,
              ]}
            >
              Expense
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Amount</Text>
        <MoneyInput
          value={rawAmount}
          onChangeText={setRawAmount}
          error={amountError}
          onErrorClear={() => setAmountError(null)}
          accessibilityLabel="Amount in dollars"
          returnKeyType="next"
          onSubmitEditing={() => descriptionRef.current?.focus()}
        />

        <Text
          style={[
            styles.preview,
            previewCents !== null
              ? kind === "expense"
                ? styles.previewExpense
                : styles.previewIncome
              : styles.previewMuted,
          ]}
          accessibilityLabel={`Preview: ${previewLabel}`}
        >
          {previewLabel}
        </Text>

        <Text style={styles.sectionLabel}>Description <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          ref={descriptionRef}
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Paycheck, Groceries"
          style={styles.input}
          accessibilityLabel="Transaction description"
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          accessibilityLabel="Save transaction"
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  container: {
    padding: 20,
    gap: 8,
    paddingBottom: 40,
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
  optional: { fontWeight: "400", textTransform: "none", color: "#999" },
  row: { flexDirection: "row", gap: 10 },
  selectField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#fff",
  },
  selectFieldText: { fontSize: 16, color: "#111", flex: 1 },
  selectChevron: { fontSize: 20, color: "#bbb", marginLeft: 8 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#111" },
  modalClose: { fontSize: 16, color: "#4f8ef7", fontWeight: "600" },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#eee",
  },
  modalRowSelected: { backgroundColor: "#edf3fe" },
  modalRowContent: { flex: 1 },
  modalRowText: { fontSize: 16, color: "#111" },
  modalRowTextSelected: { color: "#4f8ef7", fontWeight: "600" },
  modalRowTextDisconnected: { color: "#aaa" },
  disconnectedLabel: { fontSize: 12, color: "#bbb", marginTop: 2 },
  modalCheck: { fontSize: 16, color: "#4f8ef7", marginLeft: 8 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  toggleBtnActive: {
    borderColor: "#4f8ef7",
    backgroundColor: "#edf3fe",
  },
  toggleText: { fontSize: 15, color: "#555" },
  toggleTextActive: { color: "#4f8ef7", fontWeight: "600" },
  incomeActive: { borderColor: "#2d9e6b", backgroundColor: "#edfaf3" },
  incomeText: { color: "#2d9e6b", fontWeight: "600" },
  expenseActive: { borderColor: "#d94f4f", backgroundColor: "#fdeaea" },
  expenseText: { color: "#d94f4f", fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111",
  },
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
  preview: { textAlign: "center", fontSize: 28, fontWeight: "800", marginVertical: 8 },
  previewMuted: { color: "#ccc" },
  previewIncome: { color: "#2d9e6b" },
  previewExpense: { color: "#d94f4f" },
});
