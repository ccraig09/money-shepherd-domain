import { Money } from "@money-shepherd/domain";
import { nowIso, makeId } from "../lib/id";
import type { AppStateV1 } from "./appState";

/**
 * Adds an envelope to the budget.
 * Normalizes the name (trim + collapse internal spaces) and enforces:
 *   - name must be non-blank after normalization
 *   - name must be unique (case-insensitive) among existing envelopes
 */
export function createEnvelope(
  state: AppStateV1,
  args: { name: string },
): AppStateV1 {
  const normalizedName = args.name.trim().replace(/\s+/g, " ");

  if (!normalizedName) {
    throw new Error("Envelope name is required.");
  }

  const duplicate = state.budget.envelopes.find(
    (e) => e.name.toLowerCase() === normalizedName.toLowerCase(),
  );
  if (duplicate) {
    throw new Error(`An envelope named "${duplicate.name}" already exists.`);
  }

  const envelope = {
    id: makeId("env"),
    name: normalizedName,
    balance: Money.zero(),
  };

  return {
    ...state,
    budget: {
      ...state.budget,
      envelopes: [envelope, ...state.budget.envelopes],
    },
    updatedAt: nowIso(),
  };
}

/**
 * Records that a transaction is assigned to an envelope by a user.
 * This does NOT change money directly. The domain recompute will apply it.
 */
export function assignTransaction(
  state: AppStateV1,
  args: {
    transactionId: string;
    envelopeId: string;
    assignedByUserId: string;
  },
): AppStateV1 {
  const assignment = {
    transactionId: args.transactionId,
    envelopeId: args.envelopeId,
    assignedByUserId: args.assignedByUserId,
    assignedAt: nowIso(),
  };

  const nextAssignments = {
    ...state.inbox.assignmentsByTransactionId,
    [args.transactionId]: assignment,
  };

  return {
    ...state,
    inbox: {
      ...state.inbox,
      assignmentsByTransactionId: nextAssignments,
    },
    updatedAt: nowIso(),
  };
}
