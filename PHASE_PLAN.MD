# PHASE_PLAN.md

# Money Shepherd - Phase Plan (Living Checklist)

> Purpose:
>
> - This file is the "WHAT" to build, in order.
> - For "HOW" to build (agent rules, tests policy, commands), see `AGENT_WORKFLOW.md`.
> - Keep this document updated as you complete tickets.

## How to use this file

- Work top-to-bottom within a phase unless a ticket is blocked.
- Mark tickets complete with `[x]`.
- If blocked, add a note under **Blockers / Notes** with why and what unblocks it.
- When switching phases, finish the **Phase Smoke Check** section before moving on.

---

## Phase 13: Setup + PIN + Bootstrap (Two-device foundation)

### Recommended build order (do not reorder unless blocked)

- [x] MS-13.1 Setup screen UI + saveSyncMeta
- [x] MS-13.2 Bootstrap + loading/error
- [x] MS-13.5 Routing guard (Setup → App)
- [x] MS-13.4 PIN infra + screens
- [x] MS-13.3 Settings (switch/reset)
- [x] MS-13.6 Indicator

### Phase 13 Smoke Check (must pass before Phase 14)

#### A) Fresh install (Device A: Los)

- [x] Launch app → Setup screen appears (not the main app)
- [x] Complete Setup:
  - [x] Choose user = Los
  - [x] Choose / create householdId (your intended default: `household-los-jackia` or whatever you’re using)
  - [x] Save succeeds (SyncMeta persisted via `saveSyncMeta`)
- [x] After Setup → app routes into the main UI (Routing guard works)
- [x] App shows a “bootstrapping/loading” state while remote loads (no blank screen)
- [x] No crash if remote household doc does not exist yet (seed then push works)

#### B) Relaunch persistence (Device A)

- [x] Kill app, relaunch → it should NOT show Setup again
- [x] It should bootstrap automatically (ensureAnonAuth runs) and land in main UI

#### C) PIN flow

- [x] On first Setup completion, you are prompted to create a 4-digit PIN (or immediately after entering app)
- [x] App locks when backgrounded/killed (depending on your chosen policy)
- [x] Reopen → PIN required
- [x] Wrong PIN shows friendly error, does not crash, can retry
- [x] “Forgot PIN” or “Reset local” path exists (even if destructive)

#### D) Settings actions

- [x] Settings shows current:
  - [x] householdId
  - [x] userId (Los / Jackia)
  - [x] sync status indicator
- [x] “Switch user” works (writes syncMeta userId, reboots store safely)
- [x] “Reset local” clears local app state + sync meta (or whatever your policy is) and returns to Setup screen

#### E) Device B (Jackia) joins the same household

- [x] Fresh install on Device B → Setup screen appears
- [x] Choose user = Jackia, same householdId as Los
- [x] Bootstrap pulls remote successfully
- [x] Make a tiny change on Device A (add a manual tx)
- [x] Device B relaunch or Sync → sees the updated state (at least after a manual refresh / app reopen)
- [x] If permissions block: error is human-readable and points to next step (rules/auth), not a stack trace

### Blockers / Notes

- BLOCKED: Firestore permissions
  - Symptom: `permission-denied` on BatchGetDocuments for `households/{householdId}`
  - Fix path: confirm anon auth UID is present, then update Firestore rules to allow the signed-in user access to the household doc (MVP rules ok for now).
- If PIN is purely local: confirm it does not affect Firebase auth, only app access.
- If bootstrap is defined but never called: routing must call `engine.getState()` once on app load to trigger bootstrap path when syncMeta exists.

## Phase 14: Core UI flows (Manual transactions + envelopes + inbox + dashboard)

### Recommended build order (do not reorder unless blocked)

- [x] MS-14.10 MoneyInput helper
- [x] MS-14.1 Add Transaction (screen + wiring)
- [x] MS-14.2 Transactions list + empty state
- [x] MS-14.5 Envelopes list + empty state
- [x] MS-14.6 Create envelope (flow)
- [x] MS-14.3 Inbox list
- [x] MS-14.4 Assign flow (transaction -> envelope)
- [x] MS-14.7 Allocate flow (available -> envelope)
- [x] MS-14.8 Envelope detail (balance + activity)
- [x] MS-14.9 Dashboard (Available + quick actions + previews)
- [x] MS-14.12 Sync indicator (basic)
- [x] MS-14.11 Baseline polish (spacing/hierarchy)

### Phase 14 Smoke Check (must pass before Phase 15)

- [x] Add Income transaction -> account balance increases
- [x] Create envelope “Groceries”
- [x] Allocate funds to Groceries -> envelope balance increases and Available decreases
- [x] Add Expense transaction -> appears in Inbox as Unassigned
- [x] Assign Expense to Groceries -> Groceries balance goes down
- [x] App relaunch -> state persists

### Blockers / Notes

- (Add anything that blocks a ticket, e.g., auth/rules, navigation, missing component)
- Example:
  - BLOCKED: MS-14.12 - requires Sync status model from Phase 17 (workaround: show "Local-only")

---

## Phase 15: Plaid integration (Link + mapping + merge + refresh UX)

> NOTE: These are the planned ticket order for later reference.
> Keep them commented until you start Phase 15.

### Recommended build order

- [x] MS-15.1 Strategy decision
- [x] MS-15.2 Env + safety
- [x] MS-15.3 Connect screen
- [x] MS-15.4 Link flow
- [x] MS-15.5 Token exchange + secure storage
- [x] MS-15.8 Account mapping
- [x] MS-15.7 Transaction mapping
- [x] MS-15.9 Dedup merge
- [x] MS-15.6 Refresh UI + engine method
- [x] MS-15.10 Error UX
- [x] MS-15.11 Cost guardrails

### Phase 15 Smoke Check

- [x] Connect Plaid (Los)
- [x] Pull accounts -> map to domain accounts
- [x] Pull transactions -> merge without duplicates
- [x] Pull-to-refresh updates with no spam calls
- [x] App relaunch preserves token + mappings (secure storage)

---

## Phase 16: Input + UX polish (MoneyInput component + formatting + clarity)

### Recommended build order

- [x] MS-16.3 Parsing contract ({ ok, cents, error })
- [x] MS-16.1 MoneyInput component
- [x] MS-16.2 Formatting + tests
- [x] MS-16.4 Income/expense clarity
- [x] MS-16.5 Keyboard handling
- [x] MS-16.6 Empty state pass
- [x] MS-16.7 Envelope validation polish
- [x] MS-16.9 Manual checklist
- [x] MS-16.8 Quick actions (optional)
- [x] MS-16.10 Edit envelope name
- [x] MS-16.11 Delete envelope
- [x] MS-16.12 Transaction detail + optional note

### Phase 16 Smoke Check

- [x] Money input accepts "10", "10.5", "10.50", rejects invalid
- [x] Income vs expense is visually clear everywhere
- [x] Forms do not break when keyboard opens
- [x] Can edit an envelope name from envelope detail
- [x] Can delete an envelope (with confirmation)
- [x] Can view transaction detail and add/edit a note

---

## Phase 17: Sync UX (status model + retry/backoff + conflict messaging)

### Recommended build order

- [x] MS-17.1 Status model
- [x] MS-17.2 Indicator
- [x] MS-17.5 Pending changes
- [x] MS-17.3 Friendly errors
- [x] MS-17.4 Retry/backoff
- [x] MS-17.8 Debounce pushes
- [x] MS-17.6 Sync now button
- [x] MS-17.7 Conflict UX message
- [x] MS-17.9 Settings summary
- [x] MS-17.10 Two-device checklist

### Phase 17 Smoke Check

- [x] Offline edit -> shows pending
- [x] Online -> retries, then syncs
- [x] Conflict -> pulls remote and informs user

---

## Phase 18: UI polish + navigation (make it feel like a product)

### Recommended build order

- [x] MS-18.1 Tokens baseline
- [x] MS-18.2 Card + SectionHeader
- [x] MS-18.3 Navigation audit
- [x] MS-18.4 Dashboard pass
- [x] MS-18.5 Transactions pass
- [x] MS-18.6 Inbox pass
- [x] MS-18.7 Envelopes list + sorting
- [x] MS-18.8 Envelope detail pass
- [x] MS-18.9 Forms pass
- [x] MS-18.10 Toast feedback
- [x] MS-18.11 Accessibility
- [x] MS-18.12 Branding shell
- [x] MS-18.13 ScriptureStrip on Dashboard (daily rotating verse, compacted below hero card)
- [x] MS-18.17 Design Identity (warm palette tokens + DESIGN.md + Button component + token migration)
- [x] MS-18.14 GreetingCard on Dashboard (time-aware greeting + envelope health summary)
- [x] MS-18.15 DateGroupHeaders in Transactions (Today / Yesterday / date)
- [x] MS-18.16 ProgressBar on Envelope rows (balance / allocated, color-coded)

### Phase 18 Smoke Check

- [x] Navigation is predictable (tabs + modals)
- [x] All empty states look intentional
- [x] Assign + allocate flows feel fast
- [x] Dashboard shows scripture strip and greeting card
- [x] Transactions grouped by date
- [x] Envelope rows show spending progress bars

---

---

## Phase 19: Hardening + release readiness (migrations, backups, guardrails)

### Recommended build order

- [x] MS-19.5 Feature flags
- [x] MS-19.2 Crash-safe persistence
- [x] MS-19.1 Migrations scaffold
- [x] MS-19.8 Guardrails
- [x] MS-19.13 Seed Available to Assign from connected account balances (domain command)
- [x] MS-19.14 Post-connect onboarding: seed budget from bank balances (UI prompt)
- [x] MS-19.15 Accounts overview — display individual bank account balances
- [x] MS-19.16a Fix Plaid account balances — account type, balance initialization, cash vs debt (#129)
- [x] MS-19.14.1 Re-seed Available when additional accounts are connected (after 19.16a)
- [x] MS-19.16 Feedback & confirmation polish (enhanced toasts: assign, note save, user switch)
- [x] MS-19.17 Empty state & dead-end fixes (Inbox empty state, Allocate zero-balance)
- [x] MS-19.18 Overspend warnings & source indicators (Plaid badge, overspent badge, assign warning)
- [x] MS-19.6 Core tests
- [x] MS-19.3 Export
- [x] MS-19.4 Import
- [x] MS-19.7 Release checklist
- [x] MS-19.10 Install plan
- [x] MS-19.11 Security sanity
- [x] MS-19.9 Performance sanity
- [x] MS-19.12 Support bundle (optional)

### Phase 19 Smoke Check

- [ ] Export + import works
- [ ] App recovers from corrupted local state
- [ ] Feature flags can disable risky features cleanly
- [ ] Install plan works for Jackia

---

## Phase 23: Daily Use Essentials (budget periods, tx editing, transfers, giving)

> **Build order note:** Build Phase 23 immediately after Phase 19 and before Phase 20.
> Phases 20–22 depend on the foundations built here (budget periods, transaction corrections, envelope types).

### Recommended build order

#### Tier 1 — Transaction Corrections (unblock daily use)

- [x] MS-23.1 Unassign transaction (domain + engine + UI)
- [x] MS-23.2 Edit transaction description + amount (domain + engine + UI; Plaid txs: description only)
- [x] MS-23.3 Delete transaction (domain + engine + UI; Plaid txs: not deletable)

#### Tier 2 — Envelope Transfers

- [x] MS-23.4 Transfer between envelopes (domain + engine + new modal screen)

#### Tier 3 — Budget Periods + Envelope Goals

- [x] MS-23.5 Budget period model (domain: period bounds, spending-in-period, funding-in-period helpers)
- [x] MS-23.6 Envelope goal targets (activate goal field as monthly funding target + set/clear in UI)
- [x] MS-23.7 Period-aware dashboard ("This Month" summary card, per-envelope monthly spend)
- [x] MS-23.8 Envelope fill flow (paycheck → guided allocation screen with targets as guide)

#### Tier 4 — Stewardship Identity

- [x] MS-23.9 Giving envelope type (envelope type tag, giving-first sort, dashboard giving total)
- [x] MS-23.10 Period summary screen (monthly income/spending/giving/net breakdown)

#### Tier 5 — Safety & Polish

- [x] MS-23.11 Undo envelope delete (soft delete with undo toast, ~8s recovery window)
- [x] MS-23.12 Transaction search & filter in Transactions tab
- [x] MS-23.13 Transaction attribution — show who assigned/created each transaction
- [x] MS-23.14 In-app help tooltips for budgeting concepts
- [x] MS-23.15 UI micro-polish batch (real-time validation, placeholders, edit button, sort persistence, zero-balance styling, loading message)
- [x] MS-23.16 Sync UX improvements (prominent error indicator, Plaid timeout feedback)

### Architecture Notes

- Budget periods are monthly. Balances always roll over; goals/targets reset monthly.
- Sole breadwinner, biweekly paycheck: fill flow runs ~2× per month guided by monthly targets.
- `Envelope.goal` field already exists — MS-23.6 activates it, no model change needed.
- Transaction corrections (unassign/edit/delete) are domain-pure functions with engine wiring.
- Giving envelope uses new `type?: 'spending' | 'giving' | 'savings'` field on Envelope model.
- Plaid-synced transactions: description editable, amount locked, not deletable (they'd return on next sync).

### Phase 23 Smoke Check

- [x] Unassign a transaction → returns to inbox, envelope balance restored
- [x] Edit a manual transaction description → updates everywhere
- [x] Delete a manual transaction → removed, budget recalculated
- [x] Plaid transaction: can edit description but cannot delete or change amount
- [x] Transfer $50 from Groceries to Entertainment → both balances update
- [x] Set $500 monthly goal on Groceries → progress bar shows funding %
- [x] Dashboard shows "This Month" income/spending/net
- [x] Fill envelopes from paycheck → guided by targets, one-tap fill
- [x] Create a Giving envelope → appears first in envelope list
- [x] Period summary shows monthly breakdown by envelope

---

## Phase 20: Smart Assignment (suggest-then-confirm system)

### Recommended build order

#### Tier 1 — Foundation

- [x] MS-20.1 Payee normalization utility (pure function + tests)
- [x] MS-20.2 Payee-to-envelope mapping storage (AppStateV1 + auto-update on assign)
- [x] MS-20.3 suggestEnvelope() domain function (rules + payee fallback → suggestion or null)
- [x] MS-20.4 Suggestion badges in Inbox UI (show badge, tap to pre-select)

#### Tier 2 — Enhancement

- [x] MS-20.5 Assignment rules data model (contains/exact match, priority order)
- [x] MS-20.6 Rules management screen (Settings → add/edit/delete/reorder rules)

#### Tier 3 — Power Features

- [x] MS-20.7 "Confirm All Suggestions" bulk action (assign all suggested in one tap)
- [x] MS-20.8 Recurring transaction detection (same payee + similar amount + regular interval)

### Architecture Notes

- `suggestEnvelope()` is a pure function in `packages/domain` — no infra deps
- Rules evaluate in priority order: explicit rules first, then payee memorization fallback
- Nothing auto-assigns — all suggestions require user confirmation
- `assignedByUserId` audit trail preserved (system suggestions still show who confirmed)

### Phase 20 Smoke Check

- [x] Assign a transaction → payee remembered for next time
- [x] New transaction from same payee → suggestion badge appears in Inbox
- [x] Tap suggestion → pre-selects envelope in assign flow
- [x] Create a rule → overrides payee memorization
- [x] "Confirm All" assigns multiple suggestions in one tap

---

## Phase 21: Debt Freedom Tools (BNPL tracking + snowball method)

### Recommended build order

- [x] MS-21.1 Envelope "target" field (budget amount / payoff goal)
- [x] MS-21.2 Envelope "type" tag (spending / debt / savings)
- [x] MS-21.3 Debt overview screen (list all debts, sorted by snowball order)
- [x] MS-21.4 Snowball calculator (payoff order, timeline, interest savings)
- [x] MS-21.5 Debt payoff progress visualization (bar/ring per debt)
- [ ] MS-21.6 BNPL transaction detection hint (badge on BNPL merchant transactions)

### Phase 21 Smoke Check

- [ ] Create debt-tagged envelope with target amount
- [ ] Debt overview shows all debts sorted by balance
- [ ] Snowball calculator shows payoff timeline
- [ ] Progress visualization updates as payments are made
- [ ] BNPL badge appears on Affirm/Klarna/etc. transactions

---

## Phase 22: Insights & Visuals (charts, trends, advisor voice)

<!--
### Recommended build order
- [ ] MS-22.1 Charting library setup (victory-native or react-native-chart-kit)
- [ ] MS-22.2 Spending by envelope pie/donut chart
- [ ] MS-22.3 PeriodSummaryCard (income vs expense vs net — legacy wireframe §1)
- [ ] MS-22.4 Income vs Expense trend bar chart (3-6 months)
- [ ] MS-22.5 Rule-based insights engine (pattern matching, no AI)
- [ ] MS-22.6 InsightCard component + placement ("Money Shepherd says...")

### Phase 22 Smoke Check
- [ ] Pie chart shows spending breakdown by envelope
- [ ] Period summary card shows income/expense/net
- [ ] Trend chart shows monthly trajectory
- [ ] At least one insight appears on Dashboard
- [ ] Insights are dismissable
-->

---
