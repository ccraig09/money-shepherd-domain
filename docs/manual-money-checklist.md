# Manual Money UX Checklist — MS-16.9

Run this after any significant change to money math, the engine, or the Plaid sync layer.
Check each step as you go. A passing run means all expected values match exactly.

---

## Prerequisites

- [ ] Reset local storage via Settings → Reset Local Storage
- [ ] Log back in (anonymous auth)
- [ ] Confirm Dashboard shows **$0.00** available, **$0.00** in envelopes
- [ ] Create one manual account named "Checking" (or use an existing manual account)
- [ ] No envelopes exist yet

---

## Scenario A — Add income

**Goal:** Available to Assign increases by the income amount.

| Step | Action | Where |
|------|--------|-------|
| 1 | Tap **+ Add Transaction** | Dashboard or Transactions tab |
| 2 | Select **Income** | Type toggle |
| 3 | Enter amount **100** | Amount field |
| 4 | Select account **Checking** | Account picker |
| 5 | Tap **Save** | — |

**Expected results:**
- [ ] Transactions tab shows `+$100.00` entry
- [ ] Dashboard "Available to Assign" = **$100.00**
- [ ] Dashboard "Total in envelopes" = **$0.00**
- [ ] Inbox is empty (income is not queued for assignment)

---

## Scenario B — Create envelope + allocate

**Goal:** Funds move from Available into the envelope.

| Step | Action | Where |
|------|--------|-------|
| 1 | Tap **+ New Envelope** | Envelopes tab |
| 2 | Name it **Groceries**, tap Save | — |
| 3 | Tap **$ Allocate** | Envelopes tab header |
| 4 | Select **Groceries** | Envelope picker |
| 5 | Enter amount **40** | Amount field |
| 6 | Tap **Allocate** | — |

**Expected results:**
- [ ] Available to Assign = **$60.00**
- [ ] Groceries envelope balance = **$40.00**
- [ ] Dashboard "Total in envelopes" = **$40.00**
- [ ] Available + envelopes = **$100.00** (conservation check)

---

## Scenario C — Add expense + assign to envelope

**Goal:** Expense lands in Inbox, gets assigned to Groceries, envelope balance decreases.

| Step | Action | Where |
|------|--------|-------|
| 1 | Tap **+ Add Transaction** | Dashboard or Transactions tab |
| 2 | Select **Expense** | Type toggle |
| 3 | Enter amount **12.34** | Amount field |
| 4 | Select account **Checking** | Account picker |
| 5 | Tap **Save** | — |
| 6 | Go to **Inbox** tab | — |
| 7 | Tap the **$12.34** transaction | — |
| 8 | Select **Groceries** | Envelope picker |
| 9 | Tap **Assign** | — |

**Expected results:**
- [ ] Inbox is now empty
- [ ] Groceries envelope balance = **$27.66** (40.00 − 12.34)
- [ ] Available to Assign = **$60.00** (unchanged — expense came from envelope, not available)
- [ ] Envelope detail for Groceries shows the $12.34 transaction in its list

---

## Scenario D — Dashboard conservation check

**Goal:** All money is accounted for — nothing created or lost.

After Scenarios A–C, verify on the Dashboard:

| Field | Expected |
|-------|----------|
| Available to Assign | $60.00 |
| Total in envelopes | $27.66 |
| Available + envelopes | **$87.66** |
| Income added | $100.00 |
| Expense assigned | $12.34 |
| Income − expense | **$87.66** ✓ |

- [ ] Available + envelopes equals income minus assigned expenses

---

## Scenario E — Duplicate envelope guard

**Goal:** User cannot create a second envelope with the same name (case-insensitive).

| Step | Action | Where |
|------|--------|-------|
| 1 | Tap **+ New Envelope** | Envelopes tab |
| 2 | Type **groceries** (lowercase) | Name field |
| 3 | Tap **Save** | — |

**Expected results:**
- [ ] Error shown: `An envelope named "Groceries" already exists.`
- [ ] No new envelope created

---

## Run log

| Date | Tester | Result | Notes |
|------|--------|--------|-------|
|      |        | Pass / Fail | |
