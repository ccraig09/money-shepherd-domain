import AsyncStorage from "@react-native-async-storage/async-storage";
import { Money } from "@money-shepherd/domain";
import type { AppStateV1 } from "./appState";
import { runMigrations } from "./migrations";

const KEY = "moneyShepherd.appState.v1";
const KEY_TMP = "moneyShepherd.appState.v1.tmp";
const KEY_BACKUP = "moneyShepherd.appState.v1.backup";

function hydrateMoney(value: any): Money {
  // supports:
  // - number cents (recommended)
  // - { cents: number }
  // - { _cents: number }
  if (value instanceof Money) return value;

  if (typeof value === "number") return Money.fromCents(value);
  if (value && typeof value.cents === "number")
    return Money.fromCents(value.cents);
  if (value && typeof value._cents === "number")
    return Money.fromCents(value._cents);

  return Money.zero();
}

function hydrateState(raw: any): AppStateV1 {
  // accounts
  const accounts = (raw.accounts ?? []).map((a: any) => ({
    ...a,
    balance: hydrateMoney(a.balance),
  }));

  // transactions
  const transactions = (raw.transactions ?? []).map((t: any) => ({
    ...t,
    amount: hydrateMoney(t.amount),
  }));

  // budget
  const budget = {
    ...raw.budget,
    availableToAssign: hydrateMoney(raw.budget?.availableToAssign),
    envelopes: (raw.budget?.envelopes ?? []).map((e: any) => ({
      ...e,
      balance: hydrateMoney(e.balance),
      goal: e.goal ? hydrateMoney(e.goal) : e.goal, // if you ever add goal later
    })),
  };

  return {
    ...raw,
    accounts,
    transactions,
    budget,
  } as AppStateV1;
}

/** Try to parse, migrate, and hydrate a raw JSON string. Returns null on any failure. */
function tryParse(raw: string | null): AppStateV1 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const migrated = runMigrations(parsed);
    return hydrateState(migrated);
  } catch {
    return null;
  }
}

/**
 * Load app state with fallback chain: main → tmp → backup.
 * Recovers from interrupted writes or corrupted JSON.
 */
export async function loadAppState(): Promise<AppStateV1 | null> {
  // 1. Try main key
  const main = tryParse(await AsyncStorage.getItem(KEY));
  if (main) return main;

  // 2. Try in-flight tmp (crash during save before commit)
  const tmp = tryParse(await AsyncStorage.getItem(KEY_TMP));
  if (tmp) {
    console.warn("[storage] Main key corrupt/missing — recovered from tmp");
    await AsyncStorage.setItem(KEY, await AsyncStorage.getItem(KEY_TMP) as string);
    return tmp;
  }

  // 3. Try backup (last known good before most recent save)
  const backup = tryParse(await AsyncStorage.getItem(KEY_BACKUP));
  if (backup) {
    console.warn("[storage] Main + tmp corrupt/missing — recovered from backup");
    await AsyncStorage.setItem(KEY, await AsyncStorage.getItem(KEY_BACKUP) as string);
    return backup;
  }

  console.warn("[storage] All keys empty or corrupt — returning null");
  return null;
}

/**
 * Atomic save: stage → backup → commit → cleanup.
 * If the app crashes at any point, loadAppState can recover.
 */
export async function saveAppState(state: AppStateV1): Promise<void> {
  const json = JSON.stringify(state);

  // 1. Stage: write to tmp key
  await AsyncStorage.setItem(KEY_TMP, json);

  // 2. Backup: preserve current main as backup (if it exists and is valid)
  const currentMain = await AsyncStorage.getItem(KEY);
  if (currentMain && tryParse(currentMain)) {
    await AsyncStorage.setItem(KEY_BACKUP, currentMain);
  }

  // 3. Commit: write to main key
  await AsyncStorage.setItem(KEY, json);

  // 4. Cleanup: remove tmp
  await AsyncStorage.removeItem(KEY_TMP);
}

export async function clearAppState(): Promise<void> {
  await AsyncStorage.multiRemove([KEY, KEY_TMP, KEY_BACKUP]);
}
