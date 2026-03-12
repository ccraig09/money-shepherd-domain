import React from "react";
import { Image, StyleSheet } from "react-native";

const appIcon = require("../../../assets/images/icon.png");

type Props = {
  /** Outer circle diameter in logical points */
  size: number;
};

/**
 * Branded avatar for the Money Shepherd AI assistant.
 * Uses the actual app icon (gold "S" logo) clipped to a circle.
 */
export function ShepherdAvatar({ size }: Props) {
  return (
    <Image
      source={appIcon}
      style={[
        styles.image,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
      accessibilityLabel="Money Shepherd"
    />
  );
}

const styles = StyleSheet.create({
  image: {
    resizeMode: "cover",
  },
});
