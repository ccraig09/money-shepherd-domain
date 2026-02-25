import { Money } from "@money-shepherd/domain";
import type { AppStateV1 } from "./appState";
import { APP_STATE_VERSION } from "./appState";
import { runMigrations } from "./migrations";

export type ImportResult =
  | { ok: true; state: AppStateV1 }
  | { ok: false; error: string };

function hydrateMoney(value: any): Money {
  if (value instanceof Money) return value;
  if (typeof value === "number") return Money.fromCents(value);
  if (value && typeof value.cents === "number") return Money.fromCents(value.cents);
  if (value && typeof value._cents === "number") return Money.fromCents(value._cents);
  return Money.zero();
}

function hydrateState(raw: any): AppStateV1 {
  const accounts = (raw.accounts ?? []).map((a: any) => ({
    ...a,
    balance: hydrateMoney(a.balance),
  }));

  const transactions = (raw.transactions ?? []).map((t: any) => ({
    ...t,
    amount: hydrateMoney(t.amount),
  }));

  const budget = {
    ...raw.budget,
    availableToAssign: hydrateMoney(raw.budget?.availableToAssign),
    envelopes: (raw.budget?.envelopes ?? []).map((e: any) => ({
      ...e,
      balance: hydrateMoney(e.balance),
      goal: e.goal ? hydrateMoney(e.goal) : e.goal,
    })),
  };

  return { ...raw, accounts, transactions, budget } as AppStateV1;
}

export function validateImport(json: string): ImportResult {
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "Invalid JSON. Please paste a valid export." };
  }

  if (typeof parsed.stateVersion !== "number") {
    return { ok: false, error: "Missing or invalid state version." };
  }

  if (parsed.stateVersion > APP_STATE_VERSION) {
    return { ok: false, error: `Unsupported version ${parsed.stateVersion}. This app supports version ${APP_STATE_VERSION}.` };
  }

  if (!parsed.householdId || typeof parsed.householdId !== "string") {
    return { ok: false, error: "Missing household ID in export." };
  }

  if (!parsed.data || typeof parsed.data !== "object") {
    return { ok: false, error: "Missing data payload in export." };
  }

  try {
    const migrated = runMigrations(parsed.data);
    const state = hydrateState(migrated);
    return { ok: true, state };
  } catch {
    return { ok: false, error: "Failed to process export data. The file may be corrupted." };
  }
}
