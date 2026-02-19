import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
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

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();

  const status = useAppStore((s) => s.status);
  const errorMessage = useAppStore((s) => s.errorMessage);
  const bootstrap = useAppStore((s) => s.bootstrap);

  const isOnTabs = segments[0] === "(tabs)";

  React.useEffect(() => {
    if (!isOnTabs || status !== "idle") return;
    (async () => {
      const meta = await loadSyncMeta();
      if (!meta) {
        router.replace("/setup");
        return;
      }
      bootstrap();
    })();
  }, [isOnTabs, status, router, bootstrap]);

  const showLoading = isOnTabs && (status === "idle" || status === "loading");
  const showError = isOnTabs && status === "error";

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <View style={styles.root}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="setup/index" options={{ headerShown: false }} />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>

        {showLoading && (
          <View style={[StyleSheet.absoluteFillObject, styles.overlay]}>
            <ActivityIndicator size="large" color="#4f8ef7" />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        )}

        {showError && (
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
