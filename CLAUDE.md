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
UI Layer          app/ + components/       Expo Router file-based routes
Store Layer       src/store/               Zustand store (snapshots)
Engine Layer      src/domain/engine.ts     Orchestrates mutations, persistence, sync
Infra Layer       src/infra/               Firebase client, AsyncStorage, sync metadata
Domain Package    packages/domain/         Pure business logic (no I/O)
```

### Data Flow

1. UI calls a store action (e.g., `createEnvelope`)
2. Store calls the Engine method
3. Engine applies domain logic from `@money-shepherd/domain`
4. Engine persists to AsyncStorage
5. Engine pushes to Firebase Firestore (if configured)
6. Engine updates the Zustand snapshot
7. UI re-renders

### Domain Package (`packages/domain/`)

Pure TypeScript with no framework, network, or environment dependencies. Uses integers (cents) for all money values — never floats.

Key areas:

- `src/models/` — Value Objects and Entities (Money, Account, Transaction, Envelope, Budget, etc.)
- `src/logic/` — Domain services (allocateFunds, assignTransactionToEnvelope, spendFromEnvelope, etc.)
- `src/errors/` — Typed domain errors
- `tests/` — Jest + ts-jest tests

### Mobile App (`apps/mobile/`)

- **Routing:** Expo Router (file-based under `app/`)
- **State:** Zustand store at `src/store/useAppStore.ts`
- **Engine:** `src/domain/engine.ts` — central coordinator
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
| `packages/domain/docs/DOMAIN_RULES.md` | Domain purity constraints                                      |

## Firebase

The app uses anonymous Firebase auth and Firestore for multi-device sync. Config is in `.env` as `EXPO_PUBLIC_FIREBASE_*` variables (safe to expose in client). The Firebase project is `money-shepherd`.
