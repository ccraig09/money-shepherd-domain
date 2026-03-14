import { Tabs, router, usePathname } from "expo-router";
import { View, StyleSheet } from "react-native";
import React from "react";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { FloatingTabBar } from "@/src/ui/components/FloatingTabBar";
import { TopBar } from "@/src/ui/components/TopBar";
import { FAB } from "@/src/ui/components/FAB";
import { useTheme } from "@/src/ui/ThemeProvider";

export default function TabLayout() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const isChatOpen = pathname.startsWith("/chat");

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <TopBar
        onInboxPress={() => router.push("/inbox")}
        onProfilePress={() => router.push("/settings")}
      />

      <View style={styles.content}>
        <Tabs
          screenOptions={{ headerShown: false }}
          tabBar={(props) => <FloatingTabBar {...props} />}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Home",
              tabBarIcon: ({ color, size }) => (
                <IconSymbol name="house.fill" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="envelopes"
            options={{
              title: "Envelopes",
              tabBarIcon: ({ color, size }) => (
                <IconSymbol name="envelope.fill" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="transactions"
            options={{
              title: "Activity",
              tabBarIcon: ({ color, size }) => (
                <IconSymbol name="list.bullet" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="insights"
            options={{
              title: "Insights",
              tabBarIcon: ({ color, size }) => (
                <IconSymbol name="chart.bar.fill" size={size} color={color} />
              ),
            }}
          />

          {/* Hidden tab — accessible via TopBar profile icon, not shown in tab bar */}
          <Tabs.Screen name="settings" options={{ href: null }} />
        </Tabs>
      </View>

      {!isChatOpen && (
        <View style={styles.fabContainer}>
          <FAB onPress={() => router.push("/chat")} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  fabContainer: {
    position: "absolute",
    right: 20,
    bottom: 80,
  },
});
