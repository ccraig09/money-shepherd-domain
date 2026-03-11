import AsyncStorage from "@react-native-async-storage/async-storage";

const VOICE_KEY = "ms_tts_voice_id_v1";

export async function loadVoiceId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(VOICE_KEY);
  } catch {
    return null;
  }
}

export async function saveVoiceId(voiceId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(VOICE_KEY, voiceId);
  } catch {
    // Storage write failed — silently ignore
  }
}

export async function clearVoiceId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(VOICE_KEY);
  } catch {
    // Ignore
  }
}
