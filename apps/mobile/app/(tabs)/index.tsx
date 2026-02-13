import React from "react";
import { Button, View, Text, ActivityIndicator } from "react-native";
import { useAppStore } from "../../src/store/useAppStore";

export default function HomeScreen() {
  const status = useAppStore((s) => s.status);
  const errorMessage = useAppStore((s) => s.errorMessage);
  const state = useAppStore((s) => s.state);

  const bootstrap = useAppStore((s) => s.bootstrap);
  const resetAndSeed = useAppStore((s) => s.resetAndSeed);
  const addIncomeToLos = useAppStore((s) => s.addIncomeToLos);

  React.useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (status === "loading" && !state) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading...</Text>
      </View>
    );
  }

  if (status === "error") {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>Something broke</Text>
        <Text>{errorMessage}</Text>
        <Button title="Reset (clear storage)" onPress={resetAndSeed} />
      </View>
    );
  }

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>
        Money Shepherd (MVP)
      </Text>

      <Button title="Reset (clear storage)" onPress={resetAndSeed} />

      <Button
        title="Add +$20 income to Los Checking"
        onPress={addIncomeToLos}
      />

      <Text>
        Available to assign: {state?.budget.availableToAssign.cents ?? 0} cents
      </Text>
      <Text>Transactions: {state?.transactions.length ?? 0}</Text>
      <Text>
        Inbox unassigned: {state?.inbox.unassignedTransactionIds.length ?? 0}
      </Text>
      <Text>Updated: {state?.updatedAt ?? "-"}</Text>

      {status === "loading" && state ? (
        <Text style={{ opacity: 0.7 }}>Updating...</Text>
      ) : null}
    </View>
  );
}
