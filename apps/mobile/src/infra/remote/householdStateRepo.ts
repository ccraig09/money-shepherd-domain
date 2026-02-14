import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import type { AppStateV1 } from "../../domain/appState";
import { getFirebase } from "../firebase/firebaseClient";

export type RemoteStateEnvelope = {
  householdId: string;
  rev: number;
  updatedAt: string; // ISO
  updatedBy: string; // user id
  state: AppStateV1;
};

export class HouseholdStateRepo {
  constructor(private householdId: string) {}

  private ref() {
    const { db } = getFirebase();
    return doc(db, "households", this.householdId);
  }

  async pull(): Promise<RemoteStateEnvelope | null> {
    const snap = await getDoc(this.ref());
    if (!snap.exists()) return null;

    const data = snap.data() as any;

    return {
      householdId: this.householdId,
      rev: data.rev ?? 0,
      updatedAt: data.updatedAt ?? "",
      updatedBy: data.updatedBy ?? "",
      state: data.state as AppStateV1,
    };
  }

  /**
   * Push with optimistic concurrency:
   * - expectedRev must match remote rev
   * - then we write rev+1
   */
  async push(args: {
    expectedRev: number;
    nextState: AppStateV1;
    updatedBy: string;
  }): Promise<RemoteStateEnvelope> {
    const ref = this.ref();

    const { householdId } = this;

    return await runTransaction(ref.firestore, async (tx) => {
      const snap = await tx.get(ref);
      const currentRev = snap.exists() ? ((snap.data() as any).rev ?? 0) : 0;

      if (currentRev !== args.expectedRev) {
        const err = new Error(
          `Sync conflict: expected rev ${args.expectedRev}, got ${currentRev}`,
        );
        (err as any).code = "SYNC_CONFLICT";
        throw err;
      }

      const nextRev = currentRev + 1;
      const updatedAt = new Date().toISOString();

      tx.set(
        ref,
        {
          rev: nextRev,
          updatedAt,
          updatedBy: args.updatedBy,
          state: args.nextState,
          serverUpdatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      return {
        householdId,
        rev: nextRev,
        updatedAt,
        updatedBy: args.updatedBy,
        state: args.nextState,
      };
    });
  }
}
