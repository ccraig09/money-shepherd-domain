import { Money } from "../src";
import { Budget } from "../src/models/Budget";
import { Envelope } from "../src/models/Envelope";
import { Transaction } from "../src/models/Transaction";
import { TransactionInbox } from "../src/models/TransactionInbox";
import { assignTransactionToEnvelope } from "../src/logic/assignTransactionToEnvelope";
import { TransactionNotFoundError } from "../src/errors/TransactionNotFoundError";
import { EnvelopeNotFoundError } from "../src/errors/EnvelopeNotFoundError";

describe("Assign transaction to envelope (with audit)", () => {
  const groceries: Envelope = {
    id: "env-groceries",
    name: "Groceries",
    balance: Money.zero(),
  };

  const budget: Budget = {
    id: "household-1",
    availableToAssign: Money.zero(),
    envelopes: [groceries],
  };

  const txs: Transaction[] = [
    {
      id: "tx-1",
      accountId: "acc-1",
      amount: Money.fromCents(-200),
      description: "Walmart",
      postedAt: "2026-02-11T00:00:00.000Z",
    },
  ];

  const inbox: TransactionInbox = {
    unassignedTransactionIds: ["tx-1"],
    assignmentsByTransactionId: {},
  };

  it("creates an assignment and removes transaction from unassigned list", () => {
    const next = assignTransactionToEnvelope({
      inbox,
      transactions: txs,
      budget,
      transactionId: "tx-1",
      envelopeId: "env-groceries",
      assignedByUserId: "user-wife",
      assignedAt: "2026-02-11T02:00:00.000Z",
    });

    expect(next.unassignedTransactionIds).toEqual([]);
    expect(next.assignmentsByTransactionId["tx-1"]!.envelopeId).toBe(
      "env-groceries",
    );
    expect(next.assignmentsByTransactionId["tx-1"]!.assignedByUserId).toBe(
      "user-wife",
    );
  });

  it("throws if transaction does not exist", () => {
    expect(() =>
      assignTransactionToEnvelope({
        inbox,
        transactions: txs,
        budget,
        transactionId: "tx-404",
        envelopeId: "env-groceries",
        assignedByUserId: "user-los",
        assignedAt: "2026-02-11T02:00:00.000Z",
      }),
    ).toThrow(TransactionNotFoundError);
  });

  it("throws if envelope does not exist", () => {
    expect(() =>
      assignTransactionToEnvelope({
        inbox,
        transactions: txs,
        budget,
        transactionId: "tx-1",
        envelopeId: "env-404",
        assignedByUserId: "user-los",
        assignedAt: "2026-02-11T02:00:00.000Z",
      }),
    ).toThrow(EnvelopeNotFoundError);
  });

  it("allows reassignment (overwrites assignment with new audit info)", () => {
    const first = assignTransactionToEnvelope({
      inbox,
      transactions: txs,
      budget,
      transactionId: "tx-1",
      envelopeId: "env-groceries",
      assignedByUserId: "user-los",
      assignedAt: "2026-02-11T02:00:00.000Z",
    });

    const second = assignTransactionToEnvelope({
      inbox: first,
      transactions: txs,
      budget,
      transactionId: "tx-1",
      envelopeId: "env-groceries",
      assignedByUserId: "user-wife",
      assignedAt: "2026-02-11T03:00:00.000Z",
    });

    expect(second.assignmentsByTransactionId["tx-1"]!.assignedByUserId).toBe(
      "user-wife",
    );
    expect(second.assignmentsByTransactionId["tx-1"]!.assignedAt).toBe(
      "2026-02-11T03:00:00.000Z",
    );
  });
});
