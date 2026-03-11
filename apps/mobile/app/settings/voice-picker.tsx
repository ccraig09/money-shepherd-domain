import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import * as Speech from "expo-speech";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../../src/ui/tokens";
import { useThemedStyles, useTheme } from "@/src/ui/ThemeProvider";
import { loadVoiceId, saveVoiceId, clearVoiceId } from "../../src/infra/local/voicePreference";

const PREVIEW_TEXT = "Your spending is on track this month. Great work staying within your budget.";
const SYSTEM_DEFAULT_ID = "__system_default__";

type VoiceItem = { id: string; label: string; voice?: Speech.Voice };

export default function VoicePickerScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  const [items, setItems] = React.useState<VoiceItem[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>(SYSTEM_DEFAULT_ID);
  const [previewingId, setPreviewingId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function init() {
      const [available, savedId] = await Promise.all([
        Speech.getAvailableVoicesAsync(),
        loadVoiceId(),
      ]);

      // Prefer Enhanced English voices (Siri-quality); fall back to all English if none available (simulator)
      const allEnglish = available.filter((v) => v.language?.startsWith("en"));
      const enhanced = allEnglish.filter((v) => v.quality === Speech.VoiceQuality.Enhanced);
      const voiceList = (enhanced.length > 0 ? enhanced : allEnglish)
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

      const list: VoiceItem[] = [
        { id: SYSTEM_DEFAULT_ID, label: "System Default" },
        ...voiceList.map((v) => ({ id: v.identifier, label: v.name ?? v.identifier, voice: v })),
      ];

      setItems(list);
      setSelectedId(savedId && voiceList.some((v) => v.identifier === savedId) ? savedId : SYSTEM_DEFAULT_ID);
      setLoading(false);
    }
    init();

    return () => { Speech.stop(); };
  }, []);

  async function handleSelect(item: VoiceItem) {
    Speech.stop();
    setSelectedId(item.id);
    if (item.id === SYSTEM_DEFAULT_ID) {
      await clearVoiceId();
    } else {
      await saveVoiceId(item.id);
    }
  }

  async function handlePreview(item: VoiceItem) {
    Speech.stop();
    setPreviewingId(item.id);
    const opts: Speech.SpeechOptions = {
      ...(item.voice ? { voice: item.voice.identifier } : {}),
      onDone: () => setPreviewingId(null),
      onStopped: () => setPreviewingId(null),
      onError: () => setPreviewingId(null),
    };
    Speech.speak(PREVIEW_TEXT, opts);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.list}>
      <Text style={styles.hint}>Choose the voice used when reading AI responses aloud.</Text>
      <View style={styles.card}>
        {items.map((item, idx) => {
          const selected = item.id === selectedId;
          const previewing = item.id === previewingId;
          const isLast = idx === items.length - 1;
          return (
            <View key={item.id}>
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => handleSelect(item)}
              >
                <View style={styles.rowLeft}>
                  <View style={styles.radioOuter}>
                    {selected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.voiceName, selected && styles.voiceNameSelected]}>
                    {item.label}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.previewBtn, pressed && styles.previewBtnPressed]}
                  onPress={() => handlePreview(item)}
                  hitSlop={8}
                >
                  <Text style={[styles.previewBtnText, previewing && styles.previewBtnActive]}>
                    {previewing ? "Stop" : "Play"}
                  </Text>
                </Pressable>
              </Pressable>
              {!isLast && <View style={styles.separator} />}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.surfaceLight },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    list: { padding: Spacing.lg, paddingBottom: Spacing.bottomPad, gap: Spacing.md },
    hint: { fontSize: FontSize.body, color: c.textMuted, lineHeight: 22 },
    card: {
      backgroundColor: c.surface,
      borderRadius: Radius.hero,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderLight, marginLeft: Spacing.lg + 20 + Spacing.md },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.base,
      minHeight: 52,
    },
    rowPressed: { opacity: 0.6 },
    rowLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: Spacing.md },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary },
    voiceName: { fontSize: FontSize.body, color: c.textMid, fontWeight: FontWeight.medium },
    voiceNameSelected: { color: c.textDark, fontWeight: FontWeight.semibold },
    previewBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, minHeight: 32, justifyContent: "center" },
    previewBtnPressed: { opacity: 0.5 },
    previewBtnText: { fontSize: FontSize.small, color: c.primary, fontWeight: FontWeight.semibold },
    previewBtnActive: { color: c.textMuted },
  });
