import { Money } from "./Money";

export type EnvelopeType = "spending" | "giving" | "savings";

export type Envelope = {
  id: string;
  name: string;
  balance: Money;
  goal?: Money;
  type?: EnvelopeType;
};
