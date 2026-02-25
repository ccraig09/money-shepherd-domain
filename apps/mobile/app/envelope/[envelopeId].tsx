import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  StyleSheet,
  ScrollView,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";
import { formatMoney } from "../../src/lib/moneyFormat";
import { Card } from "../../src/ui/components/Card";
import { SectionHeader } from "../../src/ui/components/SectionHeader";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../../src/ui/tokens";
import type { Transaction } from "@money-shepherd/domain";

export default function EnvelopeDetailScreen() {
  const { envelopeId } = useLocalSearchParams<{ envelopeId: string }>();
  const state = useAppStore((s) => s.state);
  const deleteEnvelopeAction = useAppStore((s) => s.deleteEnvelope);

  if (!state || !envelopeId) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const envelope = state.budget.envelopes.find((e) => e.id === envelopeId);

  if (!envelope) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Envelope not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // Derive transactions assigned to this envelope
  const assignments = Object.values(state.inbox.assignmentsByTransactionId);
  const assignmentByTxId = Object.fromEntries(
    assignments.map((a) => [a.transactionId, a]),
  );
  const assignedTxIds = new Set(
    assignments
      .filter((a) => a.envelopeId === envelopeId)
      .map((a) => a.transactionId),
  );

  const txById = Object.fromEntries(
    state.transactions.map((tx) => [tx.id, tx]),
  );

  const assignedTxs = Array.from(assignedTxIds)
    .map((id) => txById[id])
    .filter((tx): tx is Transaction => tx !== undefined)
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt));

  const accounts = state.accounts;

  function accountName(accountId: string): string {
    return accounts.find((a) => a.id === accountId)?.name ?? accountId;
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  }

  const isNegativeBalance = envelope.balance.cents < 0;
  const isZeroBalance = envelope.balance.cents === 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: envelope.name }} />

      {/* Hero balance card */}
      <View style={styles.summaryCard}>
        <View style={styles.nameRow}>
          <Text style={styles.envelopeName} numberOfLines={1}>
            {envelope.name}
          </Text>
          <Pressable
            onPress={() =>
              router.push(`/edit-envelope?envelopeId=${envelopeId}` as any)
            }
            style={styles.editBtn}
            accessibilityLabel="Edit envelope name"
            hitSlop={8}
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>

        <Text style={styles.balanceLabel}>Balance</Text>
        <Text
          style={[
            styles.balance,
            isNegativeBalance && styles.balanceNegative,
            isZeroBalance && styles.balanceZero,
          ]}
        >
          ${formatMoney(envelope.balance.cents)}
        </Text>

        {/* Allocate CTA */}
        <Pressable
          onPress={() => router.push("/allocate")}
          style={styles.allocateBtn}
          accessibilityLabel="Allocate funds to this envelope"
        >
          <Text style={styles.allocateBtnText}>$ Allocate Funds</Text>
        </Pressable>

        {/* Delete — subdued text action */}
        <Pressable
          onPress={() => {
            const balanceStr = formatMoney(Math.abs(envelope.balance.cents));
            const hasBalance = envelope.balance.cents !== 0;
            const msg = hasBalance
              ? `Delete "${envelope.name}"? Its balance of $${balanceStr} will return to Available.`
              : `Delete "${envelope.name}"? Any assigned transactions will return to your Inbox.`;
            Alert.alert("Delete Envelope", msg, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  await deleteEnvelopeAction(envelopeId);
                  router.back();
                },
              },
            ]);
          }}
          style={styles.deleteBtn}
          accessibilityLabel="Delete envelope"
        >
          <Text style={styles.deleteBtnText}>Delete Envelope</Text>
        </Pressable>
      </View>

      {/* Activity list */}
      <SectionHeader title="Activity" />

      {assignedTxs.length === 0 ? (
        <Card style={styles.empty}>
          <Text style={styles.emptyText}>No transactions assigned yet.</Text>
          <Text style={styles.emptyHint}>
            Assign expenses from the Inbox to see activity here.
          </Text>
        </Card>
      ) : (
        <Card>
          <FlatList
            data={assignedTxs}
            keyExtractor={(tx) => tx.id}
            scrollEnabled={false}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isExpense = item.amount.cents < 0;
              const desc = item.description || "Manual transaction";
              const assignedByUserId = assignmentByTxId[item.id]?.assignedByUserId;
              const assignedByName = assignedByUserId
                ? (state.users?.find((u) => u.id === assignedByUserId)?.displayName ?? null)
                : null;
              const dateSuffix = assignedByName
                ? `${formatDate(item.postedAt)} · by ${assignedByName}`
                : formatDate(item.postedAt);
              return (
                <View style={styles.row}>
                  <View style={styles.rowMain}>
                    <View style={styles.descRow}>
                      <Text style={styles.rowDescription} numberOfLines={1}>
                        {desc}
                      </Text>
                      {item.id.startsWith("plaid-") && (
                        <View style={styles.bankBadge} accessibilityLabel="Bank transaction">
                          <Text style={styles.bankBadgeText}>Bank</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={styles.rowAccountName} numberOfLines={1}>
                        {accountName(item.accountId)}
                      </Text>
                      <Text style={styles.rowAccountDate}>
                        {" · "}{dateSuffix}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.rowAmount,
                      isExpense ? styles.expense : styles.income,
                    ]}
                  >
                    {isExpense ? "-" : "+"}${formatMoney(Math.abs(item.amount.cents))}
                  </Text>
                </View>
              );
            }}
          />
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Color.surface },
  content: { paddingBottom: Spacing.bottomPad },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  errorText: { fontSize: FontSize.body, color: Color.error },
  backBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.border,
  },
  backBtnText: { fontSize: FontSize.body, color: Color.textMid },

  // Hero summary card
  summaryCard: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.border,
    backgroundColor: Color.surfaceLight,
    gap: Spacing.xs,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  envelopeName: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, color: Color.textDark, flexShrink: 1 },
  editBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Color.border,
    backgroundColor: Color.surface,
  },
  editBtnText: { fontSize: FontSize.small, fontWeight: FontWeight.semibold, color: Color.primary },
  balanceLabel: { fontSize: FontSize.small, color: Color.textMuted, marginTop: Spacing.xs },
  balance: { fontSize: FontSize.hero, fontWeight: FontWeight.extrabold, color: Color.success },
  balanceNegative: { color: Color.error },
  balanceZero: { color: Color.textMuted },

  // Allocate CTA
  allocateBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Color.primary,
  },
  allocateBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Color.textOnColor },

  // Delete
  deleteBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  deleteBtnText: { fontSize: FontSize.small, fontWeight: FontWeight.semibold, color: Color.error },

  // Empty state
  empty: {
    padding: Spacing.lg,
    alignItems: "center",
    backgroundColor: Color.surfaceLight,
    gap: Spacing.sm,
  },
  emptyText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Color.textMuted, textAlign: "center" },
  emptyHint: { fontSize: FontSize.caption, color: Color.textSubtle, textAlign: "center" },

  // Activity list
  list: { paddingBottom: 0 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
  },
  rowMain: { flex: 1, gap: Spacing.xs, paddingRight: Spacing.sm },
  descRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  rowDescription: { fontSize: FontSize.body, fontWeight: FontWeight.medium, color: Color.textDark, flexShrink: 1 },
  bankBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    backgroundColor: Color.surfaceLight,
    borderWidth: 1,
    borderColor: Color.borderLight,
  },
  bankBadgeText: { fontSize: 10, fontWeight: FontWeight.semibold, color: Color.textMuted },
  metaRow: { flexDirection: "row", alignItems: "center" },
  rowAccountName: { fontSize: FontSize.caption, color: Color.textMuted, flexShrink: 1 },
  rowAccountDate: { fontSize: FontSize.caption, color: Color.textMuted, flexShrink: 0 },
  rowAmount: { fontSize: FontSize.subtitle, fontWeight: FontWeight.semibold, paddingTop: 2 },
  income: { color: Color.success },
  expense: { color: Color.error },
});
