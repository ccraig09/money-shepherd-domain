import type { Budget } from "../models/Budget";
import type { Money } from "../models/Money";

function findEnvelope(budget: Budget, envelopeId: string) {
  const envelope = budget.envelopes.find((e) => e.id === envelopeId);
  if (!envelope) throw new Error("Envelope not found.");
  return envelope;
}

/**
 * Sets a monthly funding goal on an envelope.
 * Goal must be a positive Money value.
 */
export function setEnvelopeGoal(
  budget: Budget,
  envelopeId: string,
  goal: Money,
): Budget {
  if (goal.cents <= 0) throw new Error("Goal must be a positive amount.");
  findEnvelope(budget, envelopeId);

  return {
    ...budget,
    envelopes: budget.envelopes.map((e) =>
      e.id === envelopeId ? { ...e, goal } : e,
    ),
  };
}

/**
 * Removes the monthly funding goal from an envelope.
 */
export function clearEnvelopeGoal(
  budget: Budget,
  envelopeId: string,
): Budget {
  findEnvelope(budget, envelopeId);

  return {
    ...budget,
    envelopes: budget.envelopes.map((e) =>
      e.id === envelopeId ? { ...e, goal: undefined } : e,
    ),
  };
}
