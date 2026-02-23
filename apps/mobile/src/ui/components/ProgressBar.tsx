import React from "react";
import { View, StyleSheet } from "react-native";
import { Radius, Color } from "../tokens";

type Props = {
  /** Current balance in cents */
  balance: number;
  /** Optional goal/target in cents — enables ratio-based progress */
  goal?: number;
};

function getColor(ratio: number, isNegative: boolean): string {
  if (isNegative) return Color.error;
  if (ratio > 0.3) return Color.success;
  if (ratio > 0.1) return Color.warning;
  return Color.error;
}

export function ProgressBar({ balance, goal }: Props) {
  const isNegative = balance < 0;

  let ratio: number;
  let color: string;

  if (goal && goal > 0) {
    // Goal mode: balance / goal, clamped 0–1
    ratio = Math.max(0, Math.min(1, balance / goal));
    color = getColor(ratio, isNegative);
  } else {
    // Status mode: full if positive, empty if zero, full red if negative
    if (isNegative) {
      ratio = 1;
      color = Color.error;
    } else if (balance === 0) {
      ratio = 0;
      color = Color.success;
    } else {
      ratio = 1;
      color = Color.success;
    }
  }

  return (
    <View style={styles.track}>
      {ratio > 0 && (
        <View
          style={[
            styles.fill,
            { width: `${Math.round(ratio * 100)}%`, backgroundColor: color },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    borderRadius: Radius.pill,
    backgroundColor: Color.borderLight,
    overflow: "hidden",
  },
  fill: {
    height: 3,
    borderRadius: Radius.pill,
  },
});
