import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  SectionList,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";
import { formatMoney } from "../../src/lib/moneyFormat";
import { groupEnvelopes, sortEnvelopesGivingFirst } from "@money-shepherd/domain";
import type { Envelope, EnvelopeGroup } from "@money-shepherd/domain";
import { Card } from "../../src/ui/components/Card";
import { ProgressBar } from "../../src/ui/components/ProgressBar";
import { HelpTooltip } from "../../src/ui/components/HelpTooltip";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../../src/ui/tokens";
import { useThemedStyles, useTheme } from "@/src/ui/ThemeProvider";

type SortOrder = "alpha" | "balance" | "giving";

const SORT_KEY = "ms_envelope_sort";

function sortWithinGroup(envelopes: Envelope[], sortOrder: SortOrder): Envelope[] {
  const copy = [...envelopes];
  if (sortOrder === "giving") return sortEnvelopesGivingFirst(copy);
  if (sortOrder === "alpha") return copy.sort((a, b) => a.name.localeCompare(b.name));
  return copy.sort((a, b) => b.balance.cents - a.balance.cents);
}

export default function EnvelopesScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const state = useAppStore((s) => s.state);
  const createGroup = useAppStore((s) => s.createEnvelopeGroup);
  const renameGroup = useAppStore((s) => s.renameEnvelopeGroup);
  const deleteGroup = useAppStore((s) => s.deleteEnvelopeGroup);

  const [sortOrder, setSortOrder] = useState<SortOrder>("giving");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Group name modal state
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [groupModalInput, setGroupModalInput] = useState("");
  const [groupModalTarget, setGroupModalTarget] = useState<EnvelopeGroup | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SORT_KEY).then((v) => {
      if (v === "alpha" || v === "balance" || v === "giving") setSortOrder(v);
    });
  }, []);

  function updateSort(order: SortOrder) {
    setSortOrder(order);
    AsyncStorage.setItem(SORT_KEY, order);
  }

  function toggleCollapse(groupId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function openCreateGroupModal() {
    setGroupModalTarget(null);
    setGroupModalInput("");
    setGroupModalVisible(true);
  }

  function openRenameGroupModal(group: EnvelopeGroup) {
    setGroupModalTarget(group);
    setGroupModalInput(group.name);
    setGroupModalVisible(true);
  }

  function handleGroupModalSave() {
    const name = groupModalInput.trim();
    if (!name) return;
    if (groupModalTarget) {
      renameGroup(groupModalTarget.id, name);
    } else {
      createGroup(name);
    }
    setGroupModalVisible(false);
  }

  function handleGroupLongPress(group: EnvelopeGroup) {
    if (group.id === "__ungrouped__") return;
    Alert.alert(group.name, undefined, [
      { text: "Rename", onPress: () => openRenameGroupModal(group) },
      {
        text: "Delete Group",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Delete Group",
            `Delete "${group.name}"? Envelopes in this group will become ungrouped.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => deleteGroup(group.id),
              },
            ],
          );
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  const sections = useMemo(() => {
    if (!state) return [];
    const groups = state.envelopeGroups ?? [];
    const grouped = groupEnvelopes(state.budget.envelopes, groups);
    return grouped.map((g) => ({
      group: g.group,
      data: sortWithinGroup(g.envelopes, sortOrder),
      totalCents: g.envelopes.reduce((sum, e) => sum + e.balance.cents, 0),
    }));
  }, [state, sortOrder]);

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const envelopes = state.budget.envelopes;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Envelopes</Text>
          <HelpTooltip
            title="Envelopes"
            body="A category in your budget — like a virtual jar for specific spending. Move money into envelopes to plan how you'll use it."
          />
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push("/allocate")}
            style={styles.allocateBtn}
            accessibilityLabel="Allocate funds"
          >
            <Text style={styles.allocateBtnText}>$ Allocate</Text>
          </Pressable>
          <Pressable
            onPress={openCreateGroupModal}
            style={styles.groupBtn}
            accessibilityLabel="Create group"
          >
            <Text style={styles.groupBtnText}>+ Group</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/create-envelope")}
            style={styles.addBtn}
            accessibilityLabel="Create envelope"
          >
            <Text style={styles.addBtnText}>+ New</Text>
          </Pressable>
        </View>
      </View>


      {envelopes.length === 0 ? (
        <Card style={styles.empty}>
          <Text style={styles.emptyText}>No envelopes yet.</Text>
          <Pressable
            onPress={() => router.push("/create-envelope")}
            style={styles.emptyBtn}
            accessibilityLabel="Create your first envelope"
          >
            <Text style={styles.emptyBtnText}>Create Envelope</Text>
          </Pressable>
        </Card>
      ) : (
        <>
          {/* Sort toggle */}
          <View style={styles.sortRow}>
            <Pressable
              style={[styles.sortChip, sortOrder === "giving" && styles.sortChipActive]}
              onPress={() => updateSort("giving")}
              accessibilityLabel="Sort giving first"
              accessibilityRole="button"
              accessibilityState={{ selected: sortOrder === "giving" }}
            >
              <Text style={[styles.sortChipText, sortOrder === "giving" && styles.sortChipTextActive]}>
                Giving first
              </Text>
            </Pressable>
            <Pressable
              style={[styles.sortChip, sortOrder === "alpha" && styles.sortChipActive]}
              onPress={() => updateSort("alpha")}
              accessibilityLabel="Sort alphabetically"
              accessibilityRole="button"
              accessibilityState={{ selected: sortOrder === "alpha" }}
            >
              <Text style={[styles.sortChipText, sortOrder === "alpha" && styles.sortChipTextActive]}>
                A–Z
              </Text>
            </Pressable>
            <Pressable
              style={[styles.sortChip, sortOrder === "balance" && styles.sortChipActive]}
              onPress={() => updateSort("balance")}
              accessibilityLabel="Sort by highest balance"
              accessibilityRole="button"
              accessibilityState={{ selected: sortOrder === "balance" }}
            >
              <Text style={[styles.sortChipText, sortOrder === "balance" && styles.sortChipTextActive]}>
                Balance ↓
              </Text>
            </Pressable>
          </View>

          <Card style={styles.listCard}>
            <SectionList
              sections={sections}
              keyExtractor={(e) => e.id}
              scrollEnabled={false}
              stickySectionHeadersEnabled={false}
              SectionSeparatorComponent={({ leadingItem, leadingSection, trailingSection }) =>
                leadingItem && trailingSection ? <View style={styles.sectionGap} /> : null
              }
              renderSectionHeader={({ section }) => {
                const isCollapsed = collapsed.has(section.group.id);
                const isUngrouped = section.group.id === "__ungrouped__";
                return (
                  <Pressable
                    style={styles.sectionHeader}
                    onPress={() => toggleCollapse(section.group.id)}
                    onLongPress={() => handleGroupLongPress(section.group)}
                    accessibilityLabel={`${section.group.name} group, ${isCollapsed ? "collapsed" : "expanded"}`}
                    accessibilityRole="button"
                  >
                    <View style={styles.sectionHeaderLeft}>
                      <Text style={styles.chevron}>
                        {isCollapsed ? "\u25B8" : "\u25BE"}
                      </Text>
                      <Text style={[styles.sectionHeaderName, isUngrouped && styles.sectionHeaderNameMuted]}>
                        {section.group.name}
                      </Text>
                      <Text style={styles.sectionCount}>
                        {section.data.length}
                      </Text>
                    </View>
                    <Text style={styles.sectionTotal}>
                      ${formatMoney(section.totalCents)}
                    </Text>
                  </Pressable>
                );
              }}
              renderItem={({ item, section }) => {
                if (collapsed.has(section.group.id)) return null;
                const isNegative = item.balance.cents < 0;
                const isZero = item.balance.cents === 0;
                const isGiving = item.type === "giving";
                const isDebt = item.type === "debt";
                const isSavings = item.type === "savings";
                return (
                  <Pressable
                    style={styles.row}
                    onPress={() => {
                      router.push({ pathname: "/envelope/[envelopeId]", params: { envelopeId: item.id } });
                    }}
                    accessibilityLabel={`${item.name} envelope`}
                    accessibilityRole="button"
                  >
                    <View style={styles.rowContent}>
                      <View style={styles.rowTop}>
                        <View style={styles.rowNameArea}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {item.name || "Unnamed envelope"}
                          </Text>
                          {isGiving && (
                            <View style={styles.givingBadge} accessibilityLabel="Giving envelope">
                              <Text style={styles.givingBadgeText}>GIVING</Text>
                            </View>
                          )}
                          {isDebt && (
                            <View style={styles.debtBadge} accessibilityLabel="Debt envelope">
                              <Text style={styles.debtBadgeText}>DEBT</Text>
                            </View>
                          )}
                          {isSavings && (
                            <View style={styles.savingsBadge} accessibilityLabel="Savings envelope">
                              <Text style={styles.savingsBadgeText}>SAVINGS</Text>
                            </View>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.rowBalance,
                            isNegative && styles.rowBalanceNegative,
                            isZero && styles.rowBalanceZero,
                          ]}
                        >
                          ${formatMoney(item.balance.cents)}
                        </Text>
                      </View>
                      {item.goal && item.goal.cents > 0 ? (
                        <View style={styles.progressArea}>
                          <ProgressBar balance={item.balance.cents} goal={item.goal.cents} />
                          <Text style={styles.goalHint}>
                            ${formatMoney(item.balance.cents)} of ${formatMoney(item.goal.cents)}
                          </Text>
                        </View>
                      ) : isZero ? (
                        <Text style={styles.needsFunding}>Needs funding</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              }}
            />
          </Card>
        </>
      )}

      {/* Create / Rename Group Modal */}
      <Modal
        visible={groupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGroupModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setGroupModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {groupModalTarget ? "Rename Group" : "New Group"}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={groupModalInput}
              onChangeText={setGroupModalInput}
              placeholder="Group name"
              placeholderTextColor={colors.textSubtle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleGroupModalSave}
            />
            <Pressable
              onPress={handleGroupModalSave}
              style={styles.modalSaveBtn}
            >
              <Text style={styles.modalSaveBtnText}>
                {groupModalTarget ? "Rename" : "Create"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setGroupModalVisible(false)}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    gap: Spacing.sm,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold, color: c.textDark },
  headerActions: { flexDirection: "row", gap: Spacing.sm },
  allocateBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: c.primary,
  },
  allocateBtnText: { color: c.primary, fontWeight: FontWeight.semibold, fontSize: FontSize.body },
  groupBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: c.border,
  },
  groupBtnText: { color: c.textMid, fontWeight: FontWeight.semibold, fontSize: FontSize.body },
  addBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: c.primary,
  },
  addBtnText: { color: c.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },

  // Sort toggle
  sortRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  sortChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  sortChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  sortChipText: { fontSize: FontSize.small, fontWeight: FontWeight.semibold, color: c.textMid },
  sortChipTextActive: { color: c.textOnColor },

  // Empty state
  empty: {
    padding: Spacing.lg,
    alignItems: "center",
    backgroundColor: c.surfaceLight,
    gap: Spacing.base,
  },
  emptyText: { fontSize: FontSize.subtitle, fontWeight: FontWeight.semibold, color: c.textDark },
  emptyBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: c.primary,
  },
  emptyBtnText: { color: c.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },

  // Section headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: c.surfaceLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, flex: 1 },
  chevron: { fontSize: FontSize.body, color: c.textMid, width: 16 },
  sectionHeaderName: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
    color: c.textDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionHeaderNameMuted: { color: c.textMuted, fontWeight: FontWeight.semibold },
  sectionCount: {
    fontSize: FontSize.caption,
    color: c.textMuted,
    backgroundColor: c.borderLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    overflow: "hidden",
  },
  sectionTotal: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, color: c.textDark },
  sectionGap: { height: Spacing.sm },

  // List
  listCard: { marginTop: Spacing.xs },
  row: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
  },
  rowContent: { gap: Spacing.sm },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowNameArea: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, flex: 1 },
  rowName: { fontSize: FontSize.subtitle, fontWeight: FontWeight.medium, color: c.textDark, flexShrink: 1 },
  rowBalance: { fontSize: FontSize.subtitle, fontWeight: FontWeight.semibold, color: c.textDark, marginLeft: Spacing.md },
  rowBalanceNegative: { color: c.error },
  rowBalanceZero: { color: c.textSubtle },

  // Progress + goal hint
  progressArea: { gap: 3 },
  goalHint: { fontSize: FontSize.caption, color: c.textMuted },
  needsFunding: { fontSize: FontSize.caption, color: c.textSubtle, fontStyle: "italic" },

  // Type badges
  givingBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    backgroundColor: c.givingSurface,
  },
  givingBadgeText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: c.giving,
    letterSpacing: 0.5,
  },
  debtBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    backgroundColor: c.debtSurface,
  },
  debtBadgeText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: c.debt,
    letterSpacing: 0.5,
  },
  savingsBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    backgroundColor: c.primarySurface,
  },
  savingsBadgeText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: c.primary,
    letterSpacing: 0.5,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: c.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: "85%",
    maxWidth: 360,
    gap: Spacing.md,
  },
  modalTitle: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, color: c.textDark, textAlign: "center" },
  modalInput: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.medium,
    color: c.textDark,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.md,
  },
  modalSaveBtn: {
    backgroundColor: c.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  modalSaveBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: c.textOnColor },
  modalCancelBtn: {
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  modalCancelBtnText: { fontSize: FontSize.body, color: c.textMuted },
});
