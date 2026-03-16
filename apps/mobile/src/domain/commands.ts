import { Money, normalizePayee, reorderGroups, unassignTransaction as unassignTxDomain, setEnvelopeGoal as setGoalDomain, clearEnvelopeGoal as clearGoalDomain, setEnvelopeTarget as setTargetDomain, clearEnvelopeTarget as clearTargetDomain } from "@money-shepherd/domain";
import type { EnvelopeType, EnvelopeGroup, AssignmentRule } from "@money-shepherd/domain";
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
  args: { name: string; type?: EnvelopeType; groupId?: string },
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
    ...(args.groupId && { groupId: args.groupId }),
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

  // Memorize payee → envelope for future suggestions
  const tx = state.transactions.find((t) => t.id === args.transactionId);
  const normalized = tx ? normalizePayee(tx.description) : "";
  const nextPayeeMappings = normalized
    ? { ...(state.payeeMappings ?? {}), [normalized]: args.envelopeId }
    : { ...(state.payeeMappings ?? {}) };

  return {
    ...state,
    inbox: {
      ...state.inbox,
      assignmentsByTransactionId: nextAssignments,
    },
    payeeMappings: nextPayeeMappings,
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
    // Assigned expense: reverse the budget effect.
    // For debt envelopes the original action was an ADD (payment),
    // so reversal subtracts. For normal envelopes it was a SUBTRACT
    // (spending), so reversal adds.
    const absAmount = Money.fromCents(Math.abs(tx.amount.cents));
    const targetEnv = nextBudget.envelopes.find(
      (e) => e.id === assignment.envelopeId,
    );
    const isDebt = targetEnv?.type === "debt";
    nextBudget = {
      ...nextBudget,
      envelopes: nextBudget.envelopes.map((env) =>
        env.id === assignment.envelopeId
          ? {
              ...env,
              balance: isDebt
                ? env.balance.subtract(absAmount)
                : env.balance.add(absAmount),
            }
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

  // Restore envelope balance: reverse the original budget effect.
  // For debt envelopes the original was an ADD (payment) → subtract.
  // For normal envelopes the original was a SUBTRACT (spend) → add.
  const assignment = state.inbox.assignmentsByTransactionId[args.transactionId];
  let nextBudget = state.budget;
  if (assignment && tx.amount.cents < 0) {
    const absAmount = Money.fromCents(Math.abs(tx.amount.cents));
    const targetEnv = nextBudget.envelopes.find(
      (e) => e.id === assignment.envelopeId,
    );
    const isDebt = targetEnv?.type === "debt";
    nextBudget = {
      ...nextBudget,
      envelopes: nextBudget.envelopes.map((env) =>
        env.id === assignment.envelopeId
          ? {
              ...env,
              balance: isDebt
                ? env.balance.subtract(absAmount)
                : env.balance.add(absAmount),
            }
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
 *
 * Also marks all income transactions as already applied to the budget.
 * Bank balances already reflect historical income deposits — without this,
 * recompute() would re-add income on top of the seeded balance (double-counting).
 * Only income (positive amount) is marked; expenses stay unapplied so future
 * envelope assignments can deduct correctly.
 */
export function seedBudgetFromBalances(
  state: AppStateV1,
  args: { totalCents: number; accountIds?: string[] },
): AppStateV1 {
  const existing = state.seededAccountIds ?? [];
  const incoming = args.accountIds ?? [];
  const merged = [...new Set([...existing, ...incoming])];

  // Mark income transactions as already applied — bank balances include them.
  const preAppliedIds = new Set(state.appliedBudgetTransactionIds);
  for (const tx of state.transactions) {
    if (tx.amount.cents > 0) {
      preAppliedIds.add(tx.id);
    }
  }

  return {
    ...state,
    budget: {
      ...state.budget,
      availableToAssign: Money.fromCents(args.totalCents),
    },
    budgetSeeded: true,
    seededAccountIds: merged,
    appliedBudgetTransactionIds: Array.from(preAppliedIds),
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
 * Sets a total payoff/budget target on an envelope.
 * Delegates validation to the domain function.
 */
export function setEnvelopeTarget(
  state: AppStateV1,
  args: { envelopeId: string; targetCents: number },
): AppStateV1 {
  const target = Money.fromCents(args.targetCents);
  const budget = setTargetDomain(state.budget, args.envelopeId, target);
  return { ...state, budget, updatedAt: nowIso() };
}

/**
 * Removes the payoff/budget target from an envelope.
 */
export function clearEnvelopeTarget(
  state: AppStateV1,
  args: { envelopeId: string },
): AppStateV1 {
  const budget = clearTargetDomain(state.budget, args.envelopeId);
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

/**
 * Adds a user-created assignment rule.
 * Rules are evaluated before payee memorization in suggestEnvelope().
 */
export function addAssignmentRule(
  state: AppStateV1,
  args: { pattern: string; matchType: AssignmentRule["matchType"]; envelopeId: string; priority: number },
): AppStateV1 {
  const trimmed = args.pattern.trim();
  if (!trimmed) {
    throw new Error("Pattern is required.");
  }

  const rule: AssignmentRule = {
    id: makeId("rule"),
    pattern: trimmed.toLowerCase(),
    matchType: args.matchType,
    envelopeId: args.envelopeId,
    priority: args.priority,
  };

  return {
    ...state,
    assignmentRules: [...(state.assignmentRules ?? []), rule],
    updatedAt: nowIso(),
  };
}

/**
 * Removes an assignment rule by ID.
 */
export function removeAssignmentRule(
  state: AppStateV1,
  args: { ruleId: string },
): AppStateV1 {
  const existing = state.assignmentRules ?? [];
  const index = existing.findIndex((r) => r.id === args.ruleId);
  if (index === -1) {
    throw new Error("Rule not found.");
  }

  return {
    ...state,
    assignmentRules: existing.filter((r) => r.id !== args.ruleId),
    updatedAt: nowIso(),
  };
}

/**
 * Reorders assignment rules by reassigning priorities based on new ID order.
 * First ID in the array gets priority 1, second gets 2, etc.
 */
export function reorderAssignmentRules(
  state: AppStateV1,
  args: { ruleIds: string[] },
): AppStateV1 {
  const existing = state.assignmentRules ?? [];
  const byId = Object.fromEntries(existing.map((r) => [r.id, r]));

  const reordered = args.ruleIds
    .filter((id) => Object.hasOwn(byId, id))
    .map((id, i) => ({ ...byId[id], priority: i + 1 }));

  return {
    ...state,
    assignmentRules: reordered,
    updatedAt: nowIso(),
  };
}

// ─── Envelope Group Commands ──────────────────────────────────

/**
 * Creates an envelope group.
 * Name is normalized (trim + collapse spaces) and must be unique (case-insensitive).
 */
export function createEnvelopeGroup(
  state: AppStateV1,
  args: { name: string },
): AppStateV1 {
  const normalizedName = args.name.trim().replace(/\s+/g, " ");

  if (!normalizedName) {
    throw new Error("Group name is required.");
  }

  const existing = state.envelopeGroups ?? [];
  const duplicate = existing.find(
    (g) => g.name.toLowerCase() === normalizedName.toLowerCase(),
  );
  if (duplicate) {
    throw new Error(`A group named "${duplicate.name}" already exists.`);
  }

  const maxSort = existing.length > 0
    ? Math.max(...existing.map((g) => g.sortOrder))
    : -1;

  const group: EnvelopeGroup = {
    id: makeId("grp"),
    name: normalizedName,
    sortOrder: maxSort + 1,
  };

  return {
    ...state,
    envelopeGroups: [...existing, group],
    updatedAt: nowIso(),
  };
}

/**
 * Renames an envelope group.
 * Name is normalized and must be unique among other groups.
 * Returns same state reference when name is unchanged (no-op).
 */
export function renameEnvelopeGroup(
  state: AppStateV1,
  args: { groupId: string; name: string },
): AppStateV1 {
  const normalizedName = args.name.trim().replace(/\s+/g, " ");

  if (!normalizedName) {
    throw new Error("Group name is required.");
  }

  const groups = state.envelopeGroups ?? [];
  const group = groups.find((g) => g.id === args.groupId);
  if (!group) {
    throw new Error("Group not found.");
  }

  if (group.name === normalizedName) {
    return state;
  }

  const duplicate = groups.find(
    (g) => g.id !== args.groupId && g.name.toLowerCase() === normalizedName.toLowerCase(),
  );
  if (duplicate) {
    throw new Error(`A group named "${duplicate.name}" already exists.`);
  }

  return {
    ...state,
    envelopeGroups: groups.map((g) =>
      g.id === args.groupId ? { ...g, name: normalizedName } : g,
    ),
    updatedAt: nowIso(),
  };
}

/**
 * Deletes an envelope group.
 * Envelopes that belonged to this group have their groupId cleared (become ungrouped).
 */
export function deleteEnvelopeGroup(
  state: AppStateV1,
  args: { groupId: string },
): AppStateV1 {
  const groups = state.envelopeGroups ?? [];
  const group = groups.find((g) => g.id === args.groupId);
  if (!group) {
    throw new Error("Group not found.");
  }

  return {
    ...state,
    envelopeGroups: groups.filter((g) => g.id !== args.groupId),
    budget: {
      ...state.budget,
      envelopes: state.budget.envelopes.map((e) =>
        e.groupId === args.groupId ? { ...e, groupId: undefined } : e,
      ),
    },
    updatedAt: nowIso(),
  };
}

/**
 * Reorders envelope groups by the given ID array.
 * Delegates to the domain's reorderGroups function.
 */
export function reorderEnvelopeGroups(
  state: AppStateV1,
  args: { orderedIds: string[] },
): AppStateV1 {
  const groups = state.envelopeGroups ?? [];
  const reordered = reorderGroups(groups, args.orderedIds);

  return {
    ...state,
    envelopeGroups: reordered,
    updatedAt: nowIso(),
  };
}

/**
 * Moves an envelope into a group, or removes it from its group (ungroup).
 * Pass groupId: null to ungroup.
 */
export function moveEnvelopeToGroup(
  state: AppStateV1,
  args: { envelopeId: string; groupId: string | null },
): AppStateV1 {
  const envelope = state.budget.envelopes.find((e) => e.id === args.envelopeId);
  if (!envelope) {
    throw new Error("Envelope not found.");
  }

  if (args.groupId !== null) {
    const groups = state.envelopeGroups ?? [];
    const group = groups.find((g) => g.id === args.groupId);
    if (!group) {
      throw new Error("Group not found.");
    }
  }

  return {
    ...state,
    budget: {
      ...state.budget,
      envelopes: state.budget.envelopes.map((e) =>
        e.id === args.envelopeId
          ? { ...e, groupId: args.groupId === null ? undefined : args.groupId }
          : e,
      ),
    },
    updatedAt: nowIso(),
  };
}

// ─── Account Dedup Commands ───────────────────────────────────

/**
 * Returns true if duplicate Plaid accounts exist in state.
 * Groups by (name, ownerUserId) — accounts without ownerUserId group by name only.
 */
/**
 * Removes transactions by ID (used when Plaid reports transactions as removed).
 * Also cleans up inbox references and assignment records for removed transactions.
 */
export function removePlaidTransactions(
  state: AppStateV1,
  args: { transactionIds: string[] },
): AppStateV1 {
  if (args.transactionIds.length === 0) return state;

  const removeSet = new Set(args.transactionIds);
  const nextTransactions = state.transactions.filter((tx) => !removeSet.has(tx.id));

  // Nothing actually removed — short-circuit
  if (nextTransactions.length === state.transactions.length) return state;

  // Clean inbox: remove from unassigned list + assignment records
  const nextUnassigned = state.inbox.unassignedTransactionIds.filter((id) => !removeSet.has(id));
  const nextAssignments = { ...state.inbox.assignmentsByTransactionId };
  for (const id of args.transactionIds) {
    delete nextAssignments[id];
  }

  // Clean applied-ID lists
  const nextAppliedAccount = state.appliedAccountTransactionIds.filter((id) => !removeSet.has(id));
  const nextAppliedBudget = state.appliedBudgetTransactionIds.filter((id) => !removeSet.has(id));

  return {
    ...state,
    transactions: nextTransactions,
    inbox: {
      unassignedTransactionIds: nextUnassigned,
      assignmentsByTransactionId: nextAssignments,
    },
    appliedAccountTransactionIds: nextAppliedAccount,
    appliedBudgetTransactionIds: nextAppliedBudget,
    updatedAt: nowIso(),
  };
}

/**
 * Removes accounts by ID. Transactions referencing removed accounts are
 * preserved (orphaned gracefully) — the UI will fall back to showing the
 * raw accountId, which is acceptable for historical data.
 */
export function removeAccounts(
  state: AppStateV1,
  args: { accountIds: string[] },
): AppStateV1 {
  if (args.accountIds.length === 0) return state;

  const removeSet = new Set(args.accountIds);
  const nextAccounts = state.accounts.filter((a) => !removeSet.has(a.id));

  if (nextAccounts.length === state.accounts.length) return state;

  return {
    ...state,
    accounts: nextAccounts,
    updatedAt: nowIso(),
  };
}

export function hasDuplicateAccounts(state: AppStateV1): boolean {
  const plaidAccounts = state.accounts.filter((a) => a.id.startsWith("plaid-"));
  const groups = new Map<string, number>();
  for (const a of plaidAccounts) {
    const key = `${a.name}::${a.ownerUserId ?? "unknown"}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return Array.from(groups.values()).some((count) => count > 1);
}

/**
 * Deduplicates Plaid accounts by (name, ownerUserId).
 * For each group with >1 account, keeps the one with the most transaction references.
 * Reparents orphaned transactions to the keeper, updates seededAccountIds.
 * Idempotent — returns state unchanged if no dupes found.
 */
export function deduplicateAccounts(state: AppStateV1): { state: AppStateV1; removedCount: number } {
  const plaidAccounts = state.accounts.filter((a) => a.id.startsWith("plaid-"));
  const nonPlaidAccounts = state.accounts.filter((a) => !a.id.startsWith("plaid-"));

  // Group Plaid accounts by (name, ownerUserId)
  const groups = new Map<string, typeof plaidAccounts>();
  for (const a of plaidAccounts) {
    const key = `${a.name}::${a.ownerUserId ?? "unknown"}`;
    const group = groups.get(key) ?? [];
    group.push(a);
    groups.set(key, group);
  }

  // Count transaction references per account
  const txRefCount = new Map<string, number>();
  for (const tx of state.transactions) {
    txRefCount.set(tx.accountId, (txRefCount.get(tx.accountId) ?? 0) + 1);
  }

  // For each group with dupes, pick keeper (most tx refs), collect removals
  const keeperAccounts: typeof plaidAccounts = [];
  const remapIds = new Map<string, string>(); // removedId → keeperId
  let removedCount = 0;

  for (const group of groups.values()) {
    if (group.length === 1) {
      keeperAccounts.push(group[0]);
      continue;
    }

    // Sort by tx refs descending, then by ID stability (shorter ID first)
    const sorted = [...group].sort((a, b) => {
      const aRefs = txRefCount.get(a.id) ?? 0;
      const bRefs = txRefCount.get(b.id) ?? 0;
      if (bRefs !== aRefs) return bRefs - aRefs;
      return a.id.length - b.id.length;
    });

    const keeper = sorted[0];
    keeperAccounts.push(keeper);

    for (let i = 1; i < sorted.length; i++) {
      remapIds.set(sorted[i].id, keeper.id);
      removedCount++;
    }
  }

  if (removedCount === 0) {
    return { state, removedCount: 0 };
  }

  // Reparent transactions
  const nextTransactions = state.transactions.map((tx) => {
    const newAccountId = remapIds.get(tx.accountId);
    if (!newAccountId) return tx;
    return { ...tx, accountId: newAccountId };
  });

  // Update seededAccountIds — replace removed IDs with keeper
  let nextSeededIds = state.seededAccountIds;
  if (nextSeededIds) {
    const seededSet = new Set(nextSeededIds);
    for (const [removedId, keeperId] of remapIds) {
      if (seededSet.has(removedId)) {
        seededSet.delete(removedId);
        seededSet.add(keeperId);
      }
    }
    nextSeededIds = Array.from(seededSet);
  }

  return {
    state: {
      ...state,
      accounts: [...nonPlaidAccounts, ...keeperAccounts],
      transactions: nextTransactions,
      seededAccountIds: nextSeededIds,
      updatedAt: nowIso(),
    },
    removedCount,
  };
}

/**
 * Merges AI-derived merchant→envelopeId mappings into aiPayeeMappings.
 * New mappings are added; existing entries are preserved (user's manual
 * assignments via payeeMappings are not affected).
 */
export function mergeAiPayeeMappings(
  state: AppStateV1,
  mappings: Record<string, string>,
): AppStateV1 {
  if (Object.keys(mappings).length === 0) return state;
  return {
    ...state,
    aiPayeeMappings: { ...(state.aiPayeeMappings ?? {}), ...mappings },
    updatedAt: nowIso(),
  };
}

/**
 * Dismiss the first-run Getting Started card.
 * Idempotent — calling when already dismissed is a no-op.
 */
export function dismissFirstRun(state: AppStateV1): AppStateV1 {
  if (state.firstRunDismissed) return state;
  return { ...state, firstRunDismissed: true, updatedAt: nowIso() };
}
