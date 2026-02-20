import React from "react";
import { View, Text, StyleSheet } from "react-native";

// Placeholder — implemented in MS-14.6
export default function CreateEnvelopeScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.text}>Create Envelope — coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 16, color: "#888" },
});
