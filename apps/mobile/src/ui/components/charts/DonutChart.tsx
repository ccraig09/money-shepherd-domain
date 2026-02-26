import React from "react";
import { View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Color } from "../../tokens";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type DonutSegment = {
  value: number;
  color: string;
  label: string;
};

type Props = {
  segments: DonutSegment[];
  /** Outer diameter in dp (default 120) */
  size?: number;
  /** Stroke width in dp (default 14) */
  strokeWidth?: number;
};

/**
 * Donut chart built on react-native-svg + reanimated.
 * Segments are drawn as stroke-dasharray arcs around a circle.
 */
export function DonutChart({
  segments,
  size = 120,
  strokeWidth = 14,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={Color.borderLight}
            strokeWidth={strokeWidth}
            fill="none"
          />
        </Svg>
      </View>
    );
  }

  let cumulative = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((segment) => {
      const ratio = segment.value / total;
      const offset = cumulative;
      cumulative += ratio;
      return { ...segment, ratio, offset };
    });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${center}, ${center}`}>
          {arcs.map((arc, i) => (
            <AnimatedArc
              key={arc.label + i}
              cx={center}
              cy={center}
              r={radius}
              color={arc.color}
              strokeWidth={strokeWidth}
              circumference={circumference}
              ratio={arc.ratio}
              offset={arc.offset}
              delay={i * 80}
            />
          ))}
        </G>
      </Svg>
    </View>
  );
}

type ArcProps = {
  cx: number;
  cy: number;
  r: number;
  color: string;
  strokeWidth: number;
  circumference: number;
  ratio: number;
  offset: number;
  delay: number;
};

function AnimatedArc({
  cx,
  cy,
  r,
  color,
  strokeWidth,
  circumference,
  ratio,
  offset,
  delay,
}: ArcProps) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared value ref is stable
  }, []);

  const animatedProps = useAnimatedProps(() => {
    const dashLen = circumference * ratio * progress.value;
    const gap = circumference - dashLen;
    return {
      strokeDasharray: [dashLen, gap] as unknown as string,
      strokeDashoffset: -circumference * offset,
    };
  });

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={r}
      stroke={color}
      strokeWidth={strokeWidth}
      fill="none"
      strokeLinecap="round"
      animatedProps={animatedProps}
    />
  );
}
