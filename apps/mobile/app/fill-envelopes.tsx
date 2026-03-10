import React, { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { getCurrentPeriod, getFundingInPeriod } from "@money-shepherd/domain";
import { useAppStore } from "../src/store/useAppStore";
import { parseDollars, formatCents } from "../src/lib/moneyInput";
import { formatMoney } from "../src/lib/moneyFormat";
import { MoneyInput } from "../src/ui/components/MoneyInput";
import { ProgressBar } from "../src/ui/components/ProgressBar";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../src/ui/tokens";
import { useThemedStyles } from "@/src/ui/ThemeProvider";
import { Features } from "../src/config/features";

export default function FillEnvelopesScreen() {
  const styles = useThemedStyles(createStyles);

  const state = useAppStore((s) => s.state);
  const fillEnvelopes = useAppStore((s) => s.fillEnvelopes);

  const period = useMemo(() => getCurrentPeriod(new Date().toISOString()), []);

  const envelopesWithGoals = useMemo(() => {
    if (!state) return [];
    return state.budget.envelopes
      .filter((e) => e.goal && e.goal.cents > 0)
      .map((env) => {
        const fundedCents = getFundingInPeriod(
          state.allocations ?? [],
          env.id,
          period,
        ).cents;
        const remainingCents = Math.max(0, env.goal!.cents - fundedCents);
        return { ...env, fundedCents, remainingCents };
      });
  }, [state, period]);

  const envelopesWithoutGoals = useMemo(() => {
    if (!state) return [];
    return state.budget.envelopes.filter((e) => !e.goal || e.goal.cents === 0);
  }, [state]);

  // Per-envelope input amounts (keyed by envelope ID)
  const [amounts, setAmounts] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  // Pre-fill amounts when envelope data loads
  React.useEffect(() => {
    if (envelopesWithGoals.length === 0) return;
    const initial: Record<string, string> = {};
    for (const env of envelopesWithGoals) {
      if (env.remainingCents > 0) {
        initial[env.id] = formatCents(env.remainingCents);
      }
    }
    setAmounts(initial);
  }, [envelopesWithGoals]);

  // Compute total across all inputs
  const totalCents = useMemo(() => {
    let sum = 0;
    for (const val of Object.values(amounts)) {
      const parsed = parseDollars(val);
      if (parsed.ok) sum += parsed.cents;
    }
    return sum;
  }, [amounts]);

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const available = state.budget.availableToAssign.cents;
  const isZeroAvailable = available <= 0;
  const isOverBudget = totalCents > available;

  function updateAmount(envelopeId: string, value: string) {
    setAmounts((prev) => ({ ...prev, [envelopeId]: value }));
  }

  async function handleFill() {
    const items: { envelopeId: string; amountCents: number }[] = [];
    for (const [envelopeId, raw] of Object.entries(amounts)) {
      const parsed = parseDollars(raw);
      if (parsed.ok && parsed.cents > 0) {
        items.push({ envelopeId, amountCents: parsed.cents });
      }
    }
    if (items.length === 0) return;

    setSaving(true);
    try {
      await fillEnvelopes(items);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Available balance */}
        <View style={styles.availableCard}>
          <Text style={styles.availableLabel}>Available to Assign</Text>
          <Text style={[styles.availableAmount, isZeroAvailable && styles.availableZero]}>
            ${formatMoney(available)}
          </Text>
          {isZeroAvailable && (
            <>
              <Text style={styles.zeroHint}>Add income to begin filling envelopes.</Text>
              <Pressable
                onPress={() => {
                  router.back();
                  router.push("/add-transaction");
                }}
                style={styles.addIncomeBtn}
                accessibilityLabel="Add income"
              >
                <Text style={styles.addIncomeBtnText}>Add income</Text>
              </Pressable>
            </>
          )}
        </View>

        {!isZeroAvailable && (
          <>
            {/* Period label */}
            <Text style={styles.periodLabel}>{period.label}</Text>

            {/* Envelopes with goals */}
            {envelopesWithGoals.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Envelopes with goals</Text>
                {envelopesWithGoals.map((env) => (
                  <View key={env.id} style={styles.envelopeCard}>
                    <View style={styles.envelopeHeader}>
                      <Text style={styles.envelopeName} numberOfLines={1}>
                        {env.name}
                      </Text>
                      <Text style={styles.envelopeProgress}>
                        ${formatMoney(env.fundedCents)} / ${formatMoney(env.goal!.cents)}
                      </Text>
                    </View>
                    <ProgressBar balance={env.fundedCents} goal={env.goal?.cents} />
                    <MoneyInput
                      value={amounts[env.id] ?? ""}
                      onChangeText={(val) => updateAmount(env.id, val)}
                      error={null}
                      onErrorClear={() => {}}
                      placeholder="0.00"
                      accessibilityLabel={`Amount for ${env.name}`}
                    />
                  </View>
                ))}
              </>
            )}

            {/* Envelopes without goals */}
            {envelopesWithoutGoals.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Other envelopes</Text>
                {envelopesWithoutGoals.map((env) => (
                  <View key={env.id} style={styles.envelopeCard}>
                    <View style={styles.envelopeHeader}>
                      <Text style={styles.envelopeName} numberOfLines={1}>
                        {env.name}
                      </Text>
                      <Text style={styles.envelopeBalance}>
                        ${formatMoney(env.balance.cents)}
                      </Text>
                    </View>
                    <MoneyInput
                      value={amounts[env.id] ?? ""}
                      onChangeText={(val) => updateAmount(env.id, val)}
                      error={null}
                      onErrorClear={() => {}}
                      placeholder="0.00"
                      accessibilityLabel={`Amount for ${env.name}`}
                    />
                  </View>
                ))}
              </>
            )}

            {/* Warning banner */}
            {isOverBudget && (
              <View style={styles.warningBanner}>
                <Text style={styles.warningText}>
                  Total ${formatMoney(totalCents)} exceeds available ${formatMoney(available)}
                </Text>
              </View>
            )}

            {/* Footer */}
            <View style={styles.footer}>
              {Features.AI_ADVISOR && (
                <Pressable
                  onPress={() => router.push("/ai-allocate")}
                  style={styles.aiBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Get AI allocation suggestions"
                >
                  <Text style={styles.aiBtnText}>✦ AI Suggest</Text>
                </Pressable>
              )}
              <Text style={styles.totalLabel}>
                Total: ${formatMoney(totalCents)}
              </Text>
              <Pressable
                onPress={handleFill}
                disabled={totalCents === 0 || isOverBudget || saving}
                style={[
                  styles.fillBtn,
                  (totalCents === 0 || isOverBudget || saving) && styles.fillBtnDisabled,
                ]}
                accessibilityLabel="Fill envelopes"
              >
                <Text style={styles.fillBtnText}>
                  {saving ? "Filling..." : "Fill Envelopes"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.back()}
                style={styles.cancelBtn}
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.bottomPad },

  // Available card
  availableCard: {
    backgroundColor: c.primarySurface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  availableLabel: { fontSize: FontSize.small, color: c.textMid, fontWeight: FontWeight.medium },
  availableAmount: { fontSize: FontSize.title, fontWeight: FontWeight.extrabold, color: c.success },
  availableZero: { color: c.textDisabled },
  zeroHint: { fontSize: FontSize.small, color: c.error, textAlign: "center", marginTop: Spacing.xs },
  addIncomeBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: c.success,
  },
  addIncomeBtnText: { color: c.textOnColor, fontWeight: FontWeight.semibold, fontSize: FontSize.body },

  // Period
  periodLabel: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: c.textDark,
    textAlign: "center",
    marginBottom: Spacing.xs,
  },

  // Section
  sectionLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: c.textMid,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },

  // Envelope card
  envelopeCard: {
    backgroundColor: c.surfaceLight,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  envelopeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  envelopeName: { fontSize: FontSize.body, fontWeight: FontWeight.medium, color: c.textDark, flex: 1 },
  envelopeProgress: { fontSize: FontSize.small, color: c.textMuted, fontWeight: FontWeight.medium },
  envelopeBalance: { fontSize: FontSize.small, color: c.success, fontWeight: FontWeight.medium },

  // Warning
  warningBanner: {
    backgroundColor: c.warningSurface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: c.borderWarning,
    marginTop: Spacing.sm,
  },
  warningText: { fontSize: FontSize.small, color: c.nudgeText, fontWeight: FontWeight.medium, textAlign: "center" },

  // Footer
  footer: { marginTop: Spacing.md, gap: Spacing.sm },
  aiBtn: {
    borderWidth: 1,
    borderColor: c.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  aiBtnText: { color: c.primary, fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  totalLabel: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: c.textDark,
    textAlign: "center",
  },
  fillBtn: {
    backgroundColor: c.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  fillBtnDisabled: { opacity: 0.4 },
  fillBtnText: { color: c.textOnColor, fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  cancelBtn: { alignItems: "center", paddingVertical: Spacing.sm },
  cancelText: { fontSize: FontSize.body, color: c.textMuted },
});
