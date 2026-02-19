import React from "react";
import { View, Text, FlatList, Pressable, TextInput } from "react-native";
import { useAppStore } from "../../src/store/useAppStore";
import { loadSyncMeta } from "../../src/infra/local/syncMeta";

function userLabel(userId: string): string {
  if (userId === "user-los") return "Los";
  if (userId === "user-jackia") return "Jackia";
  return userId;
}

export default function BudgetScreen() {
  const status = useAppStore((s) => s.status);
  const state = useAppStore((s) => s.state);

  const [signedInAs, setSignedInAs] = React.useState<string | null>(null);
  React.useEffect(() => {
    loadSyncMeta().then((meta) => {
      if (meta) setSignedInAs(userLabel(meta.userId));
    });
  }, []);

  const resetAndSeed = useAppStore((s) => s.resetAndSeed);

  const createEnvelope = useAppStore((s) => s.createEnvelope);
  const allocateToEnvelope = useAppStore((s) => s.allocateToEnvelope);

  const addManualTransaction = useAppStore((s) => s.addManualTransaction);

  const [newEnvelopeName, setNewEnvelopeName] = React.useState("");
  const [allocateCents, setAllocateCents] = React.useState("0");
  const [txAmountCents, setTxAmountCents] = React.useState("2000");
  const [txDescription, setTxDescription] = React.useState("Paycheck");
  const [txKind, setTxKind] = React.useState<"income" | "expense">("income");

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
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>Budget</Text>
        {signedInAs ? (
          <Text style={{ fontSize: 13, color: "#888" }}>Signed in as: {signedInAs}</Text>
        ) : null}
      </View>

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

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => setTxKind("income")}
            style={{
              padding: 10,
              borderWidth: 1,
              borderRadius: 10,
              flex: 1,
              alignItems: "center",
              backgroundColor: txKind === "income" ? "#e0e0e0" : "transparent",
            }}
          >
            <Text style={{ fontWeight: txKind === "income" ? "700" : "400" }}>
              Income
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTxKind("expense")}
            style={{
              padding: 10,
              borderWidth: 1,
              borderRadius: 10,
              flex: 1,
              alignItems: "center",
              backgroundColor: txKind === "expense" ? "#e0e0e0" : "transparent",
            }}
          >
            <Text style={{ fontWeight: txKind === "expense" ? "700" : "400" }}>
              Expense
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            const raw = Number(txAmountCents);
            if (!Number.isFinite(raw) || raw <= 0) return;

            const cents = txKind === "expense" ? -raw : raw;

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
            const assignments = Object.values(
              state.inbox.assignmentsByTransactionId,
            );
            const assigned = assignments.filter(
              (a) => a.envelopeId === item.id,
            );

            const envelopeTx = state.transactions.filter((t) => {
              const a = assignments.find((x) => x.transactionId === t.id);
              return a?.envelopeId === item.id;
            });

            const spent = envelopeTx
              .filter((t) => t.amount.cents < 0)
              .reduce((sum, t) => sum + Math.abs(t.amount.cents), 0);

            const allocated = item.balance.cents + spent;

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
                <View style={{ gap: 2 }}>
                  <Text>Balance: {item.balance.cents} cents</Text>
                  <Text style={{ fontSize: 12, opacity: 0.6 }}>
                    Total allocated: {allocated} cents
                  </Text>
                  <Text style={{ fontSize: 12, opacity: 0.6 }}>
                    Total spent: {spent} cents
                  </Text>
                </View>
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
