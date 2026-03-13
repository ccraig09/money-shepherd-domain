import React, { useRef, useEffect } from "react";
import { Animated, View, StyleSheet } from "react-native";
import { Radius, type ColorTokens } from "../tokens";
import { useThemedStyles, useTheme } from "../ThemeProvider";

type Props = {
  /** Current balance in cents */
  balance: number;
  /** Optional goal/target in cents — enables ratio-based progress */
  goal?: number;
};

function getColor(ratio: number, isNegative: boolean, colors: ColorTokens): string {
  if (isNegative) return colors.error;
  if (ratio > 0.7) return colors.success;
  if (ratio > 0.3) return colors.primary;
  return colors.warning;
}

export function ProgressBar({ balance, goal }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  const isNegative = balance < 0;

  let ratio: number;
  let color: string;

  if (goal && goal > 0) {
    ratio = Math.max(0, Math.min(1, balance / goal));
    color = getColor(ratio, isNegative, colors);
  } else {
    if (isNegative) {
      ratio = 1;
      color = colors.error;
    } else if (balance === 0) {
      ratio = 0;
      color = colors.success;
    } else {
      ratio = 1;
      color = colors.success;
    }
  }

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [anim]);

  const widthPercent = Math.round(ratio * 100);

  return (
    <View style={styles.track}>
      {ratio > 0 && (
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              shadowColor: color,
              width: anim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", `${widthPercent}%`],
              }),
            },
          ]}
        />
      )}
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  track: {
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: c.borderLight,
  },
  fill: {
    height: 6,
    borderRadius: Radius.pill,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
