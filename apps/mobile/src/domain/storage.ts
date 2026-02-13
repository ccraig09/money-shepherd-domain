import AsyncStorage from "@react-native-async-storage/async-storage";
import { Money } from "@money-shepherd/domain";
import type { AppStateV1 } from "./appState";

const KEY = "moneyShepherd.appState.v1";

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

export async function loadAppState(): Promise<AppStateV1 | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return hydrateState(parsed);
  } catch {
    return null;
  }
}

export async function saveAppState(state: AppStateV1): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

export async function clearAppState(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
