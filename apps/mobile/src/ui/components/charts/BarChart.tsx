import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Rect } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Color, FontSize, FontWeight, Spacing } from "../../tokens";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export type Bar = {
  value: number;
  color: string;
  label: string;
};

type Props = {
  bars: Bar[];
  /** Chart height in dp (default 120) */
  height?: number;
  /** Width of each bar in dp (default 28) */
  barWidth?: number;
  /** Gap between bars in dp (default 12) */
  gap?: number;
};

/**
 * Vertical bar chart built on react-native-svg + reanimated.
 * Bars animate upward from the baseline on mount.
 */
export function BarChart({
  bars,
  height = 120,
  barWidth = 28,
  gap = 12,
}: Props) {
  const maxValue = Math.max(...bars.map((b) => Math.abs(b.value)), 1);
  const totalWidth = bars.length * barWidth + (bars.length - 1) * gap;

  return (
    <View style={[styles.container, { width: totalWidth }]}>
      <Svg width={totalWidth} height={height}>
        {bars.map((bar, i) => {
          const barHeight = (Math.abs(bar.value) / maxValue) * (height - 20);
          const x = i * (barWidth + gap);
          const y = height - barHeight;
          return (
            <AnimatedBar
              key={bar.label + i}
              x={x}
              y={y}
              width={barWidth}
              targetHeight={barHeight}
              fullHeight={height}
              color={bar.color}
              delay={i * 60}
              rx={4}
            />
          );
        })}
      </Svg>
      <View style={[styles.labels, { width: totalWidth }]}>
        {bars.map((bar, i) => (
          <Text
            key={bar.label + i}
            style={[styles.label, { width: barWidth + gap }]}
            numberOfLines={1}
          >
            {bar.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

type AnimatedBarProps = {
  x: number;
  y: number;
  width: number;
  targetHeight: number;
  fullHeight: number;
  color: string;
  delay: number;
  rx: number;
};

function AnimatedBar({
  x,
  width,
  targetHeight,
  fullHeight,
  color,
  delay,
  rx,
}: AnimatedBarProps) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared value ref is stable
  }, []);

  const animatedProps = useAnimatedProps(() => {
    const h = targetHeight * progress.value;
    return {
      y: fullHeight - h,
      height: h,
    };
  });

  return (
    <AnimatedRect
      x={x}
      width={width}
      rx={rx}
      fill={color}
      animatedProps={animatedProps}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  labels: {
    flexDirection: "row",
    marginTop: Spacing.xs,
  },
  label: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    color: Color.textMuted,
    textAlign: "center",
  },
});
