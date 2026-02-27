import React, { Component } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Color, FontSize, FontWeight, Spacing } from "../../tokens";

type Props = {
  children: React.ReactNode;
  /** One-line fallback message when the chart can't render */
  fallbackMessage?: string;
};

type State = { hasError: boolean };

/**
 * Lightweight error boundary for chart components.
 *
 * Catches the "Unimplemented component: <RNSVGSvgView>" crash that occurs
 * when react-native-svg native modules are unavailable (e.g. Expo Go).
 */
export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.icon}>📊</Text>
          <Text style={styles.text}>
            {this.props.fallbackMessage ?? "Chart unavailable"}
          </Text>
          <Text style={styles.hint}>Requires a development build</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  icon: { fontSize: 28 },
  text: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: Color.textMuted,
    textAlign: "center",
  },
  hint: {
    fontSize: FontSize.caption,
    color: Color.textSubtle,
    textAlign: "center",
  },
});
