import { Money } from "../src";
import { Transaction } from "../src/models/Transaction";
import { buildInbox } from "../src/logic/buildInbox";

describe("Transaction Inbox", () => {
  it("includes only transactions with no envelopeId and no existing assignment", () => {
    const txs: Transaction[] = [
      {
        id: "tx-1",
        accountId: "acc-1",
        amount: Money.fromCents(-100),
        description: "Coffee",
        postedAt: "2026-02-11T00:00:00.000Z",
      },
      {
        id: "tx-2",
        accountId: "acc-1",
        amount: Money.fromCents(-200),
        description: "Walmart",
        postedAt: "2026-02-11T00:00:00.000Z",
        envelopeId: "env-groceries",
      },
    ];

    const inbox = buildInbox(txs);
    expect(inbox.unassignedTransactionIds).toEqual(["tx-1"]);
  });

  it("excludes transactions that already have assignments", () => {
    const txs: Transaction[] = [
      {
        id: "tx-1",
        accountId: "acc-1",
        amount: Money.fromCents(-100),
        description: "Coffee",
        postedAt: "2026-02-11T00:00:00.000Z",
      },
    ];

    const inbox = buildInbox(txs, {
      "tx-1": {
        transactionId: "tx-1",
        envelopeId: "env-food",
        assignedByUserId: "user-los",
        assignedAt: "2026-02-11T01:00:00.000Z",
      },
    });

    expect(inbox.unassignedTransactionIds).toEqual([]);
    expect(inbox.assignmentsByTransactionId["tx-1"]!.envelopeId).toBe(
      "env-food",
    );
  });
});
