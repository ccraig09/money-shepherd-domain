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

> Keep commented until Phase 17 begins.

<!--
### A) Two-device sync
1) Device A (Los): add transaction + create envelope + allocate
2) Device B (Jackia): pull/sync
Expected
- [ ] Device B sees the same household totals and envelopes
- [ ] No duplicates
- [ ] Sync status is clear (synced/pending)

### B) Offline behavior
1) Device A: go offline, add transaction
2) Come back online
Expected
- [ ] Shows pending changes while offline
- [ ] Syncs after reconnect (with retry/backoff)
-->
