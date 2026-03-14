import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useAppStore } from "../../src/store/useAppStore";
import {
  Spacing,
  Radius,
  FontSize,
  FontWeight,
  Shadow,
  type ColorTokens,
} from "../../src/ui/tokens";
import { useThemedStyles } from "@/src/ui/ThemeProvider";

export default function InsightsScreen() {
  const styles = useThemedStyles(createStyles);
  const state = useAppStore((s) => s.state);

  if (!state) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const hasTxns = state.transactions.length > 0;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Spending section */}
        <Text style={styles.sectionLabel}>SPENDING</Text>
        <View style={styles.card}>
          {hasTxns ? (
            <Text style={styles.placeholderText}>
              Spending breakdown coming soon.
            </Text>
          ) : (
            <Text style={styles.placeholderText}>
              Add transactions to see your spending breakdown.
            </Text>
          )}
        </View>

        {/* Progress section */}
        <Text style={styles.sectionLabel}>PROGRESS</Text>
        <View style={styles.card}>
          <Text style={styles.placeholderText}>
            Weekly nudges and debt progress coming soon.
          </Text>
        </View>

        {/* Forecast section */}
        <Text style={styles.sectionLabel}>FORECAST</Text>
        <View style={styles.card}>
          <Text style={styles.placeholderText}>
            Cash flow forecast coming soon.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.surface },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    loadingText: { fontSize: FontSize.body, color: c.textMuted },
    header: {
      paddingHorizontal: Spacing.base,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    title: {
      fontSize: FontSize.title,
      fontWeight: FontWeight.bold,
      color: c.textDark,
    },
    scroll: { flex: 1 },
    content: {
      padding: Spacing.base,
      paddingBottom: Spacing.bottomPad,
      gap: Spacing.xs,
    },
    sectionLabel: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.semibold,
      color: c.textMuted,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginTop: Spacing.base,
      marginBottom: Spacing.xs,
    },
    card: {
      backgroundColor: c.cardSurface,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      ...Shadow.sm,
    },
    placeholderText: {
      fontSize: FontSize.body,
      color: c.textSubtle,
      textAlign: "center",
      letterSpacing: 0,
    },
  });
