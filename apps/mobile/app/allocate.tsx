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
import { router } from "expo-router";
import { useAppStore } from "../src/store/useAppStore";
import { parseDollars, formatCents } from "../src/lib/moneyInput";

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
        `Not enough available. You have $${formatCents(available)} left.`,
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
          <Text style={styles.availableLabel}>Available to Assign</Text>
          <Text style={[styles.availableAmount, isZeroAvailable && styles.availableZero]}>
            ${formatCents(available)}
          </Text>
          {isZeroAvailable && (
            <Text style={styles.zeroHint}>No funds to allocate. Add income first.</Text>
          )}
        </View>

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
                    disabled={isZeroAvailable}
                    accessibilityLabel={`Select ${item.name}`}
                  >
                    <Text style={[styles.envelopeName, isSelected && styles.envelopeNameSelected]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.envelopeBalance, isSelected && styles.envelopeBalanceSelected]}>
                      ${formatCents(item.balance.cents)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Amount input */}
            <Text style={styles.sectionLabel}>Amount</Text>
            <TextInput
              value={rawAmount}
              onChangeText={(v) => {
                setRawAmount(v);
                if (amountError) setAmountError(null);
              }}
              placeholder="e.g. 50.00"
              keyboardType="decimal-pad"
              editable={!isZeroAvailable}
              style={[
                styles.input,
                amountError ? styles.inputError : null,
                isZeroAvailable ? styles.inputDisabled : null,
              ]}
              accessibilityLabel="Amount to allocate in dollars"
            />
            {amountError ? (
              <Text style={styles.errorText}>{amountError}</Text>
            ) : null}

            {/* Actions */}
            <Pressable
              onPress={handleAllocate}
              disabled={!selectedEnvelopeId || saving || isZeroAvailable}
              style={[
                styles.allocateBtn,
                (!selectedEnvelopeId || saving || isZeroAvailable) && styles.allocateBtnDisabled,
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 20, gap: 8, paddingBottom: 40 },
  availableCard: {
    backgroundColor: "#f4f8ff",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  availableLabel: { fontSize: 13, color: "#666", fontWeight: "500" },
  availableAmount: { fontSize: 28, fontWeight: "800", color: "#2d9e6b" },
  availableZero: { color: "#aaa" },
  zeroHint: { fontSize: 13, color: "#d94f4f", textAlign: "center", marginTop: 4 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  envelopeList: { gap: 2 },
  envelopeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  envelopeRowSelected: { borderColor: "#4f8ef7", backgroundColor: "#edf3fe" },
  envelopeName: { fontSize: 15, fontWeight: "500", color: "#111" },
  envelopeNameSelected: { color: "#4f8ef7", fontWeight: "700" },
  envelopeBalance: { fontSize: 14, color: "#888" },
  envelopeBalanceSelected: { color: "#4f8ef7" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111",
    marginTop: 4,
  },
  inputError: { borderColor: "#d94f4f" },
  inputDisabled: { backgroundColor: "#f5f5f5", color: "#aaa" },
  errorText: { fontSize: 13, color: "#d94f4f", marginTop: 4 },
  allocateBtn: {
    marginTop: 20,
    backgroundColor: "#4f8ef7",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  allocateBtnDisabled: { opacity: 0.4 },
  allocateBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelText: { fontSize: 15, color: "#888" },
  noEnvelopes: { alignItems: "center", gap: 16, paddingVertical: 24 },
  noEnvelopesText: { fontSize: 16, color: "#555" },
  createBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#4f8ef7",
  },
  createBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
