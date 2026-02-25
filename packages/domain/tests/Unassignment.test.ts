import { Money } from "../src";
import { Transaction } from "../src/models/Transaction";
import { TransactionInbox } from "../src/models/TransactionInbox";
import { unassignTransaction } from "../src/logic/unassignTransaction";
import { TransactionNotFoundError } from "../src/errors/TransactionNotFoundError";
import { TransactionNotAssignedError } from "../src/errors/TransactionNotAssignedError";

describe("Unassign transaction", () => {
  const txs: Transaction[] = [
    {
      id: "tx-1",
      accountId: "acc-1",
      amount: Money.fromCents(-500),
      description: "Walmart",
      postedAt: "2026-02-20T00:00:00.000Z",
    },
    {
      id: "tx-2",
      accountId: "acc-1",
      amount: Money.fromCents(-300),
      description: "Target",
      postedAt: "2026-02-21T00:00:00.000Z",
    },
  ];

  const assignedInbox: TransactionInbox = {
    unassignedTransactionIds: [],
    assignmentsByTransactionId: {
      "tx-1": {
        transactionId: "tx-1",
        envelopeId: "env-groceries",
        assignedByUserId: "user-los",
        assignedAt: "2026-02-20T01:00:00.000Z",
      },
      "tx-2": {
        transactionId: "tx-2",
        envelopeId: "env-dining",
        assignedByUserId: "user-los",
        assignedAt: "2026-02-21T01:00:00.000Z",
      },
    },
  };

  it("removes assignment and adds tx back to unassigned list", () => {
    const next = unassignTransaction({
      inbox: assignedInbox,
      transactions: txs,
      transactionId: "tx-1",
    });

    expect(next.assignmentsByTransactionId["tx-1"]).toBeUndefined();
    expect(next.unassignedTransactionIds).toContain("tx-1");
  });

  it("preserves other assignments when unassigning one tx", () => {
    const next = unassignTransaction({
      inbox: assignedInbox,
      transactions: txs,
      transactionId: "tx-1",
    });

    expect(next.assignmentsByTransactionId["tx-2"]).toBeDefined();
    expect(next.assignmentsByTransactionId["tx-2"]!.envelopeId).toBe(
      "env-dining",
    );
  });

  it("throws TransactionNotFoundError if tx does not exist", () => {
    expect(() =>
      unassignTransaction({
        inbox: assignedInbox,
        transactions: txs,
        transactionId: "tx-404",
      }),
    ).toThrow(TransactionNotFoundError);
  });

  it("throws TransactionNotAssignedError if tx is not assigned", () => {
    const inboxWithUnassigned: TransactionInbox = {
      unassignedTransactionIds: ["tx-1"],
      assignmentsByTransactionId: {},
    };

    expect(() =>
      unassignTransaction({
        inbox: inboxWithUnassigned,
        transactions: txs,
        transactionId: "tx-1",
      }),
    ).toThrow(TransactionNotAssignedError);
  });
});
