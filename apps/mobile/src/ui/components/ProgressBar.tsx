import React, { useRef, useEffect, useState } from "react";
import { Animated, View, StyleSheet, type LayoutChangeEvent } from "react-native";
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from "react-native-svg";
import { Radius, type ColorTokens } from "../tokens";
import { useThemedStyles, useTheme } from "../ThemeProvider";

type Props = {
  /** Current balance in cents */
  balance: number;
  /** Optional goal/target in cents — enables ratio-based progress */
  goal?: number;
};

export function ProgressBar({ balance, goal }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  const isNegative = balance < 0;

  let ratio: number;

  if (goal && goal > 0) {
    ratio = Math.max(0, Math.min(1, balance / goal));
  } else {
    if (isNegative) {
      ratio = 1;
    } else if (balance === 0) {
      ratio = 0;
    } else {
      ratio = 1;
    }
  }

  const useGrad = !isNegative && ratio > 0;
  const solidColor = isNegative ? colors.error : colors.success;
  const glowColor = isNegative ? colors.error : colors.successGradientEnd;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [anim]);

  const widthPercent = Math.round(ratio * 100);

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  return (
    <View style={styles.track} onLayout={onLayout}>
      {ratio > 0 && trackWidth > 0 && (
        <Animated.View
          style={[
            styles.fill,
            {
              shadowColor: glowColor,
              width: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, (widthPercent / 100) * trackWidth],
              }),
            },
            !useGrad && { backgroundColor: solidColor },
          ]}
        >
          {useGrad && (
            <Svg width={trackWidth} height={6}>
              <Defs>
                <SvgGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={colors.successGradientStart} />
                  <Stop offset="1" stopColor={colors.successGradientEnd} />
                </SvgGradient>
              </Defs>
              <Rect x="0" y="0" width={trackWidth} height={6} rx={3} fill="url(#barGrad)" />
            </Svg>
          )}
        </Animated.View>
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
    overflow: "hidden",
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
});
