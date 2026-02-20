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
} from "react-native";
import { router } from "expo-router";
import { useAppStore } from "../src/store/useAppStore";
import { parseDollars } from "../src/lib/moneyInput";

type TxKind = "income" | "expense";

export default function AddTransactionScreen() {
  const state = useAppStore((s) => s.state);
  const addManualTransaction = useAppStore((s) => s.addManualTransaction);

  const accounts = state?.accounts ?? [];
  const [selectedAccountId, setSelectedAccountId] = React.useState<string>(
    accounts[0]?.id ?? "",
  );
  const [rawAmount, setRawAmount] = React.useState("");
  const [kind, setKind] = React.useState<TxKind>("expense");
  const [description, setDescription] = React.useState("");
  const [amountError, setAmountError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
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

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.row}>
          {accounts.map((acct) => (
            <Pressable
              key={acct.id}
              onPress={() => setSelectedAccountId(acct.id)}
              style={[
                styles.toggleBtn,
                selectedAccountId === acct.id && styles.toggleBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.toggleText,
                  selectedAccountId === acct.id && styles.toggleTextActive,
                ]}
              >
                {acct.name}
              </Text>
            </Pressable>
          ))}
        </View>

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
        <TextInput
          value={rawAmount}
          onChangeText={(v) => {
            setRawAmount(v);
            if (amountError) setAmountError(null);
          }}
          placeholder="e.g. 10.50"
          keyboardType="decimal-pad"
          style={[styles.input, amountError ? styles.inputError : null]}
          accessibilityLabel="Amount in dollars"
        />
        {amountError ? (
          <Text style={styles.errorText}>{amountError}</Text>
        ) : null}

        <Text style={styles.sectionLabel}>Description <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Paycheck, Groceries"
          style={styles.input}
          accessibilityLabel="Transaction description"
          returnKeyType="done"
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
