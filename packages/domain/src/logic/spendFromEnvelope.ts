import { Budget } from "../models/Budget";
import { Money } from "../models/Money";

/**
 * Deduct amount from an envelope balance.
 * Negative balances are allowed (overspent) — the UI surfaces this as a
 * visual cue to the user that more funds need to be allocated.
 */
export function spendFromEnvelope(
  budget: Budget,
  envelopeId: string,
  amount: Money,
): Budget {
  if (amount.cents <= 0) return budget;

  const envelope = budget.envelopes.find((e) => e.id === envelopeId);
  if (!envelope) return budget; // tolerate stale envelopeId

  const updatedEnvelopes = budget.envelopes.map((env) => {
    if (env.id !== envelopeId) return env;
    return { ...env, balance: env.balance.subtract(amount) };
  });

  return { ...budget, envelopes: updatedEnvelopes };
}
