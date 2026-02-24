# SMOKE_TESTS.md

# Money Shepherd - Manual Smoke Tests (Living)

> Purpose:
>
> - Replace excessive UI testing with a reliable manual checklist.
> - Run the Phase smoke checks before moving to the next phase.
> - Keep steps short, observable, and repeatable.

---

## Conventions

- **Expected** lines must be specific and visible in the UI.
- If a step fails, write a short note under the phase’s “Notes / Bugs Found”.
- Run on **your device** first, then **Jackia’s device** when sync/auth is involved.

---

## Phase 14 Smoke Test: Core UI flows (Manual + envelopes + inbox + dashboard)

### Pre-flight

- [ ] App boots successfully (no red screen)
- [ ] You can reach: Dashboard, Transactions, Inbox, Envelopes
- [ ] Local state is loading (not stuck in a spinner)

### A) Add income transaction (Los)

1. Go to **Add Transaction**
2. Select account: **Los Checking**
3. Enter amount: **+100.00**
4. Description: **Paycheck**
5. Save

**Expected**

- [ ] Transaction appears in **Transactions list** with correct description and amount
- [ ] **Los Checking** balance increases by $100.00
- [ ] **Available to Assign** increases by $100.00 (or matches your domain rule if different)

---

### B) Create envelope + allocate

1. Go to **Envelopes**
2. Create envelope: **Groceries**
3. Allocate: **50.00** to Groceries

**Expected**

- [ ] Groceries envelope exists
- [ ] Groceries balance is **$50.00**
- [ ] Available to Assign decreased by **$50.00**

---

### C) Add expense transaction (should go to Inbox)

1. Go to **Add Transaction**
2. Select account: **Los Checking**
3. Enter amount: **-20.00**
4. Description: **Walmart**
5. Save

**Expected**

- [ ] Transaction appears in **Transactions list**
- [ ] Inbox shows **1 unassigned** transaction (Walmart)
- [ ] Los Checking balance decreases by **$20.00**

---

### D) Assign expense to envelope (Groceries should go down)

1. Go to **Inbox**
2. Select transaction: **Walmart -$20.00**
3. Assign to envelope: **Groceries**
4. Confirm assignment

**Expected**

- [ ] Walmart disappears from “Unassigned” list (or is marked assigned)
- [ ] Groceries envelope balance becomes **$30.00**
- [ ] Assignment is reflected in transaction detail (if you show it)

---

### E) Envelope detail sanity

1. Open **Groceries** envelope detail

**Expected**

- [ ] Shows current balance **$30.00**
- [ ] Shows activity including Walmart assignment (if activity list exists)

---

### F) Persistence sanity (local-only)

1. Force close the app
2. Reopen the app

**Expected**

- [ ] Balances and envelopes persist
- [ ] Walmart remains assigned
- [ ] No duplicate transactions appear

---

### Notes / Bugs Found (Phase 14)

- (Add bullets when you find issues)
- Example:
  - [ ] BUG: Assigning transaction does not reduce envelope balance
  - [ ] BUG: Transaction list duplicates after restart

---

## Phase 15 Smoke Test (Plaid integration)

> Keep commented until Phase 15 begins.

<!--
### A) Connect Plaid
1) Go to Connect
2) Link institution (Los)
3) Complete Link flow

Expected
- [ ] Link completes successfully
- [ ] Token stored securely (no relink on restart)

### B) Mapping + refresh
1) Map accounts to domain accounts
2) Pull-to-refresh

Expected
- [ ] Accounts update without duplicates
- [ ] Transactions merge without duplicates
- [ ] Cost guardrails prevent refresh spam
-->

---

## Phase 17 Smoke Test (Sync / two devices)

### Pre-flight

- [ ] Both devices are signed in (Los phone + Jackia phone)
- [ ] Both devices show the same household ID in Settings
- [ ] Settings sync card shows "Up to date" or "Synced" on both

---

### A) Los adds income, Jackia sees it

1. **Los phone:** Add Transaction → Los Checking → +200.00 → "Paycheck"
2. Wait for sync indicator to show "Synced"
3. **Jackia phone:** Open app (or tap "Sync now" in Settings)

**Expected**

- [ ] Los: transaction appears, balance increases, sync shows "Synced"
- [ ] Jackia: same transaction visible with correct amount
- [ ] Jackia: Los Checking balance matches Los's device
- [ ] No duplicate transactions on either device

---

### B) Jackia creates envelope + assigns expense

1. **Jackia phone:** Envelopes → Create "Groceries" → Allocate $50.00
2. **Jackia phone:** Add Transaction → -30.00 → "Walmart" → assign to Groceries
3. Wait for sync indicator to show "Synced"
4. **Los phone:** Tap "Sync now" in Settings (or reopen app)

**Expected**

- [ ] Jackia: Groceries envelope exists with $20.00 balance ($50 - $30)
- [ ] Los: sees Groceries envelope with $20.00 balance
- [ ] Los: sees Walmart transaction assigned to Groceries
- [ ] Available to Assign matches on both devices

---

### C) Both devices see consistent state

1. **Both phones:** Open Dashboard

**Expected**

- [ ] Total account balances match
- [ ] Available to Assign matches
- [ ] Envelope list and balances match
- [ ] Transaction count matches

---

### D) Pending changes indicator

1. **Los phone:** Create envelope "Entertainment"
2. Immediately check sync indicator before push completes

**Expected**

- [ ] Indicator briefly shows pending state or "Syncing..."
- [ ] Transitions to "Synced" within a few seconds
- [ ] Settings shows "Pending changes: None" after sync

---

### E) Offline changes + reconnect

1. **Los phone:** Turn on Airplane Mode
2. Add Transaction → +50.00 → "Freelance gig"
3. Check Settings → Pending changes should show "1"
4. Turn off Airplane Mode
5. Wait (or tap "Sync now")

**Expected**

- [ ] Transaction saves locally while offline (no crash)
- [ ] Pending changes count increments while offline
- [ ] After reconnect, sync retries and succeeds within ~5 seconds
- [ ] Indicator transitions to "Synced"
- [ ] Jackia sees the transaction after syncing

---

### F) Conflict resolution (both edit quickly)

1. **Both phones:** Make sure both are synced and showing same state
2. **Los phone:** Turn on Airplane Mode
3. **Los phone:** Create envelope "Savings"
4. **Jackia phone:** Create envelope "Emergency Fund"
5. Wait for Jackia's sync to complete ("Synced")
6. **Los phone:** Turn off Airplane Mode, wait for sync

**Expected**

- [ ] Los: sees "Updated from another device" message briefly
- [ ] Los: local state is replaced by Jackia's version (remote wins)
- [ ] Los: "Emergency Fund" envelope is visible
- [ ] Los: "Savings" envelope may be gone (remote wins = Jackia's state)
- [ ] No crash, no data corruption
- [ ] Both devices converge to the same state

---

### Notes / Bugs Found (Phase 17)

- (Add bullets when you find issues)
- Example:
  - [ ] BUG: Sync indicator stuck after airplane mode toggle
  - [ ] BUG: Duplicate envelopes after conflict resolution

---

## Phase 23 Smoke Test: Daily Use Essentials (budget periods, tx editing, transfers, giving)

> **Build order note:** Run this after Phase 19, before Phase 20.

### Pre-flight

- [ ] App boots successfully
- [ ] At least 2 envelopes exist with balances
- [ ] At least 3 transactions exist (1 manual, 2+ assigned)

---

### A) Unassign a transaction

1. Open a transaction that is assigned to an envelope (e.g., "Walmart" → Groceries)
2. Tap **Unassign** (or equivalent)
3. Confirm

**Expected**

- [ ] Transaction returns to **Inbox** as unassigned
- [ ] Envelope balance is restored (Groceries increases by the transaction amount)
- [ ] Transaction detail no longer shows envelope assignment

---

### B) Edit a manual transaction

1. Open a **manual** transaction (not Plaid-synced)
2. Edit description from "Walmart" to "Walmart Groceries"
3. Save

**Expected**

- [ ] Description updates in transaction list, detail, and envelope activity
- [ ] Amount and date remain unchanged

---

### C) Delete a manual transaction

1. Open a **manual** transaction
2. Tap **Delete** → confirm destructive action

**Expected**

- [ ] Transaction removed from list
- [ ] If assigned: envelope balance restored, assignment removed
- [ ] If unassigned: removed from Inbox
- [ ] Budget recalculated (Available to Assign adjusts)

---

### D) Plaid transaction guardrails

1. Open a **Plaid-synced** transaction

**Expected**

- [ ] Can edit description/note
- [ ] Cannot change amount (locked or hidden)
- [ ] Cannot delete (button disabled or absent)

---

### E) Transfer between envelopes

1. Go to an envelope (e.g., Groceries with $200 balance)
2. Tap **Move money** (or navigate to transfer screen)
3. Transfer $50 from Groceries → Entertainment

**Expected**

- [ ] Groceries balance decreases by $50
- [ ] Entertainment balance increases by $50
- [ ] Available to Assign unchanged
- [ ] Both devices show updated balances after sync

---

### F) Set envelope goal + fill envelopes

1. Open Groceries envelope detail
2. Set monthly goal to **$500**
3. Go to Dashboard — verify progress bar shows funding %
4. Navigate to **Fill Envelopes** screen (from paycheck nudge or quick action)
5. Tap **Fill All** (or adjust individual amounts)

**Expected**

- [ ] Goal set successfully, visible in envelope detail
- [ ] ProgressBar on Dashboard/Envelopes reflects funding progress toward $500
- [ ] Fill Envelopes screen shows each envelope with target, funded-this-month, and remaining
- [ ] Fill All allocates remaining amounts from Available
- [ ] Available to Assign decreases by total filled amount

---

### G) Period-aware dashboard

1. Open Dashboard

**Expected**

- [ ] "This Month" summary card shows income, spending, and net for current month
- [ ] Envelope rows show "spent this month" alongside balance
- [ ] Data matches manual calculation

---

### H) Giving envelope

1. Create a new envelope
2. Mark type as **Giving** (e.g., "Tithe")
3. Go to Envelopes list

**Expected**

- [ ] Giving envelope appears **first** in the list (before spending envelopes)
- [ ] Dashboard shows giving total in a visible location
- [ ] Envelope detail shows type as Giving

---

### I) Period summary

1. Tap "This Month" summary card on Dashboard (or navigate to Period Summary)

**Expected**

- [ ] Shows monthly income total
- [ ] Shows monthly spending total
- [ ] Shows monthly giving total
- [ ] Shows net (income - spending)
- [ ] Shows per-envelope spending breakdown
- [ ] Data matches manual calculation

---

### J) Persistence + sync

1. Complete steps A–I above
2. Force close app, reopen
3. Sync to second device

**Expected**

- [ ] All changes persist locally
- [ ] Second device shows same goals, types, balances after sync
- [ ] No data loss or duplication

---

### Notes / Bugs Found (Phase 23)

- (Add bullets when you find issues)
