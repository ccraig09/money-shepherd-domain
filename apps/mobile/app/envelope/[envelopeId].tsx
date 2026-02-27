import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";
import { formatMoney } from "../../src/lib/moneyFormat";
import { parseDollars } from "../../src/lib/moneyInput";
import { Card } from "../../src/ui/components/Card";
import { SectionHeader } from "../../src/ui/components/SectionHeader";
import { DebtProgressBar } from "../../src/ui/components/DebtProgressBar";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../../src/ui/tokens";
import type { Transaction, EnvelopeGroup } from "@money-shepherd/domain";

export default function EnvelopeDetailScreen() {
  const { envelopeId } = useLocalSearchParams<{ envelopeId: string }>();
  const state = useAppStore((s) => s.state);
  const deleteEnvelopeAction = useAppStore((s) => s.deleteEnvelope);
  const setGoalAction = useAppStore((s) => s.setEnvelopeGoal);
  const clearGoalAction = useAppStore((s) => s.clearEnvelopeGoal);
  const setTargetAction = useAppStore((s) => s.setEnvelopeTarget);
  const clearTargetAction = useAppStore((s) => s.clearEnvelopeTarget);
  const moveToGroup = useAppStore((s) => s.moveEnvelopeToGroup);
  const createEnvelopeGroup = useAppStore((s) => s.createEnvelopeGroup);

  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [targetModalVisible, setTargetModalVisible] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [groupPickerVisible, setGroupPickerVisible] = useState(false);
  const [newGroupModalVisible, setNewGroupModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  // Derive transactions assigned to this envelope
  const { assignmentByTxId, assignedTxs } = useMemo(() => {
    if (!state || !envelopeId) return { assignmentByTxId: {} as Record<string, any>, assignedTxs: [] as Transaction[] };
    const assignments = Object.values(state.inbox.assignmentsByTransactionId);
    const byTxId = Object.fromEntries(
      assignments.map((a) => [a.transactionId, a]),
    );
    const txIds = new Set(
      assignments
        .filter((a) => a.envelopeId === envelopeId)
        .map((a) => a.transactionId),
    );
    const txById = Object.fromEntries(
      state.transactions.map((tx) => [tx.id, tx]),
    );
    const txs = Array.from(txIds)
      .map((id) => txById[id])
      .filter((tx): tx is Transaction => tx !== undefined)
      .sort((a, b) => b.postedAt.localeCompare(a.postedAt));
    return { assignmentByTxId: byTxId, assignedTxs: txs };
  }, [state, envelopeId]);

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
            <Text style={styles.editBtnText}>✎ Edit</Text>
          </Pressable>
        </View>

        {/* Group row */}
        <View style={styles.groupRow}>
          <Text style={styles.groupLabel}>
            {(() => {
              const groups: EnvelopeGroup[] = state.envelopeGroups ?? [];
              const group = envelope.groupId ? groups.find((g) => g.id === envelope.groupId) : null;
              return group ? group.name : "Ungrouped";
            })()}
          </Text>
          <Pressable
            onPress={() => setGroupPickerVisible(true)}
            hitSlop={8}
            accessibilityLabel="Change group"
          >
            <Text style={styles.groupAction}>Change</Text>
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

        {/* Goal row */}
        <View style={styles.goalRow}>
          <Text style={styles.goalLabel}>
            {envelope.goal
              ? `Monthly goal: $${formatMoney(envelope.goal.cents)}`
              : "No monthly goal"}
          </Text>
          <Pressable
            onPress={() => {
              if (envelope.goal) {
                setGoalInput(formatMoney(envelope.goal.cents));
              } else {
                setGoalInput("");
              }
              setGoalModalVisible(true);
            }}
            hitSlop={8}
            accessibilityLabel={envelope.goal ? "Edit goal" : "Set goal"}
          >
            <Text style={styles.goalAction}>
              {envelope.goal ? "Edit" : "Set Goal"}
            </Text>
          </Pressable>
          {envelope.goal && (
            <Pressable
              onPress={() => {
                Alert.alert("Clear Goal", "Remove the monthly goal from this envelope?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Clear",
                    style: "destructive",
                    onPress: () => clearGoalAction(envelopeId),
                  },
                ]);
              }}
              hitSlop={8}
              accessibilityLabel="Clear goal"
            >
              <Text style={styles.goalClear}>Clear</Text>
            </Pressable>
          )}
        </View>

        {/* Debt target row — only for debt envelopes */}
        {envelope.type === "debt" && (
          <View style={styles.goalRow}>
            <Text style={styles.goalLabel}>
              {envelope.target
                ? `Debt target: $${formatMoney(envelope.target.cents)}`
                : "No debt target"}
            </Text>
            <Pressable
              onPress={() => {
                if (envelope.target) {
                  setTargetInput(formatMoney(envelope.target.cents));
                } else {
                  setTargetInput("");
                }
                setTargetModalVisible(true);
              }}
              hitSlop={8}
              accessibilityLabel={envelope.target ? "Edit target" : "Set target"}
            >
              <Text style={styles.goalAction}>
                {envelope.target ? "Edit" : "Set Target"}
              </Text>
            </Pressable>
            {envelope.target && (
              <Pressable
                onPress={() => {
                  Alert.alert("Clear Target", "Remove the debt target from this envelope?", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Clear",
                      style: "destructive",
                      onPress: () => clearTargetAction(envelopeId),
                    },
                  ]);
                }}
                hitSlop={8}
                accessibilityLabel="Clear target"
              >
                <Text style={styles.goalClear}>Clear</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Debt progress visualization */}
        {envelope.type === "debt" && envelope.target && envelope.target.cents > 0 && (
          <View style={styles.debtProgress}>
            <DebtProgressBar paidCents={envelope.balance.cents} targetCents={envelope.target.cents} />
            <View style={styles.debtProgressStats}>
              <Text style={styles.debtProgressLabel}>
                ${formatMoney(envelope.balance.cents)} of ${formatMoney(envelope.target.cents)}
              </Text>
              <Text style={styles.debtProgressPct}>
                {Math.min(100, Math.round((envelope.balance.cents / envelope.target.cents) * 100))}% paid off
              </Text>
            </View>
          </View>
        )}

        {/* Allocate CTA */}
        <Pressable
          onPress={() => router.push("/allocate")}
          style={styles.allocateBtn}
          accessibilityLabel="Allocate funds to this envelope"
        >
          <Text style={styles.allocateBtnText}>$ Allocate Funds</Text>
        </Pressable>

        {/* Transfer — move money to another envelope */}
        <Pressable
          onPress={() =>
            router.push(`/transfer?from=${envelopeId}` as any)
          }
          style={styles.transferBtn}
          accessibilityLabel="Move money to another envelope"
        >
          <Text style={styles.transferBtnText}>Move Money</Text>
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
      {/* Set Goal Modal */}
      <Modal
        visible={goalModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGoalModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setGoalModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Monthly Goal</Text>
            <Text style={styles.modalHint}>
              How much do you want to put into this envelope each month?
            </Text>
            <View style={styles.modalInputRow}>
              <Text style={styles.modalDollarSign}>$</Text>
              <TextInput
                style={styles.modalInput}
                value={goalInput}
                onChangeText={setGoalInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Color.textSubtle}
                autoFocus
              />
            </View>
            <Pressable
              onPress={() => {
                const parsed = parseDollars(goalInput);
                if (!parsed.ok) {
                  Alert.alert("Invalid Amount", parsed.error);
                  return;
                }
                setGoalAction(envelopeId, parsed.cents);
                setGoalModalVisible(false);
              }}
              style={styles.modalSaveBtn}
            >
              <Text style={styles.modalSaveBtnText}>Save Goal</Text>
            </Pressable>
            <Pressable
              onPress={() => setGoalModalVisible(false)}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      {/* Set Target Modal */}
      <Modal
        visible={targetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTargetModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setTargetModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Debt Target</Text>
            <Text style={styles.modalHint}>
              What is the total debt balance for this envelope?
            </Text>
            <View style={styles.modalInputRow}>
              <Text style={styles.modalDollarSign}>$</Text>
              <TextInput
                style={styles.modalInput}
                value={targetInput}
                onChangeText={setTargetInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Color.textSubtle}
                autoFocus
              />
            </View>
            <Pressable
              onPress={() => {
                const parsed = parseDollars(targetInput);
                if (!parsed.ok) {
                  Alert.alert("Invalid Amount", parsed.error);
                  return;
                }
                setTargetAction(envelopeId, parsed.cents);
                setTargetModalVisible(false);
              }}
              style={styles.modalSaveBtn}
            >
              <Text style={styles.modalSaveBtnText}>Save Target</Text>
            </Pressable>
            <Pressable
              onPress={() => setTargetModalVisible(false)}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      {/* Group picker modal */}
      <Modal
        visible={groupPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGroupPickerVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setGroupPickerVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Move to Group</Text>
            <ScrollView style={styles.groupPickerList}>
              {/* Ungrouped option */}
              <Pressable
                style={[styles.groupPickerItem, !envelope.groupId && styles.groupPickerItemActive]}
                onPress={async () => {
                  if (envelope.groupId) await moveToGroup(envelopeId, null);
                  setGroupPickerVisible(false);
                }}
              >
                <Text style={[styles.groupPickerItemText, !envelope.groupId && styles.groupPickerItemTextActive]}>
                  No group
                </Text>
                {!envelope.groupId && <Text style={styles.groupPickerCheck}>✓</Text>}
              </Pressable>
              {/* Existing groups */}
              {(state.envelopeGroups ?? []).map((g) => {
                const isActive = envelope.groupId === g.id;
                return (
                  <Pressable
                    key={g.id}
                    style={[styles.groupPickerItem, isActive && styles.groupPickerItemActive]}
                    onPress={async () => {
                      if (!isActive) await moveToGroup(envelopeId, g.id);
                      setGroupPickerVisible(false);
                    }}
                  >
                    <Text style={[styles.groupPickerItemText, isActive && styles.groupPickerItemTextActive]}>
                      {g.name}
                    </Text>
                    {isActive && <Text style={styles.groupPickerCheck}>✓</Text>}
                  </Pressable>
                );
              })}
              {/* Create new group option */}
              <Pressable
                style={styles.groupPickerItem}
                onPress={() => {
                  setGroupPickerVisible(false);
                  setNewGroupName("");
                  setNewGroupModalVisible(true);
                }}
              >
                <Text style={styles.groupPickerNewText}>+ Create new group</Text>
              </Pressable>
            </ScrollView>
            <Pressable
              onPress={() => setGroupPickerVisible(false)}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* New group modal */}
      <Modal
        visible={newGroupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNewGroupModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setNewGroupModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>New Group</Text>
            <TextInput
              style={styles.newGroupInput}
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Group name"
              placeholderTextColor={Color.textSubtle}
              autoFocus
            />
            <Pressable
              onPress={async () => {
                const trimmed = newGroupName.trim().replace(/\s+/g, " ");
                if (!trimmed) return;
                await createEnvelopeGroup(trimmed);
                const updated = useAppStore.getState().state?.envelopeGroups ?? [];
                const created = updated.find((g) => g.name === trimmed);
                if (created) await moveToGroup(envelopeId, created.id);
                setNewGroupModalVisible(false);
              }}
              style={[styles.newGroupSaveBtn, !newGroupName.trim() && styles.newGroupSaveBtnDisabled]}
              disabled={!newGroupName.trim()}
            >
              <Text style={styles.newGroupSaveBtnText}>Create & Move</Text>
            </Pressable>
            <Pressable
              onPress={() => setNewGroupModalVisible(false)}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.primary,
    backgroundColor: Color.primarySurface,
  },
  editBtnText: { fontSize: FontSize.small, fontWeight: FontWeight.semibold, color: Color.primary },

  // Group row
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  groupLabel: { fontSize: FontSize.small, color: Color.textMuted },
  groupAction: { fontSize: FontSize.small, fontWeight: FontWeight.semibold, color: Color.primary },

  // Group picker modal
  groupPickerList: { maxHeight: 300 },
  groupPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
  },
  groupPickerItemActive: { backgroundColor: Color.primarySurface },
  groupPickerItemText: { fontSize: FontSize.body, color: Color.textDark },
  groupPickerItemTextActive: { fontWeight: FontWeight.semibold, color: Color.primary },
  groupPickerCheck: { fontSize: FontSize.body, color: Color.primary, fontWeight: FontWeight.bold },
  groupPickerNewText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Color.primary },

  // New group modal
  newGroupInput: {
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.body,
    color: Color.textDark,
  },
  newGroupSaveBtn: {
    backgroundColor: Color.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  newGroupSaveBtnDisabled: { opacity: 0.6 },
  newGroupSaveBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Color.textOnColor },

  balanceLabel: { fontSize: FontSize.small, color: Color.textMuted, marginTop: Spacing.xs },
  balance: { fontSize: FontSize.hero, fontWeight: FontWeight.extrabold, color: Color.success },
  balanceNegative: { color: Color.error },
  balanceZero: { color: Color.textMuted },

  // Goal row
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  goalLabel: { fontSize: FontSize.small, color: Color.textMuted },
  goalAction: { fontSize: FontSize.small, fontWeight: FontWeight.semibold, color: Color.primary },
  goalClear: { fontSize: FontSize.small, fontWeight: FontWeight.semibold, color: Color.error },

  // Goal modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: Color.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: "85%",
    maxWidth: 360,
    gap: Spacing.md,
  },
  modalTitle: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, color: Color.textDark, textAlign: "center" },
  modalHint: { fontSize: FontSize.small, color: Color.textMuted, textAlign: "center" },
  modalInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  modalDollarSign: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, color: Color.textMid, marginRight: Spacing.xs },
  modalInput: {
    flex: 1,
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: Color.textDark,
    paddingVertical: Spacing.md,
  },
  modalSaveBtn: {
    backgroundColor: Color.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  modalSaveBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Color.textOnColor },
  modalCancelBtn: {
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  modalCancelBtnText: { fontSize: FontSize.body, color: Color.textMuted },

  // Debt progress
  debtProgress: {
    alignSelf: "stretch",
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  debtProgressStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  debtProgressLabel: {
    fontSize: FontSize.caption,
    color: Color.textMuted,
  },
  debtProgressPct: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    color: Color.primary,
  },

  // Allocate CTA
  allocateBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Color.primary,
  },
  allocateBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Color.textOnColor },

  // Transfer
  transferBtn: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.primary,
  },
  transferBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Color.primary },

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
