import React from "react";
import { View, Text, FlatList, Pressable, TextInput } from "react-native";
import { useAppStore } from "../../src/store/useAppStore";

export default function BudgetScreen() {
  const status = useAppStore((s) => s.status);
  const state = useAppStore((s) => s.state);

  const bootstrap = useAppStore((s) => s.bootstrap);
  const resetAndSeed = useAppStore((s) => s.resetAndSeed);

  const createEnvelope = useAppStore((s) => s.createEnvelope);
  const allocateToEnvelope = useAppStore((s) => s.allocateToEnvelope);

  const addManualTransaction = useAppStore((s) => s.addManualTransaction);

  const [newEnvelopeName, setNewEnvelopeName] = React.useState("");
  const [allocateCents, setAllocateCents] = React.useState("0");
  const [txAmountCents, setTxAmountCents] = React.useState("2000");
  const [txDescription, setTxDescription] = React.useState("Paycheck");

  React.useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (!state) {
    return (
      <View style={{ padding: 16 }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const available = state.budget.availableToAssign.cents;
  const defaultAccountId = state.accounts[0]?.id ?? "acc-los";

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Budget</Text>

      <View style={{ padding: 12, borderWidth: 1, borderRadius: 12, gap: 6 }}>
        <Text style={{ opacity: 0.7 }}>Available to Assign</Text>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>
          {available} cents
        </Text>
        <Pressable
          onPress={resetAndSeed}
          style={{
            padding: 10,
            borderRadius: 10,
            borderWidth: 1,
            alignItems: "center",
          }}
        >
          <Text>Reset (dev)</Text>
        </Pressable>
        {status === "loading" ? (
          <Text style={{ opacity: 0.7 }}>Updating…</Text>
        ) : null}
      </View>

      <View style={{ padding: 12, borderWidth: 1, borderRadius: 12, gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>Add Transaction (Manual)</Text>
        <Text style={{ opacity: 0.7 }}>
          Positive = income. Negative = expense.
        </Text>

        <TextInput
          value={txDescription}
          onChangeText={setTxDescription}
          placeholder="e.g. Paycheck, Groceries, Rent"
          style={{ borderWidth: 1, borderRadius: 10, padding: 10 }}
        />

        <TextInput
          value={txAmountCents}
          onChangeText={setTxAmountCents}
          keyboardType="number-pad"
          placeholder="Amount in cents (e.g. 2000)"
          style={{ borderWidth: 1, borderRadius: 10, padding: 10 }}
        />

        <Pressable
          onPress={() => {
            const cents = Number(txAmountCents);
            if (!Number.isFinite(cents) || cents === 0) return;

            addManualTransaction({
              accountId: defaultAccountId,
              amountCents: cents,
              description: txDescription.trim() || "Manual transaction",
            });
          }}
          style={{
            padding: 10,
            borderRadius: 10,
            borderWidth: 1,
            alignItems: "center",
          }}
        >
          <Text>Add Transaction</Text>
        </Pressable>
      </View>

      <View style={{ padding: 12, borderWidth: 1, borderRadius: 12, gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>Create Envelope</Text>
        <TextInput
          value={newEnvelopeName}
          onChangeText={setNewEnvelopeName}
          placeholder="e.g. Groceries"
          style={{ borderWidth: 1, borderRadius: 10, padding: 10 }}
        />
        <Pressable
          onPress={() => {
            const name = newEnvelopeName.trim();
            if (!name) return;
            createEnvelope(name);
            setNewEnvelopeName("");
          }}
          style={{
            padding: 10,
            borderRadius: 10,
            borderWidth: 1,
            alignItems: "center",
          }}
        >
          <Text>Create</Text>
        </Pressable>
      </View>

      <Text style={{ fontSize: 16, fontWeight: "600" }}>Envelopes</Text>

      {state.budget.envelopes.length === 0 ? (
        <Text style={{ opacity: 0.7 }}>
          No envelopes yet. Create one above.
        </Text>
      ) : (
        <FlatList
          data={state.budget.envelopes}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
          renderItem={({ item }) => {
            const assigned = Object.values(
              state.inbox.assignmentsByTransactionId,
            ).filter((a) => a.envelopeId === item.id);

            return (
              <View
                style={{
                  padding: 12,
                  borderWidth: 1,
                  borderRadius: 12,
                  gap: 8,
                }}
              >
                <Text style={{ fontWeight: "600" }}>{item.name}</Text>
                <Text>Balance: {item.balance.cents} cents</Text>
                <Text style={{ opacity: 0.7 }}>
                  Assigned tx: {assigned.length}
                </Text>

                <View style={{ gap: 8 }}>
                  <Text style={{ opacity: 0.7 }}>Allocate (cents)</Text>
                  <TextInput
                    value={allocateCents}
                    onChangeText={setAllocateCents}
                    keyboardType="number-pad"
                    style={{ borderWidth: 1, borderRadius: 10, padding: 10 }}
                  />
                  <Pressable
                    onPress={() => {
                      const cents = Number(allocateCents);
                      if (!Number.isFinite(cents) || cents <= 0) return;
                      allocateToEnvelope({
                        envelopeId: item.id,
                        amountCents: cents,
                      });
                    }}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      alignItems: "center",
                    }}
                  >
                    <Text>Allocate to {item.name}</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
