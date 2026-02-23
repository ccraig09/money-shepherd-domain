import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Spacing, FontSize, FontWeight, Color } from "../tokens";
import { getGreeting, getDisplayName } from "../../lib/greeting";
import { loadSyncMeta } from "../../infra/local/syncMeta";

type EnvelopeHealth = {
  total: number;
  onTrack: number;
  needsAttention: number;
};

function useEnvelopeHealth(envelopes: { balance: { cents: number } }[]): EnvelopeHealth {
  return React.useMemo(() => {
    const total = envelopes.length;
    const needsAttention = envelopes.filter((e) => e.balance.cents < 0).length;
    return { total, onTrack: total - needsAttention, needsAttention };
  }, [envelopes]);
}

function healthSummary(h: EnvelopeHealth): string {
  if (h.total === 0) return "Create an envelope to start budgeting";
  if (h.needsAttention === 0) return "All envelopes on track";
  if (h.onTrack === 0) return `${h.needsAttention} ${h.needsAttention === 1 ? "envelope needs" : "envelopes need"} attention`;
  return `${h.onTrack} on track, ${h.needsAttention} ${h.needsAttention === 1 ? "needs" : "need"} attention`;
}

type Props = {
  envelopes: { balance: { cents: number } }[];
};

export function GreetingCard({ envelopes }: Props) {
  const [displayName, setDisplayName] = React.useState<string | null>(null);
  const hour = new Date().getHours();
  const health = useEnvelopeHealth(envelopes);

  React.useEffect(() => {
    loadSyncMeta().then((meta) => {
      setDisplayName(meta ? getDisplayName(meta.userId) : null);
    });
  }, []);

  const greeting = displayName
    ? `${getGreeting(hour)}, ${displayName}`
    : getGreeting(hour);

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{greeting}</Text>
      <Text style={styles.summary}>{healthSummary(health)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    gap: 2,
  },
  greeting: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.extrabold,
    color: Color.textDark,
  },
  summary: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.medium,
    color: Color.textMuted,
  },
});
