import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebase, ensureAnonAuth } from "../firebase/firebaseClient";

export type PlaidConnectionDoc = {
  itemId: string;
  userId: string;
  institutionName: string;
  accountIds: string[];
  connectedAt: string;
  active: boolean;
};

/**
 * Write (upsert) a Plaid connection record to Firestore.
 * Called after a successful Plaid Link flow.
 * No secrets — only metadata for cross-device visibility.
 */
export async function writeConnection(
  householdId: string,
  args: {
    itemId: string;
    userId: string;
    institutionName: string;
    accountIds: string[];
  },
): Promise<void> {
  await ensureAnonAuth();
  const { db } = getFirebase();
  const ref = doc(db, "households", householdId, "plaidConnections", args.itemId);
  await setDoc(ref, {
    itemId: args.itemId,
    userId: args.userId,
    institutionName: args.institutionName,
    accountIds: args.accountIds,
    connectedAt: new Date().toISOString(),
    active: true,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Read all active Plaid connections for a household.
 * Returns connections from ALL users (for cross-device visibility).
 */
export async function readConnections(
  householdId: string,
): Promise<PlaidConnectionDoc[]> {
  await ensureAnonAuth();
  const { db } = getFirebase();
  const colRef = collection(db, "households", householdId, "plaidConnections");
  const snapshot = await getDocs(colRef);
  const connections: PlaidConnectionDoc[] = [];
  snapshot.forEach((d) => {
    const data = d.data();
    if (data.active) {
      connections.push({
        itemId: data.itemId,
        userId: data.userId,
        institutionName: data.institutionName,
        accountIds: data.accountIds ?? [],
        connectedAt: data.connectedAt,
        active: true,
      });
    }
  });
  return connections;
}

/**
 * Mark a connection as inactive in Firestore.
 * Called when a bank is disconnected locally.
 */
export async function deactivateConnection(
  householdId: string,
  itemId: string,
): Promise<void> {
  await ensureAnonAuth();
  const { db } = getFirebase();
  const ref = doc(db, "households", householdId, "plaidConnections", itemId);
  await updateDoc(ref, {
    active: false,
    updatedAt: serverTimestamp(),
  });
}
