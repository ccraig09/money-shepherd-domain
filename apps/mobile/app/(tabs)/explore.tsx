import React from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useAppStore } from "../../src/store/useAppStore";

export default function InboxScreen() {
  const state = useAppStore((s) => s.state);
  const assignTransaction = useAppStore((s) => s.assignTransaction);
  const createEnvelope = useAppStore((s) => s.createEnvelope);

  if (!state) {
    return (
      <View style={{ padding: 16 }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const { transactions, inbox, budget, users } = state;
  const unassignedIds = inbox.unassignedTransactionIds;

  const unassignedTx = transactions.filter((t) => unassignedIds.includes(t.id));

  const defaultAssigner = users[0]?.id ?? "user-los"; // Los by default for now

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>Inbox</Text>
      <Text style={{ opacity: 0.7 }}>
        Unassigned transactions: {unassignedTx.length}
      </Text>

      {budget.envelopes.length === 0 ? (
        <View style={{ paddingVertical: 12, gap: 8 }}>
          <Text style={{ fontWeight: "600" }}>No envelopes yet</Text>
          <Text style={{ opacity: 0.7 }}>
            Create one so you can assign transactions.
          </Text>

          <Pressable
            onPress={() => createEnvelope("Groceries")}
            style={{
              padding: 12,
              borderRadius: 10,
              borderWidth: 1,
              alignItems: "center",
            }}
          >
            <Text>Create “Groceries” envelope</Text>
          </Pressable>
        </View>
      ) : null}

      {unassignedTx.length === 0 ? (
        <View style={{ paddingVertical: 12 }}>
          <Text style={{ fontWeight: "600" }}>You’re all caught up</Text>
          <Text style={{ opacity: 0.7 }}>
            Add a transaction from Home to test assignment.
          </Text>
        </View>
      ) : (
        <FlatList
          data={unassignedTx}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 10, paddingTop: 10 }}
          renderItem={({ item }) => {
            const firstEnvelope = budget.envelopes[0];
            return (
              <View
                style={{
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  gap: 6,
                }}
              >
                <Text style={{ fontWeight: "600" }}>{item.description}</Text>
                <Text>Amount: {item.amount.cents} cents</Text>
                <Text style={{ opacity: 0.7, fontSize: 12 }}>
                  {item.postedAt}
                </Text>

                {firstEnvelope ? (
                  <Pressable
                    onPress={() =>
                      assignTransaction({
                        transactionId: item.id,
                        envelopeId: firstEnvelope.id,
                        assignedByUserId: defaultAssigner,
                      })
                    }
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      alignItems: "center",
                      marginTop: 6,
                    }}
                  >
                    <Text>Assign to: {firstEnvelope.name}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
