import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FontSize, FontWeight, Spacing, type ColorTokens } from "../tokens";
import { useThemedStyles, useTheme } from "../ThemeProvider";

type Props = {
  /** Amount set aside / paid in cents */
  paidCents: number;
  /** Total debt target in cents */
  targetCents: number;
};

const MILESTONES = [25, 50, 75];

function getProgressColor(pct: number, colors: ColorTokens): string {
  if (pct >= 100) return colors.success;
  if (pct >= 75) return colors.success;
  if (pct >= 50) return colors.primary;
  if (pct >= 25) return colors.warning;
  return colors.debt;
}

export function DebtProgressBar({ paidCents, targetCents }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  if (targetCents <= 0) return null;

  const pct = Math.min(100, Math.round((paidCents / targetCents) * 100));
  const isPaidOff = paidCents >= targetCents;
  const fillColor = getProgressColor(pct, colors);

  if (isPaidOff) {
    return (
      <View style={styles.paidOffRow}>
        <View style={[styles.track, styles.trackPaidOff]}>
          <View style={[styles.fill, { width: "100%", backgroundColor: colors.success }]} />
        </View>
        <Text style={styles.paidOffText}>Paid off!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        {pct > 0 && (
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fillColor }]} />
        )}
        {MILESTONES.map((m) => (
          <View
            key={m}
            style={[styles.milestone, { left: `${m}%` }, pct >= m && styles.milestoneReached]}
          />
        ))}
      </View>
      <View style={styles.labelRow}>
        <Text style={[styles.pctText, { color: fillColor }]}>{pct}%</Text>
        {pct >= 25 && pct < 50 && <Text style={styles.milestoneLabel}>Quarter way!</Text>}
        {pct >= 50 && pct < 75 && <Text style={styles.milestoneLabel}>Halfway there!</Text>}
        {pct >= 75 && pct < 100 && <Text style={styles.milestoneLabel}>Almost free!</Text>}
      </View>
    </View>
  );
}

const TRACK_HEIGHT = 6;
const MILESTONE_SIZE = 10;

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: { gap: Spacing.xs },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: c.borderLight,
    overflow: "visible",
    position: "relative",
  },
  trackPaidOff: { overflow: "hidden" },
  fill: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    position: "absolute",
    left: 0,
    top: 0,
  },
  milestone: {
    position: "absolute",
    top: (TRACK_HEIGHT - MILESTONE_SIZE) / 2,
    width: MILESTONE_SIZE,
    height: MILESTONE_SIZE,
    borderRadius: MILESTONE_SIZE / 2,
    marginLeft: -MILESTONE_SIZE / 2,
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.borderLight,
  },
  milestoneReached: {
    borderColor: c.success,
    backgroundColor: c.successSurface,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pctText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  milestoneLabel: {
    fontSize: FontSize.caption,
    color: c.textMuted,
    fontStyle: "italic",
  },
  paidOffRow: { gap: Spacing.xs },
  paidOffText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    color: c.success,
  },
});
