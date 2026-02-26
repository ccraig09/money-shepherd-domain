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
import { router } from "expo-router";
import { useAppStore } from "../src/store/useAppStore";
import { parseDollars } from "../src/lib/moneyInput";
import { formatMoney } from "../src/lib/moneyFormat";
import { MoneyInput } from "../src/ui/components/MoneyInput";
import { HelpTooltip } from "../src/ui/components/HelpTooltip";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../src/ui/tokens";

export default function AllocateScreen() {
  const state = useAppStore((s) => s.state);
  const allocateToEnvelope = useAppStore((s) => s.allocateToEnvelope);

  const [selectedEnvelopeId, setSelectedEnvelopeId] = React.useState<string | null>(null);
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

  const available = state.budget.availableToAssign.cents;
  const envelopes = state.budget.envelopes;
  const isZeroAvailable = available === 0;

  async function handleAllocate() {
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
    if (parsed.cents > available) {
      setAmountError(
        `Not enough available. You have $${formatMoney(available)} left.`,
      );
      return;
    }
    if (!selectedEnvelopeId) return;

    setSaving(true);
    try {
      await allocateToEnvelope({ envelopeId: selectedEnvelopeId, amountCents: parsed.cents });
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
        {/* Available balance */}
        <View style={styles.availableCard}>
          <View style={styles.availableLabelRow}>
            <Text style={styles.availableLabel}>Available to Assign</Text>
            <HelpTooltip
              title="Allocate"
              body="Move money from Available into an envelope for a specific purpose — like putting cash in a jar."
            />
          </View>
          <Text style={[styles.availableAmount, isZeroAvailable && styles.availableZero]}>
            ${formatMoney(available)}
          </Text>
          {isZeroAvailable && (
            <>
              <Text style={styles.zeroHint}>Add income to begin allocating.</Text>
              <Pressable
                onPress={() => {
                  router.back();
                  router.push("/add-transaction");
                }}
                style={styles.addIncomeBtn}
                accessibilityLabel="Add income"
              >
                <Text style={styles.addIncomeBtnText}>Add income</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* When Available = $0, don't show envelope picker — just the CTA above */}
        {!isZeroAvailable && (
          <>
            {/* Envelope picker */}
            <Text style={styles.sectionLabel}>Choose an envelope</Text>

            {envelopes.length === 0 ? (
              <View style={styles.noEnvelopes}>
                <Text style={styles.noEnvelopesText}>No envelopes yet.</Text>
                <Pressable
                  onPress={() => {
                    router.back();
                    router.push("/create-envelope");
                  }}
                  style={styles.createBtn}
                  accessibilityLabel="Create an envelope first"
                >
                  <Text style={styles.createBtnText}>Create an envelope first</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.envelopeList}>
                  {envelopes.map((item) => {
                    const isSelected = item.id === selectedEnvelopeId;
                    return (
                      <Pressable
                        key={item.id}
                        style={[styles.envelopeRow, isSelected && styles.envelopeRowSelected]}
                        onPress={() => setSelectedEnvelopeId(item.id)}
                        accessibilityLabel={`Select ${item.name}`}
                      >
                        <Text style={[styles.envelopeName, isSelected && styles.envelopeNameSelected]}>
                          {item.name}
                        </Text>
                        <Text style={[styles.envelopeBalance, isSelected && styles.envelopeBalanceSelected]}>
                          ${formatMoney(item.balance.cents)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Amount input */}
                <Text style={styles.sectionLabel}>Amount</Text>
                <MoneyInput
                  value={rawAmount}
                  onChangeText={setRawAmount}
                  error={amountError}
                  onErrorClear={() => setAmountError(null)}
                  placeholder="e.g. 50.00"
                  accessibilityLabel="Amount to allocate in dollars"
                />

                {/* Actions */}
                <Pressable
                  onPress={handleAllocate}
                  disabled={!selectedEnvelopeId || saving}
                  style={[
                    styles.allocateBtn,
                    (!selectedEnvelopeId || saving) && styles.allocateBtnDisabled,
                  ]}
                  accessibilityLabel="Confirm allocation"
                >
                  <Text style={styles.allocateBtnText}>
                    {saving ? "Allocating…" : "Allocate"}
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
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Color.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.bottomPad },
  availableCard: {
    backgroundColor: Color.primarySurface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  availableLabelRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  availableLabel: { fontSize: FontSize.small, color: Color.textMid, fontWeight: FontWeight.medium },
  availableAmount: { fontSize: FontSize.title, fontWeight: FontWeight.extrabold, color: Color.success },
  availableZero: { color: Color.textDisabled },
  zeroHint: { fontSize: FontSize.small, color: Color.error, textAlign: "center", marginTop: Spacing.xs },
  addIncomeBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Color.success,
  },
  addIncomeBtnText: { color: Color.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },
  sectionLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: Color.textMid,
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
    borderColor: Color.borderLight,
  },
  envelopeRowSelected: { borderColor: Color.primary, backgroundColor: Color.primarySurface },
  envelopeName: { fontSize: FontSize.body, fontWeight: FontWeight.medium, color: Color.textDark },
  envelopeNameSelected: { color: Color.primary, fontWeight: FontWeight.bold },
  envelopeBalance: { fontSize: FontSize.body, color: Color.textMuted },
  envelopeBalanceSelected: { color: Color.primary },
  allocateBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Color.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  allocateBtnDisabled: { opacity: 0.4 },
  allocateBtnText: { color: Color.textOnColor, fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  cancelBtn: { alignItems: "center", paddingVertical: Spacing.sm },
  cancelText: { fontSize: FontSize.body, color: Color.textMuted },
  noEnvelopes: { alignItems: "center", gap: Spacing.base, paddingVertical: Spacing.lg },
  noEnvelopesText: { fontSize: FontSize.subtitle, color: Color.textMid },
  createBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Color.primary,
  },
  createBtnText: { color: Color.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },
});
