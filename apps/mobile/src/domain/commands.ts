import { Money, unassignTransaction as unassignTxDomain } from "@money-shepherd/domain";
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
 * Renames an existing envelope.
 * Normalizes the new name (trim + collapse internal spaces) and enforces:
 *   - name must be non-blank after normalization
 *   - name must be unique (case-insensitive) among other envelopes
 */
export function renameEnvelope(
  state: AppStateV1,
  args: { envelopeId: string; name: string },
): AppStateV1 {
  const normalizedName = args.name.trim().replace(/\s+/g, " ");

  if (!normalizedName) {
    throw new Error("Envelope name is required.");
  }

  const envelope = state.budget.envelopes.find(
    (e) => e.id === args.envelopeId,
  );
  if (!envelope) {
    throw new Error("Envelope not found.");
  }

  // No-op if the name didn't actually change
  if (envelope.name === normalizedName) {
    return state;
  }

  const duplicate = state.budget.envelopes.find(
    (e) =>
      e.id !== args.envelopeId &&
      e.name.toLowerCase() === normalizedName.toLowerCase(),
  );
  if (duplicate) {
    throw new Error(`An envelope named "${duplicate.name}" already exists.`);
  }

  return {
    ...state,
    budget: {
      ...state.budget,
      envelopes: state.budget.envelopes.map((e) =>
        e.id === args.envelopeId ? { ...e, name: normalizedName } : e,
      ),
    },
    updatedAt: nowIso(),
  };
}

/**
 * Deletes an envelope and removes all assignments pointing to it.
 * Transactions previously assigned to this envelope return to the Inbox.
 * The envelope's balance returns to Available via recompute (no manual move needed).
 */
export function deleteEnvelope(
  state: AppStateV1,
  args: { envelopeId: string },
): AppStateV1 {
  const envelope = state.budget.envelopes.find(
    (e) => e.id === args.envelopeId,
  );
  if (!envelope) {
    throw new Error("Envelope not found.");
  }

  // Return the envelope's balance to Available to Assign
  const returnedBalance = state.budget.availableToAssign.add(envelope.balance);

  // Remove assignments that point to this envelope and collect freed tx IDs
  const nextAssignments: typeof state.inbox.assignmentsByTransactionId = {};
  const freedTxIds = new Set<string>();
  for (const [txId, assignment] of Object.entries(
    state.inbox.assignmentsByTransactionId,
  )) {
    if (assignment.envelopeId !== args.envelopeId) {
      nextAssignments[txId] = assignment;
    } else {
      freedTxIds.add(txId);
    }
  }

  // Clear freed txs from applied set so they can be re-assigned
  const nextAppliedIds = state.appliedBudgetTransactionIds.filter(
    (id) => !freedTxIds.has(id),
  );

  return {
    ...state,
    budget: {
      ...state.budget,
      availableToAssign: returnedBalance,
      envelopes: state.budget.envelopes.filter(
        (e) => e.id !== args.envelopeId,
      ),
    },
    inbox: {
      ...state.inbox,
      assignmentsByTransactionId: nextAssignments,
    },
    appliedBudgetTransactionIds: nextAppliedIds,
    updatedAt: nowIso(),
  };
}

/**
 * Sets or clears a user note on a transaction.
 * Empty/blank note removes the entry from the map.
 */
export function setTransactionNote(
  state: AppStateV1,
  args: { transactionId: string; note: string },
): AppStateV1 {
  const tx = state.transactions.find((t) => t.id === args.transactionId);
  if (!tx) {
    throw new Error("Transaction not found.");
  }

  const trimmed = args.note.trim();
  const existing = state.transactionNotes ?? {};

  if (!trimmed) {
    // Remove the note entry
    const { [args.transactionId]: _, ...rest } = existing;
    return {
      ...state,
      transactionNotes: rest,
      updatedAt: nowIso(),
    };
  }

  return {
    ...state,
    transactionNotes: {
      ...existing,
      [args.transactionId]: trimmed,
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

/**
 * Removes an assignment from a transaction, returning it to the Inbox.
 * Restores the envelope balance and clears the tx from appliedBudgetTransactionIds
 * so it can be re-assigned to a different envelope later.
 */
export function unassignTransaction(
  state: AppStateV1,
  args: { transactionId: string },
): AppStateV1 {
  const tx = state.transactions.find((t) => t.id === args.transactionId);
  if (!tx) {
    throw new Error("Transaction not found.");
  }

  // Domain function handles inbox: removes assignment, adds to unassigned list
  const nextInbox = unassignTxDomain({
    inbox: state.inbox,
    transactions: state.transactions,
    transactionId: args.transactionId,
  });

  // Restore envelope balance: add the expense amount back
  const assignment = state.inbox.assignmentsByTransactionId[args.transactionId];
  let nextBudget = state.budget;
  if (assignment && tx.amount.cents < 0) {
    const restoreAmount = Money.fromCents(Math.abs(tx.amount.cents));
    nextBudget = {
      ...nextBudget,
      envelopes: nextBudget.envelopes.map((env) =>
        env.id === assignment.envelopeId
          ? { ...env, balance: env.balance.add(restoreAmount) }
          : env,
      ),
    };
  }

  // Remove from applied budget IDs so re-assignment works
  const nextAppliedBudgetIds = state.appliedBudgetTransactionIds.filter(
    (id) => id !== args.transactionId,
  );

  return {
    ...state,
    inbox: nextInbox,
    budget: nextBudget,
    appliedBudgetTransactionIds: nextAppliedBudgetIds,
    updatedAt: nowIso(),
  };
}

/**
 * Seeds the budget's Available to Assign from the total of connected account balances.
 * Sets Available to the provided totalCents (caller computes any delta).
 * Tracks which accounts have been seeded via `seededAccountIds` to support re-seeding
 * when additional accounts are connected.
 */
export function seedBudgetFromBalances(
  state: AppStateV1,
  args: { totalCents: number; accountIds?: string[] },
): AppStateV1 {
  const existing = state.seededAccountIds ?? [];
  const incoming = args.accountIds ?? [];
  const merged = [...new Set([...existing, ...incoming])];

  return {
    ...state,
    budget: {
      ...state.budget,
      availableToAssign: Money.fromCents(args.totalCents),
    },
    budgetSeeded: true,
    seededAccountIds: merged,
    updatedAt: nowIso(),
  };
}
