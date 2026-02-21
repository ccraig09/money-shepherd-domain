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
- [ ] MS-16.9 Manual checklist
- [ ] MS-16.8 Quick actions (optional)

### Phase 16 Smoke Check

- [ ] Money input accepts "10", "10.5", "10.50", rejects invalid
- [ ] Income vs expense is visually clear everywhere
- [ ] Forms do not break when keyboard opens

---

## Phase 17: Sync UX (status model + retry/backoff + conflict messaging)

<!--
### Recommended build order
- [ ] MS-17.1 Status model
- [ ] MS-17.2 Indicator
- [ ] MS-17.5 Pending changes
- [ ] MS-17.3 Friendly errors
- [ ] MS-17.4 Retry/backoff
- [ ] MS-17.8 Debounce pushes
- [ ] MS-17.6 Sync now button
- [ ] MS-17.7 Conflict UX message
- [ ] MS-17.9 Settings summary
- [ ] MS-17.10 Two-device checklist

### Phase 17 Smoke Check
- [ ] Offline edit -> shows pending
- [ ] Online -> retries, then syncs
- [ ] Conflict -> pulls remote and informs user
-->

---

## Phase 18: UI polish + navigation (make it feel like a product)

<!--
### Recommended build order
- [ ] MS-18.1 Tokens baseline
- [ ] MS-18.2 Card + SectionHeader
- [ ] MS-18.3 Navigation audit
- [ ] MS-18.4 Dashboard pass
- [ ] MS-18.5 Transactions pass
- [ ] MS-18.6 Inbox pass
- [ ] MS-18.7 Envelopes list + sorting
- [ ] MS-18.8 Envelope detail pass
- [ ] MS-18.9 Forms pass
- [ ] MS-18.10 Toast feedback
- [ ] MS-18.11 Accessibility
- [ ] MS-18.12 Branding shell

### Phase 18 Smoke Check
- [ ] Navigation is predictable (tabs + modals)
- [ ] All empty states look intentional
- [ ] Assign + allocate flows feel fast
-->

---

## Phase 19: Hardening + release readiness (migrations, backups, guardrails)

<!--
### Recommended build order
- [ ] MS-19.5 Feature flags
- [ ] MS-19.2 Crash-safe persistence
- [ ] MS-19.1 Migrations scaffold
- [ ] MS-19.8 Guardrails
- [ ] MS-19.6 Core tests
- [ ] MS-19.3 Export
- [ ] MS-19.4 Import
- [ ] MS-19.7 Release checklist
- [ ] MS-19.10 Install plan
- [ ] MS-19.11 Security sanity
- [ ] MS-19.9 Performance sanity
- [ ] MS-19.12 Support bundle (optional)

### Phase 19 Smoke Check
- [ ] Export + import works
- [ ] App recovers from corrupted local state
- [ ] Feature flags can disable risky features cleanly
- [ ] Install plan works for Jackia
-->
