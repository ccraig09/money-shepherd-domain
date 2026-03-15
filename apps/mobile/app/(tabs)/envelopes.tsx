import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  SectionList,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  Animated,
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
import { Confetti, type ConfettiRef } from "../../src/ui/components/Confetti";
import { Spacing, Radius, FontSize, FontWeight, Shadow, type ColorTokens } from "../../src/ui/tokens";
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

  // Confetti + celebration tracking
  const confettiRef = useRef<ConfettiRef>(null);
  const celebrated = useRef(new Set<string>()).current;
  const mountedRef = useRef(false);
  const showToast = useAppStore((s) => s.showToast);

  // Pre-populate celebrated set on first render so we don't fire for already-completed goals
  useEffect(() => {
    if (!state || mountedRef.current) return;
    mountedRef.current = true;
    for (const env of state.budget.envelopes) {
      if (env.goal && env.goal.cents > 0 && env.balance.cents >= env.goal.cents) {
        celebrated.add(env.id);
      }
    }
  }, [state, celebrated]);

  // Group name modal state
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [groupModalInput, setGroupModalInput] = useState("");
  const [groupModalTarget, setGroupModalTarget] = useState<EnvelopeGroup | null>(null);

  // Chevron rotation animations — one per group
  const chevronAnims = useRef(new Map<string, Animated.Value>()).current;
  const getChevronAnim = useCallback((groupId: string, isCollapsed: boolean) => {
    if (!chevronAnims.has(groupId)) {
      chevronAnims.set(groupId, new Animated.Value(isCollapsed ? 0 : 1));
    }
    return chevronAnims.get(groupId)!;
  }, [chevronAnims]);

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
      const willCollapse = !next.has(groupId);
      if (willCollapse) next.add(groupId);
      else next.delete(groupId);

      // Animate chevron
      const anim = chevronAnims.get(groupId);
      if (anim) {
        Animated.spring(anim, {
          toValue: willCollapse ? 0 : 1,
          useNativeDriver: true,
          speed: 20,
          bounciness: 4,
        }).start();
      }

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
      <Confetti ref={confettiRef} />
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
            style={styles.actionChip}
            accessibilityLabel="Allocate funds"
          >
            <Text style={styles.actionChipIcon}>$</Text>
            <Text style={styles.actionChipLabel}>Allocate</Text>
          </Pressable>
          <Pressable
            onPress={openCreateGroupModal}
            style={styles.actionChip}
            accessibilityLabel="Create group"
          >
            <Text style={styles.actionChipIcon}>⊞</Text>
            <Text style={styles.actionChipLabel}>Group</Text>
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

            <SectionList
              style={styles.listCard}
              contentContainerStyle={styles.listContent}
              sections={sections}
              keyExtractor={(e) => e.id}
              stickySectionHeadersEnabled={false}
              SectionSeparatorComponent={({ leadingItem, leadingSection, trailingSection }) =>
                leadingItem && trailingSection ? <View style={styles.sectionGap} /> : null
              }
              renderSectionHeader={({ section }) => {
                const isCollapsed = collapsed.has(section.group.id);
                const isUngrouped = section.group.id === "__ungrouped__";
                const chevronAnim = getChevronAnim(section.group.id, isCollapsed);
                const chevronRotate = chevronAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "90deg"],
                });
                return (
                  <Pressable
                    style={styles.sectionHeader}
                    onPress={() => toggleCollapse(section.group.id)}
                    onLongPress={() => handleGroupLongPress(section.group)}
                    accessibilityLabel={`${section.group.name} group, ${isCollapsed ? "collapsed" : "expanded"}`}
                    accessibilityRole="button"
                  >
                    <View style={styles.sectionHeaderLeft}>
                      <Animated.Text
                        style={[
                          styles.chevron,
                          { transform: [{ rotate: chevronRotate }] },
                        ]}
                      >
                        {"\u25B8"}
                      </Animated.Text>
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

                // Celebrate goal completion (once per envelope)
                if (
                  item.goal &&
                  item.goal.cents > 0 &&
                  item.balance.cents >= item.goal.cents &&
                  !celebrated.has(item.id)
                ) {
                  celebrated.add(item.id);
                  setTimeout(() => {
                    confettiRef.current?.fire();
                    showToast(`${item.name} goal reached! 🎉`, "info");
                  }, 0);
                }

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
                        <View
                          style={[
                            styles.amountBadge,
                            isNegative
                              ? styles.amountBadgeNegative
                              : isZero
                                ? styles.amountBadgeZero
                                : styles.amountBadgeFunded,
                          ]}
                        >
                          <Text
                            style={[
                              styles.amountBadgeText,
                              isNegative
                                ? styles.amountBadgeTextNegative
                                : isZero
                                  ? styles.amountBadgeTextZero
                                  : styles.amountBadgeTextFunded,
                            ]}
                          >
                            ${formatMoney(item.balance.cents)}
                          </Text>
                        </View>
                      </View>
                      {item.goal && item.goal.cents > 0 ? (
                        <View style={styles.progressArea}>
                          <ProgressBar balance={item.balance.cents} goal={item.goal.cents} />
                          <Text style={[styles.goalHint, item.balance.cents >= item.goal.cents && styles.goalHintFunded]}>
                            {item.balance.cents >= item.goal.cents
                              ? "Funded"
                              : `$${formatMoney(item.goal.cents - item.balance.cents)} more needed`}
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
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    gap: Spacing.sm,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold, color: c.textDark },
  headerActions: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: c.surfaceLight,
  },
  actionChipIcon: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
    color: c.textMid,
  },
  actionChipLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: c.textMid,
  },
  addBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: c.primary,
  },
  addBtnText: { color: c.textOnColor, fontWeight: FontWeight.bold, fontSize: FontSize.small },

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
  listContent: { paddingBottom: Spacing.bottomPad },
  row: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    minHeight: 44,
    backgroundColor: c.cardSurface,
    borderRadius: Radius.lg,
    ...Shadow.sm,
  },
  rowContent: { gap: Spacing.sm },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowNameArea: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, flex: 1 },
  rowName: { fontSize: FontSize.subtitle, fontWeight: FontWeight.medium, color: c.textDark, flexShrink: 1 },
  amountBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    marginLeft: Spacing.sm,
  },
  amountBadgeFunded: { backgroundColor: c.primarySurface },
  amountBadgeZero: { backgroundColor: c.surfaceLight },
  amountBadgeNegative: { backgroundColor: c.errorSurface },
  amountBadgeText: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
  },
  amountBadgeTextFunded: { color: c.primaryDark },
  amountBadgeTextZero: { color: c.textSubtle },
  amountBadgeTextNegative: { color: c.error },

  // Progress + goal hint
  progressArea: { gap: 3 },
  goalHint: { fontSize: FontSize.caption, color: c.textMuted },
  goalHintFunded: { color: c.success, fontWeight: FontWeight.semibold },
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
    letterSpacing: 0,
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
