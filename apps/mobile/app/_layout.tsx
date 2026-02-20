import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import React from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from "react-native";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAppStore } from "@/src/store/useAppStore";
import { loadSyncMeta } from "@/src/infra/local/syncMeta";
import { loadPinHash } from "@/src/infra/local/pin";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const guardState = useAppStore((s) => s.guardState);
  const status = useAppStore((s) => s.status);
  const errorMessage = useAppStore((s) => s.errorMessage);
  const bootstrap = useAppStore((s) => s.bootstrap);

  // Determine routing on mount (runs once)
  React.useEffect(() => {
    (async () => {
      const meta = await loadSyncMeta();
      if (!meta) {
        useAppStore.setState({ guardState: "needs-setup" });
        return;
      }
      const pinHash = await loadPinHash();
      if (!pinHash) {
        useAppStore.setState({ guardState: "needs-pin-setup" });
        return;
      }
      useAppStore.setState({ guardState: "needs-pin" });
    })();
  }, []);

  // Hide native splash once guard decision is made
  React.useEffect(() => {
    if (guardState !== "checking") {
      SplashScreen.hideAsync();
    }
  }, [guardState]);

  // Keep native splash visible while deciding
  if (guardState === "checking") return null;

  const isReady = guardState === "ready";
  const needsSetup = guardState === "needs-setup";
  const needsPinSetup = guardState === "needs-pin-setup";
  const needsPin = guardState === "needs-pin";

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <View style={styles.root}>
        <Stack>
          <Stack.Protected guard={isReady}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack.Protected>

          <Stack.Protected guard={needsSetup}>
            <Stack.Screen
              name="setup/index"
              options={{ headerShown: false, gestureEnabled: false, animation: "none" }}
            />
          </Stack.Protected>

          <Stack.Protected guard={needsPinSetup}>
            <Stack.Screen
              name="pin/setup"
              options={{ headerShown: false, gestureEnabled: false, animation: "none" }}
            />
          </Stack.Protected>

          <Stack.Protected guard={needsPin}>
            <Stack.Screen
              name="pin/unlock"
              options={{ headerShown: false, gestureEnabled: false, animation: "none" }}
            />
          </Stack.Protected>

          <Stack.Screen
            name="add-transaction"
            options={{ presentation: "modal", title: "Add Transaction" }}
          />
          <Stack.Screen
            name="create-envelope"
            options={{ presentation: "modal", title: "Create Envelope" }}
          />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>

        {isReady && (status === "loading" || status === "idle") && (
          <View style={[StyleSheet.absoluteFillObject, styles.overlay]}>
            <ActivityIndicator size="large" color="#4f8ef7" />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        )}

        {isReady && status === "error" && (
          <View style={[StyleSheet.absoluteFillObject, styles.overlay]}>
            <Text style={styles.errorText}>
              {errorMessage ?? "Something went wrong"}
            </Text>
            <Pressable onPress={bootstrap} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}
      </View>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 15, color: "#555" },
  errorText: {
    fontSize: 15,
    color: "#d94f4f",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#4f8ef7",
  },
  retryText: { fontSize: 15, fontWeight: "600", color: "#4f8ef7" },
});
