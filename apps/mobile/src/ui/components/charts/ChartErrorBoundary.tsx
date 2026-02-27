import React, { Component } from "react";
import { View, Text, StyleSheet } from "react-native";
import { FontSize, FontWeight, Spacing } from "../../tokens";
import type { ColorTokens } from "../../tokens";

type Props = {
  children: React.ReactNode;
  /** One-line fallback message when the chart can't render */
  fallbackMessage?: string;
  /** Theme colors — passed from a parent functional component */
  colors: ColorTokens;
};

type State = { hasError: boolean };

/**
 * Lightweight error boundary for chart components.
 *
 * Catches the "Unimplemented component: <RNSVGSvgView>" crash that occurs
 * when react-native-svg native modules are unavailable (e.g. Expo Go).
 *
 * Class components cannot use hooks, so theme colors are passed as a prop.
 */
export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      const { colors } = this.props;
      return (
        <View style={styles.fallback}>
          <Text style={styles.icon}>📊</Text>
          <Text style={[styles.text, { color: colors.textMuted }]}>
            {this.props.fallbackMessage ?? "Chart unavailable"}
          </Text>
          <Text style={[styles.hint, { color: colors.textSubtle }]}>
            Requires a development build
          </Text>
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
    textAlign: "center",
  },
  hint: {
    fontSize: FontSize.caption,
    textAlign: "center",
  },
});
