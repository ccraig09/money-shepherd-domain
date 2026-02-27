import React from "react";
import { View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "../../ThemeProvider";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type DonutSegment = {
  value: number;
  color: string;
  label: string;
};

type Props = {
  segments: DonutSegment[];
  /** Outer diameter in dp (default 170) */
  size?: number;
  /** Stroke width in dp (default 22) */
  strokeWidth?: number;
};

/** Gap between segments in dp — creates clean visual separation */
const SEGMENT_GAP_PX = 4;

/**
 * Donut chart built on react-native-svg + reanimated.
 * Segments are drawn as stroke-dasharray arcs with gaps between them.
 */
export function DonutChart({
  segments,
  size = 170,
  strokeWidth = 22,
}: Props) {
  const { colors } = useTheme();

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
            stroke={colors.borderLight}
            strokeWidth={strokeWidth}
            fill="none"
          />
        </Svg>
      </View>
    );
  }

  const activeSegments = segments.filter((s) => s.value > 0);
  const gapPx = activeSegments.length > 1 ? SEGMENT_GAP_PX : 0;

  let cumulative = 0;
  const arcs = activeSegments.map((segment) => {
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
              gapPx={gapPx}
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
  gapPx: number;
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
  gapPx,
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
    const rawLen = circumference * ratio * progress.value;
    const dashLen = Math.max(0, rawLen - gapPx);
    const gap = circumference - dashLen;
    return {
      strokeDasharray: [dashLen, gap] as unknown as string,
      strokeDashoffset: -(circumference * offset + gapPx / 2),
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
      strokeLinecap="butt"
      animatedProps={animatedProps}
    />
  );
}
