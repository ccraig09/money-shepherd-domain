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
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../src/ui/tokens";
import { useThemedStyles, useTheme } from "@/src/ui/ThemeProvider";

type TxKind = "income" | "expense";

export default function AddTransactionScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  const { kind: kindParam } = useLocalSearchParams<{ kind?: string }>();
  const state = useAppStore((s) => s.state);
  const addManualTransaction = useAppStore((s) => s.addManualTransaction);

  const accounts = React.useMemo(() => state?.accounts ?? [], [state?.accounts]);
  const [tokens, setTokens] = React.useState<PlaidTokenData[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadSyncMeta().then((meta) => {
      if (meta?.userId) {
        setCurrentUserId(meta.userId);
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
        ...(currentUserId ? { createdByUserId: currentUserId } : {}),
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
            <Pressable
              onPress={() => setAccountPickerOpen(false)}
              hitSlop={12}
              accessibilityLabel="Close account picker"
              accessibilityRole="button"
            >
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
                  accessibilityLabel={`${item.account.name}${isDisconnected ? ", disconnected" : ""}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
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
            accessibilityLabel="Income"
            accessibilityRole="button"
            accessibilityState={{ selected: kind === "income" }}
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
            accessibilityLabel="Expense"
            accessibilityRole="button"
            accessibilityState={{ selected: kind === "expense" }}
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
          placeholder="e.g. Paycheck, Walmart, Gas"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel="Transaction description"
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        <Pressable
          onPress={handleSave}
          disabled={saving || !selectedAccountId || !(parsedPreview.ok && parsedPreview.cents > 0)}
          style={[styles.saveBtn, (saving || !selectedAccountId || !(parsedPreview.ok && parsedPreview.cents > 0)) && styles.saveBtnDisabled]}
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

const createStyles = (c: ColorTokens) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.surface },
  container: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: Spacing.bottomPad,
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
  optional: { fontWeight: FontWeight.medium, textTransform: "none", color: c.textSubtle },
  row: { flexDirection: "row", gap: Spacing.sm },
  selectField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    backgroundColor: c.surface,
  },
  selectFieldText: { fontSize: FontSize.subtitle, color: c.textDark, flex: 1 },
  selectChevron: { fontSize: FontSize.title, color: c.textSubtle, marginLeft: Spacing.sm },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  modalTitle: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, color: c.textDark },
  modalClose: { fontSize: FontSize.subtitle, color: c.primary, fontWeight: FontWeight.semibold },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
  },
  modalRowSelected: { backgroundColor: c.primarySurface },
  modalRowContent: { flex: 1 },
  modalRowText: { fontSize: FontSize.subtitle, color: c.textDark },
  modalRowTextSelected: { color: c.primary, fontWeight: FontWeight.semibold },
  modalRowTextDisconnected: { color: c.textDisabled },
  disconnectedLabel: { fontSize: FontSize.caption, color: c.textSubtle, marginTop: 2 },
  modalCheck: { fontSize: FontSize.subtitle, color: c.primary, marginLeft: Spacing.sm },
  toggleBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
  },
  toggleText: { fontSize: FontSize.body, color: c.textMid },
  incomeActive: { borderColor: c.success, backgroundColor: c.successSurface },
  incomeText: { color: c.success, fontWeight: FontWeight.semibold },
  expenseActive: { borderColor: c.error, backgroundColor: c.errorSurface },
  expenseText: { color: c.error, fontWeight: FontWeight.semibold },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.subtitle,
    color: c.textDark,
    letterSpacing: 0,
  },
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
  preview: { textAlign: "center", fontSize: FontSize.title, fontWeight: FontWeight.extrabold, marginVertical: Spacing.sm },
  previewMuted: { color: c.textSubtle },
  previewIncome: { color: c.success },
  previewExpense: { color: c.error },
});
