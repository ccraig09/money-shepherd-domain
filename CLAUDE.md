# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

`money-shepherd-domain` is a TypeScript monorepo for a personal budgeting app using an envelope budgeting model. It contains a pure domain logic package and an Expo React Native mobile app.

**Workspaces:**

- `packages/domain` → `@money-shepherd/domain` — pure TypeScript business logic, no framework deps
- `apps/mobile` → `@money-shepherd/mobile` — Expo Router app (React Native)

## Commands

```bash
# Install dependencies
npm install

# Start mobile dev server
npm run dev:mobile
# or
npx expo start --ios | --android | --web

# Run domain tests
npm test                                         # domain only
npm run test:all                                 # all workspaces
npm test -w @money-shepherd/domain               # explicit

# Run a single test file
npx jest packages/domain/tests/path/to/test.ts

# Lint mobile
npm run lint -w @money-shepherd/mobile

# Typecheck mobile
npx tsc -p apps/mobile/tsconfig.json --noEmit
```

## Architecture

### Layered Architecture (Mobile)

```
Routes            app/                     Expo Router file-based routes
UI Components     src/ui/components/       Design system (Button, Card, MoneyInput, Toast, etc.)
Design Tokens     src/ui/tokens.ts         Color, typography, spacing constants
Config            src/config/features.ts   Feature flags
Helpers           src/lib/                 Utilities (moneyFormat, dateGroup, retry, id, etc.)
Store             src/store/               Zustand store (snapshots)
Engine            src/domain/engine.ts     Orchestrates mutations, persistence, sync
Commands          src/domain/commands.ts   Pure AppState → AppState mutations
Storage           src/domain/storage.ts    AsyncStorage load/save/clear
Migrations        src/domain/migrations/   Versioned data migration pipeline
Infra             src/infra/               Firebase, Plaid, local storage, remote sync
Domain Package    packages/domain/         Pure business logic (no I/O)
```

### Data Flow

1. UI calls a store action (e.g., `createEnvelope`)
2. Store calls the Engine method
3. Engine runs a **command** (`commands.ts`) — a pure `AppState → AppState` mutation
4. Engine persists updated state to AsyncStorage (`storage.ts`)
5. Engine pushes to Firebase Firestore (if configured)
6. Engine updates the Zustand snapshot
7. UI re-renders

### Domain Package (`packages/domain/`)

Pure TypeScript with no framework, network, or environment dependencies. Uses integers (cents) for all money values — never floats.

Key areas:

- `src/models/` — Value Objects and Entities (Money, Account, Transaction, Envelope, Budget, TransactionAssignment, TransactionInbox, UserRef)
- `src/logic/` — Domain services (allocateFunds, assignTransactionToEnvelope, spendFromEnvelope, applyTransactionToAccount, applyTransactionsToBudget, buildInbox, etc.)
- `src/errors/` — Typed domain errors
- `tests/` — Jest + ts-jest tests

### Mobile App (`apps/mobile/`)

- **Routing:** Expo Router (file-based under `app/`)
- **State:** Zustand store at `src/store/useAppStore.ts`
- **Engine:** `src/domain/engine.ts` — central coordinator
- **Commands:** `src/domain/commands.ts` — pure `AppState → AppState` mutations (createEnvelope, assignTransaction, seedBudgetFromBalances, etc.)
- **AppState:** `src/domain/appState.ts` — canonical `AppStateV1` type with version field, idempotency guards, and all domain entities
- **Migrations:** `src/domain/migrations/` — versioned data migration pipeline (runs on app boot)
- **Storage:** `src/domain/storage.ts` — AsyncStorage load/save/clear with atomic writes
- **Design system:** `src/ui/tokens.ts` (colors, typography, spacing) + `src/ui/components/` (Button, Card, MoneyInput, Toast, etc.)
- **Helpers:** `src/lib/` — moneyFormat, moneyInput, dateGroup, id, retry, logger, etc.
- **Config:** `src/config/features.ts` — feature flags
- **Infra:** `src/infra/firebase/` (auth + Firestore), `src/infra/local/` (AsyncStorage, PIN, sync metadata), `src/infra/plaid/` (Plaid client + mappers), `src/infra/remote/` (HouseholdStateRepo + sync)
- **Cloud Functions:** `functions/` (top-level) — post-sync triggers (e.g., budget seeding)
- **Sync:** Firebase anonymous auth + Firestore at `src/infra/`
- **Path alias:** `@/*` maps to `apps/mobile/` root

## Non-Negotiables

1. **Domain purity:** `packages/domain` must never import from mobile, infra, Firebase, or any framework. See `packages/domain/docs/DOMAIN_RULES.md`.
2. **Engine-first mutation:** All state changes go through the Engine — never call domain logic or AsyncStorage directly from UI or the store.
3. **One ticket per session:** No batching unrelated changes.
4. **Plan first, then implement:** List files before editing.
5. **Touch only planned files:** Keep changes minimal. No drive-by refactors, renames, or moves unless the ticket requires it.
6. **Stop if scope grows:** If more than ~6 files are needed, pause and ask for approval.
7. **Keep the app bootable at all commits:** No "will fix later" breaks.

## Per-Ticket Workflow

For each GitHub ticket:

1. **Plan:** Restate goal, list exact files to touch, decide if tests are required.
2. **Implement:** Modify only those files (add new files only if declared in plan).
3. **Run checks:** Execute only the checks that apply (see below).
4. **Fix until green** without widening scope.
5. **Summarize:** What changed, files touched, how to test, risks/follow-ups.

### Required Checks

Run only what applies to the ticket:

| Condition                 | Check                                           |
| ------------------------- | ----------------------------------------------- |
| `packages/domain` touched | `npm test -w @money-shepherd/domain`            |
| `apps/mobile` touched     | `npm run lint -w @money-shepherd/mobile`        |
| `apps/mobile` touched     | `npx tsc -p apps/mobile/tsconfig.json --noEmit` |
| UI changes                | Verify Expo boots with `npm run dev:mobile`     |

## Testing Policy (Thin TDD)

Write tests where regressions are expensive. Avoid UI test explosion.

### Tests REQUIRED when touching:

- `packages/domain/**`
- `apps/mobile/src/domain/**` (engine, recompute, commands, sync logic)
- Parsing/formatting helpers (money parsing)
- Storage/migrations

### Tests NOT required when ticket is:

- UI-only polish (spacing, typography, layout)
- Navigation wiring (unless it changes business rules)
- Empty-state copy

If tests already exist, extend only what you changed. No snapshot tests.

## Skills Usage Policy

Use **1 skill per ticket**, max **2** only if clearly required. Agent states chosen skill(s) in the **Plan** step — wait for approval before coding.

| Skill                       | When to use                                               |
| --------------------------- | --------------------------------------------------------- |
| `react-native-architecture` | Default for all tickets                                   |
| `solid`                     | Domain/engine rules + tests                               |
| `firebase`                  | Firebase Auth/Firestore/Rules, sync troubleshooting       |
| `context7-auto-research`    | Unknown API/library                                       |
| `plaid-fintech`             | Plaid tickets (+ `context7-auto-research` only if needed) |
| `github-actions-templates`  | CI/automation                                             |
| `design-md`                 | Design system polish                                      |
| `git-pushing`               | Git hygiene (clean history, commits, PR hygiene)          |

## Output Format

Every ticket response must include:

- **Plan** — goal + file list + test decision
- **Implementation** — the work
- **Checks** — commands + outputs
- **Summary** — what changed, files touched, how to test, risks

### PR Summary Format

```
- What:
- Files:
- How to test:
- Risks / follow-ups:
```

## Key Documentation

| File                                   | Purpose                                                        |
| -------------------------------------- | -------------------------------------------------------------- |
| `AGENT_WORKFLOW.md`                    | Agent build rules, testing policy, required checks, escalation |
| `PHASE_PLAN.MD`                        | Living ticket checklist for Phases 13–19                       |
| `PROMPT_TEMPLATES.md`                  | Reusable prompts for consistent agent behavior                 |
| `SMOKE_TESTS.md`                       | Manual test checklists per phase                               |
| `DESIGN.md`                            | Visual identity, color system, typography, brand guidelines    |
| `DEV_CHEATSHEET.md`                    | Dev setup, device UDIDs, Firebase project, Plaid sandbox creds |
| `packages/domain/docs/DOMAIN_RULES.md` | Domain purity constraints                                      |

## Firebase

The app uses anonymous Firebase auth and Firestore for multi-device sync. Config is in `.env` as `EXPO_PUBLIC_FIREBASE_*` variables (safe to expose in client). The Firebase project is `money-shepherd`.

## Session Context (for agent continuity)

### Workflow Preferences
- **`/done` command**: Close GH issue(s), mark [x] in PHASE_PLAN.MD, commit each ticket separately with conventional commit message (feat/fix/docs + ticket ID in body), push to origin/main, verify clean tree.
- **Paths with parens** (e.g. `apps/mobile/app/(tabs)/`): always quote them in `git add` to avoid zsh glob errors.
- **Repo**: `ccraig09/money-shepherd-domain`

### Known Issues
- Pre-existing TS error in `apps/mobile/src/infra/firebase/firebaseClient.ts`: `getReactNativePersistence` not exported from `firebase/auth` — do not flag as a regression.

### Current Status
- **Active phase**: Phase 19 (Hardening + release readiness)
- **Next ticket**: MS-19.15 (Accounts overview)
- **Recently completed**: MS-19.14 (seed budget from bank balances)
- Run `git log --oneline -20` and `gh issue list --state open` to catch up on recent work.
