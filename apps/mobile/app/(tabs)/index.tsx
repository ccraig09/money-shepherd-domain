import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";
import { formatMoney } from "../../src/lib/moneyFormat";

export default function DashboardScreen() {
  const state = useAppStore((s) => s.state);

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const availableCents = state.budget.availableToAssign.cents;
  const totalEnvelopeCents = state.budget.envelopes.reduce(
    (sum, e) => sum + e.balance.cents,
    0,
  );

  // Unassigned expenses — nudge the user to assign them
  const assignedTxIds = new Set(
    Object.values(state.inbox.assignmentsByTransactionId).map(
      (a) => a.transactionId,
    ),
  );
  const unassignedExpenseCount = state.transactions.filter(
    (tx) => tx.amount.cents < 0 && !assignedTxIds.has(tx.id),
  ).length;

  const envelopes = state.budget.envelopes;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
      </View>

      {/* Available to Assign — hero card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Available to Assign</Text>
        <Text
          style={[
            styles.heroAmount,
            availableCents < 0 && styles.heroAmountNegative,
          ]}
        >
          ${formatMoney(availableCents)}
        </Text>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatLabel}>Total in envelopes</Text>
          <Text style={styles.heroStatValue}>
            ${formatMoney(totalEnvelopeCents)}
          </Text>
        </View>
      </View>

      {/* Unassigned nudge */}
      {unassignedExpenseCount > 0 && (
        <Pressable
          style={styles.nudge}
          onPress={() => router.push("/(tabs)/inbox")}
          accessibilityLabel="Go to inbox to assign transactions"
        >
          <Text style={styles.nudgeText}>
            {unassignedExpenseCount}{" "}
            {unassignedExpenseCount === 1 ? "transaction needs" : "transactions need"} a home
          </Text>
          <Text style={styles.nudgeArrow}>→</Text>
        </Pressable>
      )}

      {/* Quick actions */}
      <View style={styles.ctaRow}>
        <Pressable
          style={styles.ctaExpense}
          onPress={() => router.push({ pathname: "/add-transaction", params: { kind: "expense" } })}
          accessibilityLabel="Add expense"
        >
          <Text style={styles.ctaExpenseText}>− Expense</Text>
        </Pressable>
        <Pressable
          style={styles.ctaIncome}
          onPress={() => router.push({ pathname: "/add-transaction", params: { kind: "income" } })}
          accessibilityLabel="Add income"
        >
          <Text style={styles.ctaIncomeText}>+ Income</Text>
        </Pressable>
      </View>
      <View style={styles.ctaRowSingle}>
        <Pressable
          style={styles.ctaAllocate}
          onPress={() => router.push("/allocate")}
          accessibilityLabel="Allocate funds"
        >
          <Text style={styles.ctaAllocateText}>$ Allocate</Text>
        </Pressable>
      </View>

      {/* Envelopes preview */}
      <Text style={styles.sectionLabel}>Envelopes</Text>

      {envelopes.length === 0 ? (
        <View style={styles.emptyEnvelopes}>
          <Text style={styles.emptyText}>No envelopes yet.</Text>
          <Pressable
            onPress={() => router.push("/create-envelope")}
            style={styles.emptyEnvelopeBtn}
            accessibilityLabel="Create your first envelope"
          >
            <Text style={styles.emptyEnvelopeBtnText}>Create your first envelope</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.envelopeList}>
          {envelopes.map((env) => {
            const isNegative = env.balance.cents < 0;
            return (
              <Pressable
                key={env.id}
                style={styles.envelopeRow}
                onPress={() =>
                  router.push({
                    pathname: "/envelope/[envelopeId]",
                    params: { envelopeId: env.id },
                  })
                }
                accessibilityLabel={`${env.name} envelope`}
              >
                <Text style={styles.envelopeName} numberOfLines={1}>
                  {env.name}
                </Text>
                <Text
                  style={[
                    styles.envelopeBalance,
                    isNegative && styles.envelopeBalanceNegative,
                  ]}
                >
                  ${formatMoney(env.balance.cents)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  content: { paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: "700", color: "#111" },

  // Hero card
  heroCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#4f8ef7",
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    gap: 4,
  },
  heroLabel: { fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  heroAmount: { fontSize: 44, fontWeight: "800", color: "#fff", marginTop: 4 },
  heroAmountNegative: { color: "#ffcdd2" },
  heroStat: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.3)",
  },
  heroStatLabel: { fontSize: 13, color: "rgba(255,255,255,0.75)" },
  heroStatValue: { fontSize: 13, fontWeight: "600", color: "#fff" },

  // Nudge
  nudge: {
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff8e1",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#ffe082",
  },
  nudgeText: { fontSize: 14, fontWeight: "500", color: "#795548" },
  nudgeArrow: { fontSize: 16, color: "#795548" },

  // Quick actions
  ctaRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  ctaRowSingle: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  ctaExpense: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d94f4f",
    backgroundColor: "#fdeaea",
  },
  ctaExpenseText: { color: "#d94f4f", fontWeight: "700", fontSize: 15 },
  ctaIncome: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2d9e6b",
    backgroundColor: "#edfaf3",
  },
  ctaIncomeText: { color: "#2d9e6b", fontWeight: "700", fontSize: 15 },
  ctaAllocate: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#4f8ef7",
  },
  ctaAllocateText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Section
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },

  // Envelopes
  emptyEnvelopes: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 14,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  emptyText: { fontSize: 14, color: "#888", textAlign: "center" },
  emptyEnvelopeBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#4f8ef7",
  },
  emptyEnvelopeBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  envelopeList: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#eee",
    overflow: "hidden",
  },
  envelopeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#eee",
    backgroundColor: "#fff",
  },
  envelopeName: { fontSize: 15, fontWeight: "500", color: "#111", flex: 1 },
  envelopeBalance: { fontSize: 15, fontWeight: "600", color: "#2d9e6b", marginLeft: 12 },
  envelopeBalanceNegative: { color: "#d94f4f" },
});
