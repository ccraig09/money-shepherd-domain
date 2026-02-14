import React from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { saveSyncMeta } from "../../src/infra/local/syncMeta";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

const HOUSEHOLD_ID = "household-los-jackia";
const PIN_KEY_PREFIX = "ms_pin_hash_v1:";

// super-light “hash”: not security-grade, but avoids plain text.
// we’ll upgrade later if you want.
function simpleHash(pin: string) {
  let h = 0;
  for (let i = 0; i < pin.length; i++) h = (h * 31 + pin.charCodeAt(i)) >>> 0;
  return String(h);
}

type UserChoice = "user-los" | "user-jackia";

export default function SetupScreen() {
  const router = useRouter();

  const [userId, setUserId] = React.useState<UserChoice>("user-los");
  const [pin, setPin] = React.useState("");

  async function onSave() {
    const trimmed = pin.trim();

    if (!/^\d{4}$/.test(trimmed)) {
      Alert.alert("PIN must be 4 digits", "Example: 1234");
      return;
    }

    const pinHash = simpleHash(trimmed);

    // store per-user pin hash locally (device only)
    await AsyncStorage.setItem(PIN_KEY_PREFIX + userId, pinHash);

    // sync meta (device identity + expected rev)
    await saveSyncMeta({
      householdId: HOUSEHOLD_ID,
      rev: 0,
      userId,
    });

    setPin("");
    router.replace("/"); // go to tabs root
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 14, justifyContent: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Money Shepherd</Text>
      <Text style={{ opacity: 0.7 }}>
        Setup this device for Los or Jackia. This is just a convenience PIN.
      </Text>

      <View style={{ gap: 10 }}>
        <Text style={{ fontWeight: "600" }}>Who is using this device?</Text>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => setUserId("user-los")}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              alignItems: "center",
              opacity: userId === "user-los" ? 1 : 0.6,
            }}
          >
            <Text>Los</Text>
          </Pressable>

          <Pressable
            onPress={() => setUserId("user-jackia")}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              alignItems: "center",
              opacity: userId === "user-jackia" ? 1 : 0.6,
            }}
          >
            <Text>Jackia</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ fontWeight: "600" }}>4-digit PIN</Text>
        <TextInput
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          maxLength={4}
          placeholder="1234"
          style={{
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
            fontSize: 18,
            letterSpacing: 6,
          }}
          secureTextEntry
        />
      </View>

      <Pressable
        onPress={onSave}
        style={{
          padding: 14,
          borderRadius: 12,
          borderWidth: 1,
          alignItems: "center",
          marginTop: 10,
        }}
      >
        <Text style={{ fontWeight: "600" }}>Save and continue</Text>
      </Pressable>

      <Text style={{ opacity: 0.6, fontSize: 12 }}>
        Household: {HOUSEHOLD_ID}
      </Text>
    </View>
  );
}
