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

const PARTICLE_COUNT = 24;
const DURATION = 1400;
const COLORS = ["#d4a017", "#38a55c", "#b8860b", "#e8b830", "#4caf6a", "#f0b840"];

type Particle = {
  id: number;
  x: number;
  color: string;
  angle: number; // radians — spread direction
  speed: number; // px travel distance
  size: number;
  delay: number;
};

function makeParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: SCREEN_W * 0.3 + Math.random() * SCREEN_W * 0.4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    angle: -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8,
    speed: 120 + Math.random() * 200,
    size: 4 + Math.random() * 6,
    delay: Math.random() * 150,
  }));
}

export type ConfettiRef = {
  fire: () => void;
};

function ConfettiParticle({ p }: { p: Particle }) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withDelay(
      p.delay,
      withTiming(1, { duration: DURATION, easing: Easing.out(Easing.quad) }),
    );
  }, [progress, p.delay]);

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const dx = Math.cos(p.angle) * p.speed * t;
    const dy = Math.sin(p.angle) * p.speed * t + 400 * t * t; // gravity
    return {
      transform: [
        { translateX: dx },
        { translateY: dy },
        { rotate: `${t * 360 * 2}deg` },
        { scale: 1 - t * 0.5 },
      ],
      opacity: t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3,
    };
  });

  return (
    <ReAnimated.View
      style={[
        styles.particle,
        {
          left: p.x,
          top: SCREEN_H * 0.25,
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

export const Confetti = React.forwardRef<ConfettiRef>(function Confetti(_props, ref) {
  const [particles, setParticles] = useState<Particle[] | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => setParticles(null), []);

  useImperativeHandle(ref, () => ({
    fire() {
      if (timerRef.current) clearTimeout(timerRef.current);
      setParticles(makeParticles());
      timerRef.current = setTimeout(() => runOnJS(clear)(), DURATION + 200);
    },
  }), [clear]);

  if (!particles) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {particles.map((p) => (
        <ConfettiParticle key={p.id} p={p} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
  },
  particle: {
    position: "absolute",
  },
});
