import { Budget } from "../models/Budget";
import { Money } from "../models/Money";
import { InsufficientEnvelopeFundsError } from "../errors/InsufficientEnvelopeFundsError";

export function spendFromEnvelope(
  budget: Budget,
  envelopeId: string,
  amount: Money,
): Budget {
  if (amount.cents <= 0) return budget;

  const envelope = budget.envelopes.find((e) => e.id === envelopeId);
  if (!envelope) return budget; // tolerate for now

  if (envelope.balance.lessThan(amount)) {
    throw new InsufficientEnvelopeFundsError(
      "Envelope does not have enough funds.",
    );
  }

  const updatedEnvelopes = budget.envelopes.map((env) => {
    if (env.id !== envelopeId) return env;
    return { ...env, balance: env.balance.subtract(amount) };
  });

  return { ...budget, envelopes: updatedEnvelopes };
}
