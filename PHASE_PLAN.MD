# PHASE_PLAN.md

# PHASE_PLAN.md (STRUCTURE UPDATE)

# Foundations vs Product Evolution + Tracks

## How this plan is organized (Foundations vs Product Evolution)

This project has two layers of work:

### A) [FOUNDATION] Work (must be stable before building features)

These phases establish the non-negotiables:

- Monorepo/tooling
- Domain model + core rules (Money, envelopes, assignments)
- Engine + recompute
- Local persistence (offline-first)
- Sync plumbing (Firebase auth/rules + push/pull + conflict strategy)
- Onboarding (Setup + PIN)

**Rule:** Do not start [EVOLUTION] work until the [FOUNDATION] smoke checks are green.

### B) [EVOLUTION] Work (features, polish, expansion)

These phases grow the product after it is usable:

- Better UX and input handling
- Plaid integration and banking UX
- Sync confidence indicators + retries
- UI polish, identity, design system work
- Daily-use power features (editing, transfers, periods, goals)
- Insights, rules, debt tools, dark mode, biometrics
- Compliance, production hardening, AI advisor

**Rule:** [EVOLUTION] can be reordered by dependency and value, but keep each “track” cohesive.

---

## Tracks (recommended for large roadmaps)

Once foundations are complete, group work into tracks. Tracks can contain multiple phases.

Suggested tracks for Money Shepherd:

- **Track A: Core MVP** (Phase 14–19)
- **Track B: Daily Use Essentials** (Phase 23)
- **Track C: Smart Assignment** (Phase 20)
- **Track D: Debt Freedom** (Phase 21)
- **Track E: Insights & Visuals** (Phase 22)
- **Track F: Security & Access** (Phase 24, 26)
- **Track G: Banking Production + Compliance** (Phase 27, 27.5)
- **Track H: AI Advisor** (Phase 28–30)

---

## How to tag each phase

Add one of these tags to every phase heading:

- **[FOUNDATION]** = required for reliability + usability
- **[EVOLUTION]** = product features / polish / roadmap expansion

Optional sub-tag:

- **[EVOLUTION | Track X]** = an evolution phase belonging to a track

---

## Recommended header edits (apply to your existing phases)

### Foundations

- `## Phase 0–12 [FOUNDATION]: Repo + Domain + Engine + Storage + Sync Plumbing` (if you add the missing early phases)
- `## Phase 13 [FOUNDATION]: Setup + PIN + Bootstrap (Two-device foundation)`

### Evolution (with tracks)

- `## Phase 14 [EVOLUTION | Track A: Core MVP]: Core UI flows`
- `## Phase 15 [EVOLUTION | Track A: Core MVP]: Plaid integration`
- `## Phase 16 [EVOLUTION | Track A: Core MVP]: Input + UX polish`
- `## Phase 17 [EVOLUTION | Track A: Core MVP]: Sync UX`
- `## Phase 18 [EVOLUTION | Track A: Core MVP]: UI polish + navigation`
- `## Phase 19 [EVOLUTION | Track A: Core MVP]: Hardening + release readiness`

- `## Phase 23 [EVOLUTION | Track B: Daily Use Essentials]: Daily Use Essentials`
- `## Phase 20 [EVOLUTION | Track C: Smart Assignment]: Smart Assignment`
- `## Phase 21 [EVOLUTION | Track D: Debt Freedom]: Debt Freedom Tools`
- `## Phase 22 [EVOLUTION | Track E: Insights & Visuals]: Insights & Visuals`

- `## Phase 24 [EVOLUTION | Track F: Security & Access]: Biometric Login`
- `## Phase 25 [EVOLUTION | Track A or F]: Envelope Groups` (your call; most teams treat this as UX structure)
- `## Phase 26 [EVOLUTION | Track F: Security & Access]: Dark Mode`

- `## Phase 27 [EVOLUTION | Track G: Banking Production + Compliance]: Production Plaid & Real Banking`
- `## Phase 27.5 [EVOLUTION | Track G: Banking Production + Compliance]: Plaid Compliance & Policies`

- `## Phase 28 [EVOLUTION | Track H: AI Advisor]: AI Advisor — Foundation + Guided Setup`
- `## Phase 29 [EVOLUTION | Track H: AI Advisor]: AI Advisor — Ongoing Intelligence`
- `## Phase 30 [EVOLUTION | Track H: AI Advisor]: AI Advisor — Conversational`
- `## Phase 31 [POLISH]: Polish & Cleanup`

---

## Optional (highly recommended): add these to every phase

### Foundation impact (why this matters)

- Dependencies (what must already be green)
- What it strengthens (reliability, correctness, security, UX)

### Product impact (what user gets)

- What Los/Jackia can do after this phase
- What “done” looks like in the UI

Template:

### Foundation impact

- Depends on:
- Strengthens:

### Product impact

- Enables:
- Visible outcome:

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
- [x] MS-19.14.2 Fix seed budget double-counting — income added on top of seeded bank balances (#165)
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

- [x] Export + import works
- [x] App recovers from corrupted local state
- [x] Feature flags can disable risky features cleanly
- [x] Install plan works for Jackia

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
- [x] MS-21.6 BNPL transaction detection hint (badge on BNPL merchant transactions)

### Phase 21 Smoke Check

- [x] Create debt-tagged envelope with target amount
- [x] Debt overview shows all debts sorted by balance
- [x] Snowball calculator shows payoff timeline
- [x] Progress visualization updates as payments are made
- [x] BNPL badge appears on Affirm/Klarna/etc. transactions

---

## Phase 22: Insights & Visuals (charts, trends, advisor voice)

### Recommended build order

- [x] MS-22.1 Charting library setup (victory-native or react-native-svg custom)
- [x] MS-22.2 Spending by envelope pie/donut chart
- [x] MS-22.3 PeriodSummaryCard visual upgrade (mini chart enhancement for existing This Month card)
- [x] MS-22.4 Income vs Expense trend bar chart (3-6 months)
- [x] MS-22.5 Rule-based insights engine (pattern matching, no AI)
- [x] MS-22.6 InsightCard component + placement ("Money Shepherd says...")

### Phase 22 Smoke Check

- [x] Pie chart shows spending breakdown by envelope
- [x] Period summary card shows income/expense/net
- [x] Trend chart shows monthly trajectory
- [x] At least one insight appears on Dashboard
- [x] Insights are dismissable

---

## Phase 24: Biometric Login (Face ID / Touch ID)

### Recommended build order

- [x] MS-23.1 Add expo-local-authentication (install, helper module, iOS config)
- [x] MS-23.2 Biometric unlock flow (auto-prompt on unlock screen, PIN fallback)
- [x] MS-23.3 Biometric opt-in during setup (offer after PIN creation)
- [x] MS-23.4 Settings toggle for biometric (enable/disable in settings)

### Phase 24 Smoke Check

- [x] Face ID / Touch ID prompts on app unlock
- [x] Failed biometric falls back to PIN
- [x] Biometric can be toggled on/off in settings

---

## Phase 25: Envelope Groups (collapsible categories)

### Recommended build order

- [x] MS-25.1 Domain: EnvelopeGroup model + grouping logic
- [x] MS-25.2 Engine/commands: create, rename, delete, reorder groups
- [x] MS-25.3 Envelopes tab: collapsible group sections
- [x] MS-25.4 Create/edit envelope: group picker
- [x] MS-25.5 Dashboard: grouped envelope preview

### Phase 25 Smoke Check

- [x] Groups appear as collapsible sections on Envelopes tab
- [x] Can create, rename, delete a group
- [x] Envelopes can be moved between groups
- [x] Dashboard shows grouped preview

---

## Phase 26: Dark Mode (full theme system)

### Recommended build order

- [x] MS-26.1 Theme system: light/dark token sets + ThemeProvider
- [x] MS-26.2 Migrate screens to theme context (replace static Color imports)
- [x] MS-26.3 Settings: theme toggle (Light / Dark / System)
- [x] MS-26.4 Charts + custom components: dark-aware colors
- [x] MS-26.5 Dark mode polish: shadows, borders, status bar, splash

### Phase 26 Smoke Check

- [x] Dark mode renders correctly on all screens
- [x] Theme toggle works in settings (Light / Dark / System)
- [x] Charts readable in dark mode
- [x] No white flash on navigation transitions
- [x] Status bar adapts to theme

---

## Phase 27: Production Plaid & Real Banking

> **Build order note:** Do this phase last — after biometric, envelope groups, and dark mode are polished. This is the "go live" moment.

### Recommended build order

- [x] MS-24.1 Migrate Plaid tokens to SecureStore (encrypted at rest)
- [x] MS-24.2 Production Plaid environment config (switch from sandbox, update Cloud Functions)
- [ ] MS-24.3 Production Plaid Link integration test (connect real bank, verify sync)
- [ ] MS-24.4 Multi-user bank onboarding documentation (how both users connect)

### Phase 27 Smoke Check

- [x] Plaid tokens stored in SecureStore (not AsyncStorage)
- [x] Real bank connected via production Plaid Link
- [x] Transactions from real bank sync into app
- [ ] Both household members can connect their own banks

---

## Phase 27.5: Plaid Compliance & Policies

> **Goal:** Complete Plaid's 12 required compliance attestations (due 09/01/2026), publish privacy policy online, create security policy documents, and implement Plaid best-practice code changes. See `docs/plans/2026-02-27-plaid-compliance-design.md` for full design.

### Recommended build order

#### Tier 1 — Dashboard & Public Presence

- [x] MS-27.5.1 GitHub Pages site (privacy policy + landing page, set Website URL in Plaid App Profile)
- [x] MS-27.5.2 Verify 2FA on all internal services (GitHub, Firebase, Plaid, Apple Developer)
- [x] MS-27.5.3 App icon for Plaid dashboard (create/upload 1024x1024 PNG)

#### Tier 2 — Policy Documents

- [x] MS-27.5.4 Information Security Policy (data handling, encryption, incident response)
- [x] MS-27.5.5 Access Control & Identity Management Policy (access grants/revokes, review cadence)
- [x] MS-27.5.6 Vulnerability Management Policy (scanning, patching SLA, EOL monitoring, zero trust)

#### Tier 3 — Code Changes

- [x] MS-27.5.7 `/item/remove` Cloud Function (revoke Plaid access when user disconnects bank)
- [x] MS-27.5.8 Consent dialog before Plaid Link (data sharing explanation + privacy policy link)
- [x] MS-27.5.9 In-app privacy & data policy screen (Settings → Privacy & Data)
- [x] MS-27.5.10 Plaid Link `onEvent` logging (capture link_session_id + events for debugging)

#### Tier 4 — Attest on Dashboard

- [x] MS-27.5.11 Check off all 12 attestations on Plaid Compliance Center

### Phase 27.5 Smoke Check

- [x] Privacy policy accessible at public URL
- [x] Website URL set in Plaid App Profile (no more "1" badge)
- [x] ISP, Access Control, and Vulnerability Management policies in repo
- [x] Disconnect bank → Plaid item removed server-side
- [x] Consent dialog shown before Plaid Link opens
- [x] Privacy & Data screen accessible from Settings
- [x] All 12 attestations checked off in Plaid dashboard

---

## Phase 27.6: Multi-Device Account Merge Fix

> **Goal:** When two household members connect banks on separate devices, both sets of accounts must be preserved in the shared state. Currently the second device overwrites the first's accounts because `importPlaidAccounts` merges against stale local state instead of pulling the latest cloud state first.

### Root Cause

`engine.importPlaidAccounts()` calls `getState()` which returns the local AsyncStorage cache. If Device B hasn't synced since Device A connected, Device B's local state doesn't contain Device A's accounts. The merge adds only Device B's accounts, and `recompute()` pushes that to Firestore — overwriting Device A's data.

### Fix

Pull the latest Firestore state inside `importPlaidAccounts` before merging, so both devices' accounts are included in the merge base.

### Recommended build order

- [x] MS-27.6.1 Pull latest cloud state before importing Plaid accounts (engine.ts `importPlaidAccounts`)
- [ ] MS-27.6.2 Verify fix with both-users-connect scenario (manual test)

### Phase 27.6 Smoke Check

- [x] Los connects bank on Device A → state syncs to Firestore
- [ ] Jackia connects bank on Device B → both Los's and Jackia's accounts preserved
- [ ] Budget totals reflect all household accounts combined

---

## Phase 27.7: Cross-Device Plaid Connection Visibility

> **Goal:** When one household member connects a bank on their device, the other device should see that the bank is connected — without syncing the sensitive access token. A lightweight "connection manifest" is written to Firestore so both devices know which banks are linked for each user.

### Background

Plaid access tokens are stored in `expo-secure-store` (device keychain) and never leave the device. This means the partner's device shows "Not connected" even though banks are connected on the other phone. This phase syncs a metadata flag (no secrets) so the UI is accurate on both devices.

### Recommended build order

- [x] MS-27.7.1 Firestore connection manifest — write `plaidConnections/{itemId}` doc on connect (userId, institutionName, accountIds, connectedAt, active flag)
- [x] MS-27.7.2 Read connection manifest — connect-accounts screen reads Firestore flags to determine "Connected" status (fall back to local tokens for "can sync" ability)
- [x] MS-27.7.3 Disconnect sync — set `active: false` in Firestore when a bank is disconnected locally
- [x] MS-27.7.4 UI distinction — differentiate "connected on this device" (can sync) vs "connected on another device" (read-only indicator)

### Architecture Notes

- **No secrets cross the wire** — access tokens remain in local `SecureStore`; only institution name, account IDs, and a boolean flag sync via Firestore
- `isLocallyConnected` (has token in SecureStore) vs `isRemotelyConnected` (Firestore flag) drives UI differences
- Fits under existing `budgets/{budgetId}/` Firestore path
- Disconnect must update both local `SecureStore` AND Firestore flag

### Phase 27.7 Smoke Check

- [x] Connect bank on Device A → Device B shows bank as "Connected" (without local token)
- [x] Device B cannot trigger transaction sync for Device A's bank (no local token)
- [x] Disconnect on Device A → Device B shows "Not connected"

---

## Phase 27.8 [EVOLUTION | Track G]: Multi-Device Data Integrity, Plaid Hardening & Account UX

> **Goal:** Fix balance mismatches, dedup accounts, persist Plaid sync cursors, handle pending transactions, add ownership tracking, grouped account display, connection manifest, and auto-sync. Final comprehensive Plaid phase.

### Recommended build order

#### Tier 1 — Data Integrity

- [x] MS-27.8.1 Add `ownerUserId` + `institutionName` to Account model (+ backfill on refresh)
- [x] MS-27.8.2 Fix balance mismatch: selective merge + real-time balances
- [x] MS-27.8.3 Dedup existing duplicate accounts

#### Tier 2 — Plaid Hardening

- [x] MS-27.8.4 Persist Plaid sync cursor + handle pending transaction lifecycle
- [x] MS-27.8.4.1 Fix pagination regression — cap initial sync + within-batch dedup
- [x] MS-27.8.5 Pending transaction UI + transaction removal handling

#### Tier 3 — Sync Reliability

- [x] MS-27.8.6 Auto-sync on foreground + pull-to-refresh on Dashboard

#### Tier 4 — UX Improvements

- [x] MS-27.8.7 Group accounts by owner + collapsible sections
- [x] MS-27.8.10 Connection manifest (absorbed Phase 27.7)

> **Deferred to future:** MS-27.8.8 (Cash Wallets), MS-27.8.9 (Cross-device refresh awareness)

### Phase 27.8 Smoke Check

- [x] Both devices show same balances after sync
- [x] No duplicate accounts
- [x] Pending transactions visible with badge
- [x] Accounts grouped by owner (Los / Jackia)
- [x] Partner's connected banks visible on Connect Accounts screen
- [x] Auto-sync on app foreground

---

## Phase 28: AI Advisor — Foundation + Guided Setup

> **Goal:** After connecting a bank, AI analyzes spending, auto-creates envelopes, sets budgets, and categorizes transactions — all with user preview/confirm. Uses Claude Sonnet 4.6 (Anthropic) via Cloud Functions. $7/month budget cap with 75% warning + full usage monitoring.

### Recommended build order

- [x] MS-28.2 Context builder (AppState → AI summary, pure function + tests)
- [x] MS-28.1 Claude Cloud Function setup (Anthropic SDK, secrets, system prompt)
- [x] MS-28.1b API usage monitoring + cost controls ($7/mo cap, 75% warning, rate limits, Settings UI)
- [x] MS-28.3 Spending analysis Cloud Function (suggest envelopes + budgets, max 7)
- [x] MS-28.4 Guided setup wizard UI (preview + one-tap create envelopes)
- [x] MS-28.5 Auto-allocate suggestions (preview + one-tap allocate)
- [x] MS-28.6 AI auto-categorization Cloud Function (merchant → envelope mapping, batch 20)
- [x] MS-28.7 Integrate AI categorization into suggestEnvelope hierarchy
- [x] MS-28.8 Auto-assign preview + bulk confirm in Inbox

### Architecture Notes

- LLM: Claude Sonnet 4.6 (all tasks) via Firebase Cloud Functions + `@anthropic-ai/sdk`
- API key in Firebase secrets (same pattern as Plaid): `ANTHROPIC_API_KEY`
- All AI actions: Preview → Confirm → Engine execute (no silent mutations)
- Cached payee categorizations in AppState `aiPayeeMappings` field
- AI tier slots into suggestEnvelope hierarchy: rules > AI > recurring > payee
- System prompt versioned in code — no runtime training needed
- Guardrails: $7/mo hard cap, 75% warning (~$5.25), 20 calls/day rate limit, 4K token cap, no PII sent
- Usage monitoring: Firestore log, per-function breakdown, Settings UI dashboard with budget bar
- Feature flags: `AI_ADVISOR`
- Auto-deploy Cloud Functions after each function ticket

### Phase 28 Smoke Check

- [x] Connect bank → "Set Up Your Budget" wizard appears
- [x] AI suggests envelopes based on real spending (giving first, max 7)
- [x] Can edit/remove suggestions before creating
- [x] One-tap creates all selected envelopes with goals
- [x] AI suggests allocation → preview → one-tap allocate
- [x] New transactions from unknown merchants get AI-categorized (✦ AI Categorize button works)
- [x] AI suggestions appear in Inbox with sparkle badge + "Confirm All" (MS-28.8)
- [x] Rate limit prevents excessive API calls (20/day)
- [x] Settings shows AI usage stats (calls, tokens, cost, budget bar with 75% warning)
- [x] 75% budget warning shows amber toast + Settings indicator
- [x] $7 hard cap blocks further AI calls with clear message

---

## Phase 29: AI Advisor — Ongoing Intelligence

> **Goal:** Monthly/weekly spending reviews, budget adjustment suggestions, enhanced dashboard insights, anomaly alerts, and cash flow forecasting.

### Recommended build order

- [x] MS-29.1 Monthly review Cloud Function (spending summary + month-over-month deltas + adjustment suggestions)
- [x] MS-29.2 Budget adjustment UI (monthly review card + one-tap adjust)
- [x] MS-29.3 AI-enhanced insights (blend AI + rule-based on dashboard)
- [x] MS-29.4 Spending anomaly alerts (unusual charges, spending spikes)
- [x] MS-29.5 Weekly spending nudge (lightweight Home card — top categories, envelope balances, no Cloud Function needed)
- [x] MS-29.6 Cash flow forecast card (projected month-end balance from recurring income − bills − average discretionary)

### Architecture Notes

- MS-29.1 prompt must include month-over-month comparisons ("Dining up 30% vs last month")
- MS-29.5 runs client-side from existing AppState — no AI call needed, just smart aggregation
- MS-29.6 uses transaction recurrence patterns already in state — lightweight projection, not a Cloud Function

### Phase 29 Smoke Check

- [x] Start of month → monthly review card appears on dashboard
- [x] Review shows per-envelope highlights (over/under budget) with month-over-month deltas
- [x] Budget adjustments can be previewed and applied in one tap
- [x] AI insights blend with rule-based insights on dashboard
- [x] Unusual spending triggers an alert
- [x] Weekly nudge card appears on Home (top spend categories this week)
- [x] Cash flow forecast shows projected month-end balance

---

## Phase 30: AI Advisor — Conversational

> **Goal:** Chat interface where users ask financial questions and the AI can suggest + execute budget actions, with full conversation history.

### Recommended build order

- [x] MS-30.1 Chat UI component (bubbles, markdown, action cards, suggested question chips on empty state)
- [x] MS-30.2 Conversational Cloud Function (multi-turn, budget-aware system prompt)
- [x] MS-30.3 Action execution from chat (preview → confirm → engine — envelopes, transfers, goals, budget adjustments)
- [x] MS-30.4 Chat session persistence + history (multi-session storage, auto-title, 24h resume)
- [x] MS-30.5 Chat history list UI (past conversations, read-only view, swipe to delete)
- [x] MS-30.6 TTS player for AI chat responses (play/pause/rewind/skip, expo-speech)
- [x] MS-30.7 Chat markdown rendering + emoji support in ChatBubble (react-native-markdown-display)
- [x] MS-30.8 Floating TTS control bar — persistent bottom bar (above input) showing now-playing message + prev/pause/next, replaces inline bubble controls
- [x] MS-30.9 Voice picker in Settings — list available voices via Speech.getAvailableVoicesAsync(), persist selection, default to enhanced/Siri voice on iOS
- [x] MS-30.10 Follow-up chip suggestions after action execution (context-aware quick actions)
- [x] MS-30.11 Multi-step action workflows — chain related actions in one conversation turn (e.g. create envelope + set goal + allocate)

### Architecture Notes

- **Shepherd personality (critical):** The AI voice is a warm, encouraging friend — not a pastor or theologian. Faith is a gentle undertone, not the main event. Think occasional stewardship wisdom ("you're managing what you've been given well"), a rare scripture reference when it fits naturally, and zero guilt/prescriptive religious language. Never preachy. The vibe is "wise friend who happens to be faith-informed."
- **Giving philosophy:** The app never prescribes a tithe percentage or nudges users toward a giving target. Giving is from the heart — the envelope is purely for tracking what you chose to give (cash, Venmo, extra payment). No "you should give 10%" messaging anywhere. If a user asks about giving, the AI acknowledges it as a personal decision and offers to help track it, nothing more.
- MS-30.1 empty state shows 3-4 suggested question chips: "How am I doing this month?", "Can I afford…?", "What should I adjust?", "Explain my spending"
- MS-30.3 action vocabulary: create envelope, move money between envelopes, set/adjust goals, adjust budget amounts, explain spending trends
- MS-30.2 system prompt must encode the shepherd personality above — warm, concise, actionable, faith-as-undertone

### Phase 30 Smoke Check

- [x] Tap "Ask Money Shepherd" → chat screen opens with suggested question chips
- [x] Ask "How am I doing this month?" → get spending summary response (warm, concise tone)
- [x] Ask "Create a Vacation savings envelope for $2000" → action card appears → confirm → envelope created
- [x] Ask "Move $50 from Dining to Groceries" → transfer action card → confirm → balances update
- [x] Ask "Set a $500 goal on my Emergency Fund" → goal action card → confirm → goal set
- [x] Chat persists across app relaunches (within 24h)
- [x] Start new conversation → old one appears in history list
- [x] Tap old conversation → view past messages (read-only)
- [x] AI unavailable → graceful error message, no crash
- [x] TTS toggle in Settings → player controls on chat bubbles → play/pause/rewind/skip work
- [x] AI tone is warm and encouraging, not preachy or overly religious

---

## Phase 31: Polish & Cleanup

> **Goal:** Fix visible bugs, remove stale data, and add UX polish that makes the app feel tight and trustworthy.

### Recommended build order

- [x] MS-31.1 Fix account name lookup — show bank names instead of raw Plaid IDs (#130)
- [x] MS-31.2 Remove disconnected/stale accounts — sandbox cleanup + account management UI (#167)
- [x] MS-31.3 Sticky date headers in Transactions list (#166)
- [x] MS-31.4 Available to Assign explainer — tap to see breakdown modal (#168)
- [x] MS-31.5 Forecast card info hints — tap (i) icons for calculation explainers (#178)
- [x] MS-31.6 Improve remaining spend projection — exclude one-time large purchases from daily pace (#179)
- [x] MS-31.7 Dual-purpose debt assignment — expenses assigned to debt envelopes count as payments (#131)
- [x] MS-31.8 Replace plain MS text icon with branded logo/symbol (#180)

### Phase 31 Smoke Check

- [x] Inbox and Transactions show bank account names (not Plaid IDs)
- [x] Settings allows removing stale/sandbox accounts
- [x] Transactions list has sticky date section headers
- [x] Tapping Available to Assign shows breakdown modal
- [x] Forecast card (i) icons show calculation explanations
- [x] Large one-time purchases don't inflate remaining spend projection
- [x] Assigning expense to debt envelope counts as payment
- [x] Chat and typing indicators show branded icon (not plain "MS" text)

---

## Phase 32: UI Polish & Navigation Redesign

> **Goal:** Make Money Shepherd visually competitive with modern fintech apps (YNAB, Copilot, Monarch) — warm-premium look, floating pill tab bar, streamlined navigation, celebration moments.
> **Design spec:** `docs/superpowers/specs/2026-03-12-ui-polish-design.md`

### Phase A: Foundational Component Upgrades
**Plan:** `docs/superpowers/plans/2026-03-13-ui-polish-phase-a.md`

- [x] MS-32.1 Update design tokens for UI polish (#190)
- [x] MS-32.2 Upgrade Button to pill shape with press animation (#191)
- [x] MS-32.3 Upgrade Card with shadow, warm bg, hero variant (#192)
- [x] MS-32.4 Upgrade ProgressBar with 6px height, animation, glow (#193)
- [x] MS-32.5 Refine SectionHeader with tighter size and wider tracking (#194)
- [x] MS-32.6 Add FilterChip component (#195)
- [x] MS-32.7 Refine SuggestedChips with gold outline style (#196)
- [x] MS-32.8 Phase A final verification and smoke test (#197)

### Phase B: Tab Bar + Navigation Wiring _(plan TBD)_

- [x] MS-32.B1 Build custom floating pill tab bar component (#198)
- [x] MS-32.B2 Build TopBar component — logo, inbox badge, profile avatar (#199)
- [x] MS-32.B3 Build FAB component — gold sparkle button (#200)
- [x] MS-32.B4 Restructure tab layout from 5 tabs to 4 (#201)
- [x] MS-32.B5 Inbox as modal/sheet from top bar (#202)
- [x] MS-32.B6 Phase B verification and smoke test (#203)

### Phase C: Home Screen Redesign _(plan TBD)_

- [x] MS-32.C1 Remove analytics cards from Home screen (#204)
- [x] MS-32.C2 Redesign hero card with 3 states (#205)
- [ ] MS-32.C3 Add quick stats row — Income | Spent | Net (#206)
- [ ] MS-32.C4 Reorder and polish remaining Home sections (#207)
- [ ] MS-32.C5 Phase C verification and smoke test (#208)

### Phase D: Envelopes Screen _(plan TBD)_

- [ ] MS-32.D1 Card-based envelope rows with amount badge (#209)
- [ ] MS-32.D2 Gradient progress bars with glow (#210)
- [ ] MS-32.D3 Collapsible group headers with chevron (#211)
- [ ] MS-32.D4 Goal celebration confetti on 100% (#212)
- [ ] MS-32.D5 Phase D verification and smoke test (#213)

### Phase E: Activity Screen _(plan TBD)_

- [ ] MS-32.E1 Rename Transactions to Activity (#214)
- [ ] MS-32.E2 Filter chips row (#215)
- [ ] MS-32.E3 Month picker and envelope name on rows (#216)
- [ ] MS-32.E4 Phase E verification and smoke test (#217)

### Phase F: Insights Tab (new) _(plan TBD)_

- [ ] MS-32.F1 Create Insights tab screen scaffold (#218)
- [ ] MS-32.F2 Fix spending donut and move analytics cards (#219)
- [ ] MS-32.F3 Weekly nudge and debt progress on Insights (#220)
- [ ] MS-32.F4 Cash flow forecast on Insights (#221)
- [ ] MS-32.F5 Phase F verification and smoke test (#222)

### Phase G: Chat Screen (FAB modal) _(plan TBD)_

- [ ] MS-32.G1 Full-screen modal with spring animation (#223)
- [ ] MS-32.G2 Chat history icon in header (#224)
- [ ] MS-32.G3 Animated gold dots typing indicator (#225)
- [ ] MS-32.G4 Phase G verification and smoke test (#226)

### Phase H: Celebrations + Animations _(plan TBD)_

- [ ] MS-32.H1 Confetti animation utility (#227)
- [ ] MS-32.H2 Envelope goal reached celebration (#228)
- [ ] MS-32.H3 Inbox cleared celebration (#229)
- [ ] MS-32.H4 Debt paid off and first budget celebrations (#230)
- [ ] MS-32.H5 Phase H verification and smoke test (#231)

### Phase 32 Smoke Check (Phase A)
- [x] Buttons are pill-shaped with press animation across all screens
- [x] Cards have warm shadow and rounded corners (18px)
- [x] Progress bars are 6px with animated entrance and gold/green color
- [x] Section headers are refined (smaller, wider tracking)
- [x] No visual regressions on any existing screen

---

## Future UX Backlog (unscheduled)

- [ ] Subscription intelligence (detect new/unused/price-changed recurring charges)
- [ ] Proactive chat nudges (shepherd checks in on overspending patterns via chat)

---

<!--
## Phase 0: Repo + Monorepo baseline (workspace + tooling)

### Recommended build order (do not reorder unless blocked)
- [ ] MS-0.1 Initialize repo + workspace layout (`packages/domain`, `apps/mobile`, `docs/`)
- [ ] MS-0.2 Root package scripts (install, test, lint, dev:mobile)
- [ ] MS-0.3 TypeScript baseline (root tsconfig + package tsconfigs)
- [ ] MS-0.4 Linting/formatting baseline (ESLint/Prettier) + consistent scripts
- [ ] MS-0.5 Git hygiene: root `.gitignore` + env file strategy (`apps/mobile/.env*` ignored)

### Phase 0 Smoke Check
- [ ] `npm install` works at repo root
- [ ] `npm test` runs (even if minimal / placeholder)
- [ ] `npm run dev:mobile` boots Expo or at least starts without errors

### Blockers / Notes
- Workspace protocol (“workspace:*”) requires npm workspaces or equivalent configured correctly.

---

## Phase 1: Domain package scaffolding (pure logic)

### Recommended build order
- [ ] MS-1.1 Create domain package entrypoints + exports (`packages/domain/src/index.ts`)
- [ ] MS-1.2 Money value object (cents-only) + tests
- [ ] MS-1.3 Account + Transaction models (minimal fields) + tests
- [ ] MS-1.4 Budget + Envelope models (minimal fields)

### Phase 1 Smoke Check
- [ ] Domain tests pass
- [ ] Domain package can be imported from mobile (`@money-shepherd/domain`) without TS errors

---

## Phase 2: Core domain behavior (ledger + inbox + budget logic)

### Recommended build order
- [ ] MS-2.1 Apply transactions to accounts (ledger) + tests (idempotent)
- [ ] MS-2.2 Inbox build logic (unassigned transaction IDs + assignments map)
- [ ] MS-2.3 Apply transactions to budget using assignments as truth + tests
- [ ] MS-2.4 Domain commands: create envelope, assign transaction, allocate to envelope + tests

### Phase 2 Smoke Check
- [ ] “Groceries goes down after assigning a negative transaction” scenario passes in tests

---

## Phase 3: Mobile app scaffold (Expo + Router + basic screens)

### Recommended build order
- [ ] MS-3.1 Create Expo app under `apps/mobile` (Expo Router tabs)
- [ ] MS-3.2 Basic screen skeletons (Dashboard, Transactions, Envelopes, Inbox, Settings)
- [ ] MS-3.3 Zustand store scaffold + engine wiring placeholder (no sync yet)

### Phase 3 Smoke Check
- [ ] App boots in simulator with placeholder screens reachable via tabs

---

## Phase 4: Local-first state + Engine foundation

### Recommended build order
- [ ] MS-4.1 Define AppStateV1 shape (versioned)
- [ ] MS-4.2 Local storage module (load/save/clear AppState)
- [ ] MS-4.3 Engine skeleton: getState/seed/recompute/reset (local-only first)
- [ ] MS-4.4 Minimal “smoke UI” to trigger engine actions (dev buttons ok)

### Phase 4 Smoke Check
- [ ] Seed works (you see initial accounts/budget state)
- [ ] App relaunch persists local state (no reset)

---

## Phase 5: Firebase foundation (Auth + Firestore + rules)

### Recommended build order
- [ ] MS-5.1 Firebase project created + env vars wired in mobile
- [ ] MS-5.2 Anonymous Auth enabled + working in app
- [ ] MS-5.3 Firestore rules baseline for MVP (auth required)
- [ ] MS-5.4 Firestore connectivity sanity (read/write a doc in dev)

### Phase 5 Smoke Check
- [ ] App gets an anon UID (logged once)
- [ ] Firestore read/write succeeds (no permission-denied)

---

## Phase 6: Remote repo + sync contract (push/pull + rev)

### Recommended build order
- [ ] MS-6.1 Define Remote doc shape: `{ rev, state, updatedAt, updatedBy }`
- [ ] MS-6.2 HouseholdStateRepo: pull (null if missing)
- [ ] MS-6.3 HouseholdStateRepo: push with expectedRev + conflict error
- [ ] MS-6.4 Conflict strategy MVP defined (remote-wins or overwrite local)

### Phase 6 Smoke Check
- [ ] First push creates doc with rev=1
- [ ] Second push increments rev
- [ ] Wrong expectedRev triggers conflict path

---

## Phase 7: SyncMeta + household identity (local pointer)

### Recommended build order
- [ ] MS-7.1 SyncMeta storage (householdId, rev, userId)
- [ ] MS-7.2 Tie engine to SyncMeta: when present → bootstrap pulls remote
- [ ] MS-7.3 On recompute: push to remote using syncMeta.rev, update rev on success

### Phase 7 Smoke Check
- [ ] When syncMeta exists, app bootstraps from remote if present
- [ ] When remote missing, app seeds then pushes

---

## Phase 8: Domain + Engine integration hardening (idempotency + no duplicates)

### Recommended build order
- [ ] MS-8.1 Idempotency guards maintained (appliedTransactionIds)
- [ ] MS-8.2 Merge strategy for imported transactions (no duplicates)
- [ ] MS-8.3 Minimal tests for merge/idempotency behavior

### Phase 8 Smoke Check
- [ ] Running recompute multiple times does not double-apply money

---

## Phase 9: Minimal UI smoke flows (pre-Phase 13)

### Recommended build order
- [ ] MS-9.1 “Dev home” screen triggers: add tx, reset, seed
- [ ] MS-9.2 Confirm derived UI fields show expected values (availableToAssign, tx counts)

### Phase 9 Smoke Check
- [ ] You can add a manual transaction and see counts update in UI

---

## Phase 10: TypeScript + workspace cleanup (stability)

### Recommended build order
- [ ] MS-10.1 Fix workspace imports/exports (no “cannot find module”)
- [ ] MS-10.2 TS config aligns with ESM/CJS (Jest config stable)
- [ ] MS-10.3 CI sanity (optional): run tests/lint in GitHub Actions

### Phase 10 Smoke Check
- [ ] Fresh clone → install → tests → app boot works

---

## Phase 11: Pre-setup experience (guard rails before Phase 13)

### Recommended build order
- [ ] MS-11.1 If syncMeta missing → show Setup required state (placeholder ok)
- [ ] MS-11.2 If Firebase fails → show friendly error state (no crash)

### Phase 11 Smoke Check
- [ ] Missing setup doesn’t crash; user sees next step

---

## Phase 12: Final pre-Phase 13 checklist (ready for real onboarding)

### Recommended build order
- [ ] MS-12.1 Confirm household doc path is stable (`households/{householdId}`)
- [ ] MS-12.2 Confirm seed uses householdId consistently
- [ ] MS-12.3 Confirm Firebase rules align with anon auth usage

### Phase 12 Smoke Check
- [ ] No permission-denied in normal dev flow
- [ ] Engine bootstrap is callable and actually called -->
