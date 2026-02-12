import { Money } from "./Money";

export type Envelope = {
  id: string;
  name: string;
  balance: Money;
  goal?: Money; // optional future support
};
