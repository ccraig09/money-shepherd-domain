import React, { useState } from "react";
import { Pressable, Text, View, Modal, StyleSheet } from "react-native";
import { Spacing, Radius, FontSize, FontWeight, Color } from "../tokens";

type Props = {
  title: string;
  body: string;
  /** Renders on a dark background (e.g. hero card). Defaults to false. */
  inverted?: boolean;
};

export function HelpTooltip({ title, body, inverted }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        hitSlop={8}
        accessibilityLabel={`Help: ${title}`}
        accessibilityRole="button"
      >
        <View style={[styles.icon, inverted && styles.iconInverted]}>
          <Text style={[styles.iconText, inverted && styles.iconTextInverted]}>?</Text>
        </View>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
            <Pressable onPress={() => setVisible(false)} style={styles.dismiss}>
              <Text style={styles.dismissText}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Color.textSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  iconInverted: {
    borderColor: "rgba(255,255,255,0.5)",
  },
  iconText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: Color.textSubtle,
    lineHeight: 14,
  },
  iconTextInverted: {
    color: "rgba(255,255,255,0.6)",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: Color.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.xl,
    maxWidth: 320,
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: Color.textDark,
  },
  body: {
    fontSize: FontSize.body,
    color: Color.textMid,
    lineHeight: 22,
  },
  dismiss: {
    marginTop: Spacing.sm,
    alignSelf: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  dismissText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Color.primary,
  },
});
