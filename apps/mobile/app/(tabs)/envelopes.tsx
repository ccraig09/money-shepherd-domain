import React from "react";
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

export default function EnvelopesScreen() {
  const state = useAppStore((s) => s.state);

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
        <Card style={styles.listCard}>
          <FlatList
            data={envelopes}
            keyExtractor={(e) => e.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
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
                <Text style={styles.rowBalance}>
                  ${formatMoney(item.balance.cents)}
                </Text>
              </Pressable>
            )}
          />
        </Card>
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
  title: { fontSize: 24, fontWeight: FontWeight.bold },
  headerActions: { flexDirection: "row", gap: Spacing.sm },
  allocateBtn: {
    paddingHorizontal: 14,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.primary,
  },
  allocateBtnText: { color: Color.primary, fontWeight: FontWeight.semibold, fontSize: 14 },
  addBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Color.primary,
  },
  addBtnText: { color: Color.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },
  empty: {
    padding: 20,
    alignItems: "center",
    backgroundColor: Color.surfaceLight,
    gap: Spacing.base,
  },
  emptyText: { fontSize: 17, fontWeight: FontWeight.semibold, color: Color.textDark },
  emptyBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Color.primary,
  },
  emptyBtnText: { color: Color.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },
  listCard: { marginTop: Spacing.sm },
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
});
