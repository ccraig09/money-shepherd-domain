import { Money } from "./Money";
import { Envelope } from "./Envelope";

export type Budget = {
  id: string; // “household-1” for you + wife
  availableToAssign: Money;
  envelopes: Envelope[];
};
