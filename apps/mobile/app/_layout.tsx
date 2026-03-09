import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import React from "react";
import {
  AppState,
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from "react-native";

import { useAppStore } from "@/src/store/useAppStore";
import { loadSyncMeta } from "@/src/infra/local/syncMeta";
import { loadPinHash } from "@/src/infra/local/pin";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "@/src/ui/tokens";
import { ThemeProvider, useTheme, useThemedStyles } from "@/src/ui/ThemeProvider";
import { Toast } from "@/src/ui/components/Toast";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}

function RootLayoutInner() {
  const { isDark, colors } = useTheme();
  const styles = useThemedStyles(createStyles);

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

  // Auto-sync when app returns to foreground
  React.useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && useAppStore.getState().guardState === "ready") {
        useAppStore.getState().refreshFromPlaid({ silent: true });
        useAppStore.getState().syncNow();
      }
    });
    return () => sub.remove();
  }, []);

  // Keep native splash visible while deciding
  if (guardState === "checking") return null;

  const isReady = guardState === "ready";
  const needsSetup = guardState === "needs-setup";
  const needsPinSetup = guardState === "needs-pin-setup";
  const needsPin = guardState === "needs-pin";

  return (
    <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <View style={styles.root}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.primary,
            headerTitleStyle: { color: colors.textDark },
            contentStyle: { backgroundColor: colors.surface },
          }}
        >
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
            name="assign-transaction"
            options={{ presentation: "modal", title: "Assign to Envelope" }}
          />
          <Stack.Screen
            name="allocate"
            options={{ presentation: "modal", title: "Allocate Funds" }}
          />
          <Stack.Screen
            name="edit-envelope"
            options={{ presentation: "modal", title: "Edit Envelope" }}
          />
          <Stack.Screen
            name="envelope/[envelopeId]"
            options={{ headerBackTitle: "Envelopes" }}
          />
          <Stack.Screen
            name="transaction/[transactionId]"
            options={{ headerBackTitle: "Back" }}
          />
          <Stack.Screen
            name="period-summary"
            options={{ headerBackTitle: "Dashboard" }}
          />
          <Stack.Screen
            name="debt-overview"
            options={{ title: "Debt Freedom", headerBackTitle: "Home" }}
          />
          <Stack.Screen
            name="fill-envelopes"
            options={{ presentation: "modal", title: "Fill Envelopes" }}
          />
          <Stack.Screen
            name="seed-budget"
            options={{ presentation: "modal", title: "Seed Budget" }}
          />
          <Stack.Screen
            name="settings/connect-accounts"
            options={{ title: "Connect Accounts", headerBackTitle: "Settings" }}
          />
          <Stack.Screen
            name="settings/assignment-rules"
            options={{ title: "Assignment Rules", headerBackTitle: "Settings" }}
          />
          <Stack.Screen
            name="ai-setup-wizard"
            options={{ title: "AI Budget Setup", headerBackTitle: "Settings" }}
          />
        </Stack>

        {isReady && (status === "loading" || status === "idle") && (
          <View style={[StyleSheet.absoluteFillObject, styles.overlay]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Syncing household budget…</Text>
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

        <Toast />
      </View>
      <StatusBar style={isDark ? "light" : "dark"} />
    </NavThemeProvider>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  loadingText: { fontSize: FontSize.body, color: c.textMid },
  errorText: {
    fontSize: FontSize.body,
    color: c.error,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  retryBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: c.primary,
  },
  retryText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: c.primary },
});
