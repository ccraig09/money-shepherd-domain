import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";
import { formatMoney } from "../../src/lib/moneyFormat";
import { Card } from "../../src/ui/components/Card";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../../src/ui/tokens";

type SortOrder = "alpha" | "balance";

export default function EnvelopesScreen() {
  const state = useAppStore((s) => s.state);
  const [sortOrder, setSortOrder] = useState<SortOrder>("alpha");

  const sortedEnvelopes = useMemo(() => {
    if (!state) return [];
    const envelopes = [...state.budget.envelopes];
    if (sortOrder === "alpha") {
      return envelopes.sort((a, b) => a.name.localeCompare(b.name));
    }
    return envelopes.sort((a, b) => b.balance.cents - a.balance.cents);
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
        <Text style={styles.title}>Envelopes</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push("/allocate")}
            style={styles.allocateBtn}
            accessibilityLabel="Allocate funds"
          >
            <Text style={styles.allocateBtnText}>$ Allocate</Text>
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
              style={[styles.sortChip, sortOrder === "alpha" && styles.sortChipActive]}
              onPress={() => setSortOrder("alpha")}
              accessibilityLabel="Sort alphabetically"
            >
              <Text style={[styles.sortChipText, sortOrder === "alpha" && styles.sortChipTextActive]}>
                A–Z
              </Text>
            </Pressable>
            <Pressable
              style={[styles.sortChip, sortOrder === "balance" && styles.sortChipActive]}
              onPress={() => setSortOrder("balance")}
              accessibilityLabel="Sort by highest balance"
            >
              <Text style={[styles.sortChipText, sortOrder === "balance" && styles.sortChipTextActive]}>
                Balance ↓
              </Text>
            </Pressable>
          </View>

          <Card style={styles.listCard}>
            <FlatList
              data={sortedEnvelopes}
              keyExtractor={(e) => e.id}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const isNegative = item.balance.cents < 0;
                const isZero = item.balance.cents === 0;
                return (
                  <Pressable
                    style={styles.row}
                    onPress={() => {
                      router.push({ pathname: "/envelope/[envelopeId]", params: { envelopeId: item.id } });
                    }}
                    accessibilityLabel={`${item.name} envelope`}
                  >
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.name || "Unnamed envelope"}
                    </Text>
                    <Text
                      style={[
                        styles.rowBalance,
                        isNegative && styles.rowBalanceNegative,
                        isZero && styles.rowBalanceZero,
                      ]}
                    >
                      ${formatMoney(item.balance.cents)}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </Card>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Color.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.border,
  },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold, color: Color.textDark },
  headerActions: { flexDirection: "row", gap: Spacing.sm },
  allocateBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.primary,
  },
  allocateBtnText: { color: Color.primary, fontWeight: FontWeight.semibold, fontSize: FontSize.body },
  addBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Color.primary,
  },
  addBtnText: { color: Color.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },

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
    borderColor: Color.border,
    backgroundColor: Color.surface,
  },
  sortChipActive: {
    backgroundColor: Color.primary,
    borderColor: Color.primary,
  },
  sortChipText: { fontSize: FontSize.small, fontWeight: FontWeight.semibold, color: Color.textMid },
  sortChipTextActive: { color: Color.textOnColor },

  // Empty state
  empty: {
    padding: Spacing.lg,
    alignItems: "center",
    backgroundColor: Color.surfaceLight,
    gap: Spacing.base,
  },
  emptyText: { fontSize: FontSize.subtitle, fontWeight: FontWeight.semibold, color: Color.textDark },
  emptyBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Color.primary,
  },
  emptyBtnText: { color: Color.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },

  // List
  listCard: { marginTop: Spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Color.borderLight,
  },
  rowName: { fontSize: FontSize.subtitle, fontWeight: FontWeight.medium, color: Color.textDark, flex: 1 },
  rowBalance: { fontSize: FontSize.subtitle, fontWeight: FontWeight.semibold, color: Color.textDark, marginLeft: Spacing.md },
  rowBalanceNegative: { color: Color.error },
  rowBalanceZero: { color: Color.textMuted },
});
