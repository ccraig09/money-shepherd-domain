import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAppStore } from "../src/store/useAppStore";
import { parseDollars } from "../src/lib/moneyInput";
import { formatMoney } from "../src/lib/moneyFormat";
import { MoneyInput } from "../src/ui/components/MoneyInput";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../src/ui/tokens";
import { useThemedStyles } from "@/src/ui/ThemeProvider";

export default function TransferScreen() {
  const styles = useThemedStyles(createStyles);

  const { from } = useLocalSearchParams<{ from?: string }>();
  const state = useAppStore((s) => s.state);
  const transferAction = useAppStore((s) => s.transferBetweenEnvelopes);

  const [fromId, setFromId] = React.useState<string | null>(from ?? null);
  const [toId, setToId] = React.useState<string | null>(null);
  const [rawAmount, setRawAmount] = React.useState("");
  const [amountError, setAmountError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const envelopes = state.budget.envelopes;
  const sourceEnvelope = envelopes.find((e) => e.id === fromId);

  async function handleTransfer() {
    setAmountError(null);

    if (!fromId || !toId) return;

    const parsed = parseDollars(rawAmount);
    if (!parsed.ok) {
      setAmountError(parsed.error);
      return;
    }
    if (parsed.cents === 0) {
      setAmountError("Amount must be greater than zero.");
      return;
    }
    if (sourceEnvelope && parsed.cents > sourceEnvelope.balance.cents) {
      setAmountError(
        `Not enough in ${sourceEnvelope.name}. Balance: $${formatMoney(sourceEnvelope.balance.cents)}.`,
      );
      return;
    }

    setSaving(true);
    try {
      await transferAction({
        fromEnvelopeId: fromId,
        toEnvelopeId: toId,
        amountCents: parsed.cents,
      });
      router.back();
    } catch (err: any) {
      setAmountError(err?.message ?? "Transfer failed.");
    } finally {
      setSaving(false);
    }
  }

  const needsBothSelected = !fromId || !toId;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {envelopes.length < 2 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              You need at least 2 envelopes to transfer between them.
            </Text>
            <Pressable
              onPress={() => router.back()}
              style={styles.backBtn}
              accessibilityLabel="Go back"
            >
              <Text style={styles.backBtnText}>Go back</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Source picker */}
            <Text style={styles.sectionLabel}>From</Text>
            <View style={styles.envelopeList}>
              {envelopes.map((env) => {
                const isSelected = env.id === fromId;
                const isDisabledByDest = env.id === toId;
                return (
                  <Pressable
                    key={env.id}
                    style={[
                      styles.envelopeRow,
                      isSelected && styles.envelopeRowSelected,
                      isDisabledByDest && styles.envelopeRowDisabled,
                    ]}
                    onPress={() => !isDisabledByDest && setFromId(env.id)}
                    disabled={isDisabledByDest}
                    accessibilityLabel={`From ${env.name}`}
                  >
                    <Text
                      style={[
                        styles.envelopeName,
                        isSelected && styles.envelopeNameSelected,
                        isDisabledByDest && styles.envelopeNameDisabled,
                      ]}
                    >
                      {env.name}
                    </Text>
                    <Text
                      style={[
                        styles.envelopeBalance,
                        isSelected && styles.envelopeBalanceSelected,
                        isDisabledByDest && styles.envelopeNameDisabled,
                      ]}
                    >
                      ${formatMoney(env.balance.cents)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Destination picker */}
            <Text style={styles.sectionLabel}>To</Text>
            <View style={styles.envelopeList}>
              {envelopes.map((env) => {
                const isSelected = env.id === toId;
                const isDisabledBySource = env.id === fromId;
                return (
                  <Pressable
                    key={env.id}
                    style={[
                      styles.envelopeRow,
                      isSelected && styles.envelopeRowSelected,
                      isDisabledBySource && styles.envelopeRowDisabled,
                    ]}
                    onPress={() => !isDisabledBySource && setToId(env.id)}
                    disabled={isDisabledBySource}
                    accessibilityLabel={`To ${env.name}`}
                  >
                    <Text
                      style={[
                        styles.envelopeName,
                        isSelected && styles.envelopeNameSelected,
                        isDisabledBySource && styles.envelopeNameDisabled,
                      ]}
                    >
                      {env.name}
                    </Text>
                    <Text
                      style={[
                        styles.envelopeBalance,
                        isSelected && styles.envelopeBalanceSelected,
                        isDisabledBySource && styles.envelopeNameDisabled,
                      ]}
                    >
                      ${formatMoney(env.balance.cents)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Source balance hint */}
            {sourceEnvelope && (
              <Text style={styles.balanceHint}>
                Available from {sourceEnvelope.name}: ${formatMoney(sourceEnvelope.balance.cents)}
              </Text>
            )}

            {/* Amount input */}
            <Text style={styles.sectionLabel}>Amount</Text>
            <MoneyInput
              value={rawAmount}
              onChangeText={setRawAmount}
              error={amountError}
              onErrorClear={() => setAmountError(null)}
              placeholder="e.g. 25.00"
              accessibilityLabel="Amount to transfer in dollars"
            />

            {/* Actions */}
            <Pressable
              onPress={handleTransfer}
              disabled={needsBothSelected || saving}
              style={[
                styles.transferBtn,
                (needsBothSelected || saving) && styles.transferBtnDisabled,
              ]}
              accessibilityLabel="Confirm transfer"
            >
              <Text style={styles.transferBtnText}>
                {saving ? "Transferring…" : "Transfer"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              style={styles.cancelBtn}
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.bottomPad },
  emptyState: { alignItems: "center", gap: Spacing.base, paddingVertical: Spacing.xl },
  emptyText: { fontSize: FontSize.body, color: c.textMid, textAlign: "center" },
  backBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  backBtnText: { fontSize: FontSize.body, color: c.textMid },
  sectionLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: c.textMid,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  envelopeList: { gap: 2 },
  envelopeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.borderLight,
  },
  envelopeRowSelected: { borderColor: c.primary, backgroundColor: c.primarySurface },
  envelopeRowDisabled: { opacity: 0.35 },
  envelopeName: { fontSize: FontSize.body, fontWeight: FontWeight.medium, color: c.textDark },
  envelopeNameSelected: { color: c.primary, fontWeight: FontWeight.bold },
  envelopeNameDisabled: { color: c.textDisabled },
  envelopeBalance: { fontSize: FontSize.body, color: c.textMuted },
  envelopeBalanceSelected: { color: c.primary },
  balanceHint: {
    fontSize: FontSize.small,
    color: c.textMuted,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  transferBtn: {
    marginTop: Spacing.lg,
    backgroundColor: c.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  transferBtnDisabled: { opacity: 0.4 },
  transferBtnText: { color: c.textOnColor, fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  cancelBtn: { alignItems: "center", paddingVertical: Spacing.sm },
  cancelText: { fontSize: FontSize.body, color: c.textMuted },
});
