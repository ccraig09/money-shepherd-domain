import {
  doc,
  deleteDoc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { Money } from "@money-shepherd/domain";
import type { AppStateV1 } from "../../domain/appState";
import { getFirebase, ensureAnonAuth } from "../firebase/firebaseClient";

export type RemoteSnapshot = {
  rev: number;
  state: AppStateV1;
};

export type PushArgs = {
  expectedRev: number;
  nextState: AppStateV1;
  updatedBy: string; // user-los | user-jackia
};

// ─── Serialization helpers ──────────────────────────────────
// Firestore rejects custom class instances (e.g. Money).
// We convert Money → number (cents) before writing and
// number → Money after reading.

/**
 * Convert AppStateV1 (with Money instances) to a plain JS object
 * that Firestore can persist.
 */
function serializeState(state: AppStateV1): any {
  const plain = {
    ...state,
    accounts: state.accounts.map((a) => ({
      ...a,
      balance: a.balance.cents,
    })),
    transactions: state.transactions.map((t) => ({
      ...t,
      amount: t.amount.cents,
    })),
    budget: {
      ...state.budget,
      availableToAssign: state.budget.availableToAssign.cents,
      envelopes: state.budget.envelopes.map((e) => ({
        ...e,
        balance: e.balance.cents,
        ...(e.goal ? { goal: e.goal.cents } : {}),
      })),
    },
  };

  // JSON round-trip strips `undefined` values (e.g. Transaction.envelopeId?)
  // which Firestore also rejects.
  return JSON.parse(JSON.stringify(plain));
}

/**
 * Rehydrate a plain Firestore document back into AppStateV1
 * with proper Money instances.
 */
function hydrateMoney(value: any): Money {
  if (value instanceof Money) return value;
  if (typeof value === "number") return Money.fromCents(value);
  if (value && typeof value.cents === "number")
    return Money.fromCents(value.cents);
  if (value && typeof value._cents === "number")
    return Money.fromCents(value._cents);
  return Money.zero();
}

function deserializeState(raw: any): AppStateV1 {
  return {
    ...raw,
    accounts: (raw.accounts ?? []).map((a: any) => ({
      ...a,
      balance: hydrateMoney(a.balance),
    })),
    transactions: (raw.transactions ?? []).map((t: any) => ({
      ...t,
      amount: hydrateMoney(t.amount),
    })),
    budget: {
      ...raw.budget,
      availableToAssign: hydrateMoney(raw.budget?.availableToAssign),
      envelopes: (raw.budget?.envelopes ?? []).map((e: any) => ({
        ...e,
        balance: hydrateMoney(e.balance),
        ...(e.goal !== undefined ? { goal: hydrateMoney(e.goal) } : {}),
      })),
    },
  } as AppStateV1;
}

// ─── Repository ─────────────────────────────────────────────

export class HouseholdStateRepo {
  constructor(private householdId: string) {}

  private ref() {
    const { db } = getFirebase();
    return doc(db, "households", this.householdId);
  }

  async pull(): Promise<RemoteSnapshot | null> {
    await ensureAnonAuth();

    const snap = await getDoc(this.ref());
    if (!snap.exists()) return null;

    const data = snap.data() as any;

    // Basic shape guard (avoid crashing on bad data)
    if (typeof data.rev !== "number" || !data.state) return null;

    return {
      rev: data.rev,
      state: deserializeState(data.state),
    };
  }

  async clear(): Promise<void> {
    await ensureAnonAuth();
    await deleteDoc(this.ref());
  }

  async push(args: PushArgs): Promise<{ rev: number }> {
    await ensureAnonAuth();

    const ref = this.ref();

    try {
      const { rev } = await runTransaction(getFirebase().db, async (tx) => {
        const snap = await tx.get(ref);

        // If doc doesn't exist yet, allow create only when expectedRev === 0
        if (!snap.exists()) {
          if (args.expectedRev !== 0) {
            const err: any = new Error("SYNC_CONFLICT");
            err.code = "SYNC_CONFLICT";
            throw err;
          }

          const nextRev = 1;
          tx.set(ref, {
            rev: nextRev,
            state: serializeState(args.nextState),
            updatedBy: args.updatedBy,
            updatedAt: new Date().toISOString(),
            // optional for server ordering
            serverUpdatedAt: serverTimestamp(),
          });

          return { rev: nextRev };
        }

        const current = snap.data() as any;
        const currentRev = typeof current.rev === "number" ? current.rev : 0;

        if (currentRev !== args.expectedRev) {
          const err: any = new Error("SYNC_CONFLICT");
          err.code = "SYNC_CONFLICT";
          throw err;
        }

        const nextRev = currentRev + 1;
        tx.update(ref, {
          rev: nextRev,
          state: serializeState(args.nextState),
          updatedBy: args.updatedBy,
          updatedAt: new Date().toISOString(),
          serverUpdatedAt: serverTimestamp(),
        });

        return { rev: nextRev };
      });

      return { rev };
    } catch (e: any) {
      // normalize
      if (e?.code === "SYNC_CONFLICT") throw e;
      throw e;
    }
  }
}
