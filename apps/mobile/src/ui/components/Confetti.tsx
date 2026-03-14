import React, { useCallback, useImperativeHandle, useRef, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ── Warm gold palette — no greens ─────────────────────────────────────────
const COLORS = [
  "#d4a017", // gold
  "#b8860b", // dark gold
  "#e8b830", // amber
  "#f0c060", // light gold
  "#c8922a", // warm brown
  "#fffacd", // cream
];

const DEFAULT_DURATION = 1400;
const DEFAULT_INTENSITY: Record<CelebrationMode, number> = {
  burst: 24,
  shower: 36,
  sparkle: 20,
};

export type CelebrationMode = "burst" | "shower" | "sparkle";

export type FireOptions = {
  mode?: CelebrationMode;
  duration?: number;
  intensity?: number;
};

export type ConfettiRef = {
  /** Fire a celebration animation. Defaults to burst mode. */
  fire: (options?: FireOptions) => void;
};

// ── Particle shape ─────────────────────────────────────────────────────────
type Particle = {
  id: number;
  x: number;
  y: number;
  color: string;
  angle: number;
  speed: number;
  size: number;
  delay: number;
  mode: CelebrationMode;
};

function makeParticles(
  mode: CelebrationMode,
  count: number,
): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    if (mode === "shower") {
      return {
        id: i,
        x: Math.random() * SCREEN_W,
        y: -10,
        color,
        angle: Math.PI / 2 + (Math.random() - 0.5) * 0.4, // mostly downward
        speed: 250 + Math.random() * 200,
        size: 5 + Math.random() * 5,
        delay: Math.random() * 600,
        mode,
      };
    }

    if (mode === "sparkle") {
      return {
        id: i,
        x: SCREEN_W * 0.1 + Math.random() * SCREEN_W * 0.8,
        y: SCREEN_H * 0.2 + Math.random() * SCREEN_H * 0.5,
        color,
        angle: -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.4,
        speed: 20 + Math.random() * 40,
        size: 3 + Math.random() * 3,
        delay: Math.random() * 400,
        mode,
      };
    }

    // burst (default) — shoot upward from horizontal center
    return {
      id: i,
      x: SCREEN_W * 0.3 + Math.random() * SCREEN_W * 0.4,
      y: SCREEN_H * 0.25,
      color,
      angle: -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8,
      speed: 120 + Math.random() * 200,
      size: 4 + Math.random() * 6,
      delay: Math.random() * 150,
      mode,
    };
  });
}

// ── Single particle animator ────────────────────────────────────────────────
function ConfettiParticle({ p, duration }: { p: Particle; duration: number }) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withDelay(
      p.delay,
      withTiming(1, { duration, easing: Easing.out(Easing.quad) }),
    );
  }, [progress, p.delay, duration]);

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const dx = Math.cos(p.angle) * p.speed * t;
    const gravity = p.mode === "sparkle" ? 0 : 400;
    const dy = Math.sin(p.angle) * p.speed * t + gravity * t * t;
    const rotation = p.mode === "sparkle" ? t * 180 : t * 720;
    const fadeStart = p.mode === "sparkle" ? 0.4 : 0.7;
    const opacity =
      t < fadeStart ? 1 : 1 - (t - fadeStart) / (1 - fadeStart);

    return {
      transform: [
        { translateX: dx },
        { translateY: dy },
        { rotate: `${rotation}deg` },
        { scale: p.mode === "sparkle" ? 1 - t * 0.3 : 1 - t * 0.5 },
      ],
      opacity,
    };
  });

  return (
    <ReAnimated.View
      style={[
        styles.particle,
        {
          left: p.x,
          top: p.y,
          width: p.size,
          height: p.size,
          borderRadius: p.size / 2,
          backgroundColor: p.color,
        },
        style,
      ]}
    />
  );
}

// ── Public component ────────────────────────────────────────────────────────
export const Confetti = React.forwardRef<ConfettiRef>(
  function Confetti(_props, ref) {
    const [state, setState] = useState<{
      particles: Particle[];
      duration: number;
    } | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clear = useCallback(() => setState(null), []);

    useImperativeHandle(ref, () => ({
      fire(options?: FireOptions) {
        const mode = options?.mode ?? "burst";
        const duration = options?.duration ?? DEFAULT_DURATION;
        const count = options?.intensity ?? DEFAULT_INTENSITY[mode];

        if (timerRef.current) clearTimeout(timerRef.current);
        setState({ particles: makeParticles(mode, count), duration });
        timerRef.current = setTimeout(
          () => runOnJS(clear)(),
          duration + 600,
        );
      },
    }), [clear]);

    if (!state) return null;

    return (
      <View style={styles.overlay} pointerEvents="none">
        {state.particles.map((p) => (
          <ConfettiParticle key={p.id} p={p} duration={state.duration} />
        ))}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
  },
  particle: {
    position: "absolute",
  },
});
