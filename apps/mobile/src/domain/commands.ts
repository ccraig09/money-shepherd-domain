import { Money, unassignTransaction as unassignTxDomain, setEnvelopeGoal as setGoalDomain, clearEnvelopeGoal as clearGoalDomain } from "@money-shepherd/domain";
import type { EnvelopeType } from "@money-shepherd/domain";
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
  args: { name: string; type?: EnvelopeType },
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
    ...(args.type && { type: args.type }),
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
 * Deletes a manual transaction, reversing all its effects:
 *   - Account balance reversed (subtract tx amount)
 *   - If assigned expense: envelope balance restored
 *   - If income: availableToAssign reduced
 *   - Assignment removed (if any)
 *   - Tx ID removed from both applied sets
 * Plaid-synced transactions cannot be deleted.
 */
export function deleteTransaction(
  state: AppStateV1,
  args: { transactionId: string },
): AppStateV1 {
  const tx = state.transactions.find((t) => t.id === args.transactionId);
  if (!tx) {
    throw new Error("Transaction not found.");
  }

  if (tx.id.startsWith("plaid-tx-")) {
    throw new Error("Cannot delete a Plaid-synced transaction.");
  }

  // Remove from transactions list
  const nextTransactions = state.transactions.filter(
    (t) => t.id !== args.transactionId,
  );

  // Reverse account balance: subtract the original tx amount
  const reverseDiff = Money.fromCents(-tx.amount.cents);
  const nextAccounts = state.accounts.map((a) =>
    a.id === tx.accountId
      ? { ...a, balance: a.balance.add(reverseDiff) }
      : a,
  );

  // Reverse budget effects
  let nextBudget = state.budget;
  const assignment =
    state.inbox.assignmentsByTransactionId[args.transactionId];

  if (assignment && tx.amount.cents < 0) {
    // Assigned expense: restore envelope balance
    const restoreAmount = Money.fromCents(Math.abs(tx.amount.cents));
    nextBudget = {
      ...nextBudget,
      envelopes: nextBudget.envelopes.map((env) =>
        env.id === assignment.envelopeId
          ? { ...env, balance: env.balance.add(restoreAmount) }
          : env,
      ),
    };
  } else if (tx.amount.cents > 0) {
    // Income: reduce availableToAssign
    nextBudget = {
      ...nextBudget,
      availableToAssign: nextBudget.availableToAssign.add(
        Money.fromCents(-tx.amount.cents),
      ),
    };
  }

  // Remove assignment if it exists
  const { [args.transactionId]: _, ...nextAssignments } =
    state.inbox.assignmentsByTransactionId;

  // Remove from applied sets — tx no longer exists
  const nextAppliedAccount = state.appliedAccountTransactionIds.filter(
    (id) => id !== args.transactionId,
  );
  const nextAppliedBudget = state.appliedBudgetTransactionIds.filter(
    (id) => id !== args.transactionId,
  );

  return {
    ...state,
    transactions: nextTransactions,
    accounts: nextAccounts,
    budget: nextBudget,
    inbox: {
      ...state.inbox,
      assignmentsByTransactionId: nextAssignments,
    },
    appliedAccountTransactionIds: nextAppliedAccount,
    appliedBudgetTransactionIds: nextAppliedBudget,
    updatedAt: nowIso(),
  };
}

/**
 * Edits a transaction's description and/or amount.
 * Plaid-synced transactions (id starts with "plaid-tx-") cannot have their amount changed.
 * When amount changes:
 *   - Account balance is adjusted by the difference
 *   - If the tx is an assigned expense, envelope balance is adjusted by the difference
 *   - If the tx is income (positive), availableToAssign is adjusted by the difference
 */
export function editTransaction(
  state: AppStateV1,
  args: {
    transactionId: string;
    description?: string;
    amountCents?: number;
  },
): AppStateV1 {
  const txIndex = state.transactions.findIndex(
    (t) => t.id === args.transactionId,
  );
  if (txIndex === -1) {
    throw new Error("Transaction not found.");
  }

  const oldTx = state.transactions[txIndex];

  if (args.amountCents !== undefined && oldTx.id.startsWith("plaid-tx-")) {
    throw new Error("Cannot edit amount on a Plaid-synced transaction.");
  }

  const newAmount =
    args.amountCents !== undefined
      ? Money.fromCents(args.amountCents)
      : oldTx.amount;
  const newDescription =
    args.description !== undefined ? args.description : oldTx.description;

  const updatedTx = {
    ...oldTx,
    description: newDescription,
    amount: newAmount,
  };

  const nextTransactions = state.transactions.map((t, i) =>
    i === txIndex ? updatedTx : t,
  );

  let nextAccounts = state.accounts;
  let nextBudget = state.budget;

  if (args.amountCents !== undefined && args.amountCents !== oldTx.amount.cents) {
    const diffCents = args.amountCents - oldTx.amount.cents;
    const diff = Money.fromCents(diffCents);

    // Adjust account balance
    nextAccounts = state.accounts.map((a) =>
      a.id === oldTx.accountId
        ? { ...a, balance: a.balance.add(diff) }
        : a,
    );

    // Adjust budget: envelope (assigned expense) or availableToAssign (income)
    const assignment =
      state.inbox.assignmentsByTransactionId[args.transactionId];

    if (assignment && oldTx.amount.cents < 0) {
      // Assigned expense: adjust envelope balance by diff
      nextBudget = {
        ...nextBudget,
        envelopes: nextBudget.envelopes.map((env) =>
          env.id === assignment.envelopeId
            ? { ...env, balance: env.balance.add(diff) }
            : env,
        ),
      };
    } else if (oldTx.amount.cents > 0) {
      // Income: adjust availableToAssign by diff
      nextBudget = {
        ...nextBudget,
        availableToAssign: nextBudget.availableToAssign.add(diff),
      };
    }
  }

  return {
    ...state,
    transactions: nextTransactions,
    accounts: nextAccounts,
    budget: nextBudget,
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

/**
 * Moves money from one envelope to another.
 * Available to Assign is unchanged — money stays within envelopes.
 */
export function transferBetweenEnvelopes(
  state: AppStateV1,
  args: {
    fromEnvelopeId: string;
    toEnvelopeId: string;
    amountCents: number;
  },
): AppStateV1 {
  if (args.amountCents <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  if (args.fromEnvelopeId === args.toEnvelopeId) {
    throw new Error("Cannot transfer to the same envelope.");
  }

  const source = state.budget.envelopes.find(
    (e) => e.id === args.fromEnvelopeId,
  );
  if (!source) {
    throw new Error("Source envelope not found.");
  }

  const dest = state.budget.envelopes.find(
    (e) => e.id === args.toEnvelopeId,
  );
  if (!dest) {
    throw new Error("Destination envelope not found.");
  }

  if (source.balance.cents < args.amountCents) {
    throw new Error("Insufficient balance in source envelope.");
  }

  const amount = Money.fromCents(args.amountCents);

  return {
    ...state,
    budget: {
      ...state.budget,
      envelopes: state.budget.envelopes.map((env) => {
        if (env.id === args.fromEnvelopeId) {
          return { ...env, balance: env.balance.add(Money.fromCents(-args.amountCents)) };
        }
        if (env.id === args.toEnvelopeId) {
          return { ...env, balance: env.balance.add(amount) };
        }
        return env;
      }),
    },
    updatedAt: nowIso(),
  };
}

/**
 * Sets a monthly funding goal on an envelope.
 * Delegates validation to the domain function.
 */
export function setEnvelopeGoal(
  state: AppStateV1,
  args: { envelopeId: string; goalCents: number },
): AppStateV1 {
  const goal = Money.fromCents(args.goalCents);
  const budget = setGoalDomain(state.budget, args.envelopeId, goal);
  return { ...state, budget, updatedAt: nowIso() };
}

/**
 * Removes the monthly funding goal from an envelope.
 */
export function clearEnvelopeGoal(
  state: AppStateV1,
  args: { envelopeId: string },
): AppStateV1 {
  const budget = clearGoalDomain(state.budget, args.envelopeId);
  return { ...state, budget, updatedAt: nowIso() };
}

/**
 * Sets the type on an envelope (spending, giving, or savings).
 */
export function setEnvelopeType(
  state: AppStateV1,
  args: { envelopeId: string; envelopeType: EnvelopeType },
): AppStateV1 {
  const envelope = state.budget.envelopes.find(
    (e) => e.id === args.envelopeId,
  );
  if (!envelope) {
    throw new Error("Envelope not found.");
  }

  return {
    ...state,
    budget: {
      ...state.budget,
      envelopes: state.budget.envelopes.map((e) =>
        e.id === args.envelopeId ? { ...e, type: args.envelopeType } : e,
      ),
    },
    updatedAt: nowIso(),
  };
}
