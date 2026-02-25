import { Money, allocateFunds, type Allocation } from "@money-shepherd/domain";
import type { AppStateV1 } from "./appState";
import { nowIso } from "../lib/id";

/**
 * Allocate from AvailableToAssign into an envelope.
 * This is a pure “state transform” that relies on domain logic.
 */
export function allocateToEnvelope(
  state: AppStateV1,
  args: { envelopeId: string; amountCents: number },
): AppStateV1 {
  const amount = Money.fromCents(args.amountCents);

  const budget = allocateFunds(state.budget, args.envelopeId, amount);

  const record: Allocation = {
    envelopeId: args.envelopeId,
    amount,
    allocatedAt: nowIso().slice(0, 10),
  };

  return {
    ...state,
    budget,
    allocations: [...(state.allocations ?? []), record],
    updatedAt: nowIso(),
  };
}
