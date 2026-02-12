import { Budget } from "../models/Budget";
import { Money } from "../models/Money";
import { InsufficientAvailableFundsError } from "../errors/InsufficientAvailableFundsError";

export function allocateFunds(
  budget: Budget,
  envelopeId: string,
  amount: Money,
): Budget {
  if (amount.cents <= 0) return budget;

  if (budget.availableToAssign.lessThan(amount)) {
    throw new InsufficientAvailableFundsError(
      "Not enough available funds to allocate.",
    );
  }

  const updatedEnvelopes = budget.envelopes.map((env) => {
    if (env.id !== envelopeId) return env;
    return { ...env, balance: env.balance.add(amount) };
  });

  return {
    ...budget,
    availableToAssign: budget.availableToAssign.subtract(amount),
    envelopes: updatedEnvelopes,
  };
}
