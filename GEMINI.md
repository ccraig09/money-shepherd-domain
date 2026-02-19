# GEMINI.md

# Money Shepherd - Gemini Project Context

Money Shepherd is a personal and household finance management application designed for local-first reliability with cloud synchronization. It is structured as a monorepo containing a pure domain logic package and a React Native/Expo mobile application.

---

## Single Source of Truth

- **Build order and progress tracking:** `PHASE_PLAN.md`
- **Agent execution rules (how to work):** `AGENT_WORKFLOW.md`
- **Reusable prompts:** `PROMPT_TEMPLATES.md`
- **Manual verification:** `SMOKE_TESTS.md`

---

## Project Structure

- **`packages/domain/`**: Core business logic. Value Objects, Entities, Domain Services. Strictly framework-agnostic and side-effect free.
- **`apps/mobile/`**: Expo-based mobile application. Implements UI, local state management (Zustand), and infrastructure (Firebase sync, local storage).

---

## Core Technologies

- **Frontend:** React Native with Expo (Expo Router for navigation)
- **State Management:** Zustand
- **Database/Backend:** Firebase (Firestore + Anonymous Auth)
- **Domain Logic:** TypeScript (pure logic)
- **Testing:** Jest

---

## Architecture

### Domain Layer (`packages/domain`)

Follows strict domain-driven design principles. Key entities include:

- `Account`: Bank or cash accounts
- `Budget`: Household budget container
- `Envelope`: Categories for fund allocation
- `Transaction`: Financial movements
- `Money`: Value object for currency handling (avoids floating-point issues)

### Mobile App Infrastructure (`apps/mobile/src/infra`)

- **`engine.ts`**: Central coordinator bridging domain logic with UI + infrastructure
- **`firebaseClient.ts`**: Remote sync + authentication
- **`useAppStore.ts`**: Zustand store providing a reactive view of app state

---

## Non-negotiables (Agent Guardrails)

1. **One ticket per branch** (no batching).
2. **Plan first, then implement** (list files before editing).
3. **Touch only planned files** (keep changes minimal).
4. **No unrelated refactors** (no renames/moves unless ticket requires it).
5. **Domain purity:** `packages/domain` must never import mobile/infra/framework code.
6. **Engine-first mutation:** all state changes go through the Engine so recompute/persist/sync stays correct.
7. **Stop if scope grows:** if more than ~6 files are needed, pause and ask for approval.

---

## Skills usage policy (do not over-apply)

- Use **1 skill per ticket**, max **2** only if clearly required.
- Do not auto-pick skills. Los approves skill + template before coding.

### Default

- `react-native-architecture`

### Add only when needed

- Domain/engine rules + tests: `solid`
- Firebase Auth/Firestore/Rules + sync troubleshooting: `firebase`
- Unknown API/library: `context7-auto-research`
- Plaid tickets: `plaid-fintech` (+ `context7-auto-research` only if needed)
- CI/automation: `github-actions-templates`
- Design system polish: `design-md`
- Git hygiene (clean history, commits, PR hygiene): `git-pushing`

---

## Per-ticket workflow (required)

For each GitHub ticket:

1. **Plan**: restate goal + list exact files to touch + decide if tests are required.
2. **Implement**: modify only those files (add new files only if declared).
3. **Run checks** (see Required checks).
4. **Fix until green** without widening scope.
5. **Summarize**: what changed, files touched, how to test, risks/follow-ups.

---

## Testing policy (Thin TDD)

Write tests where regressions are expensive. Avoid UI test explosion.

### Tests REQUIRED when touching

- `packages/domain/**`
- `apps/mobile/src/domain/**` (engine, recompute, commands, sync logic)
- parsing/formatting helpers (money parsing)
- storage/migrations

### Tests NOT required when ticket is

- UI-only polish (spacing, typography, layout)
- navigation wiring (unless it changes business rules)
- empty-state copy

If tests already exist, extend only what you changed. Avoid snapshots unless explicitly approved.

---

## Building and Running

### Root Commands

- `npm install`: Installs dependencies for the entire workspace
- `npm test`: Runs tests for the domain package
- `npm run test:all`: Runs tests across all workspace packages
- `npm run dev:mobile`: Starts the Expo dev server for mobile

### Mobile App (`apps/mobile/`)

- `npx expo start`: Starts the development server
- `npm run ios`: Runs the app on iOS simulator
- `npm run android`: Runs the app on Android emulator
- `npm run lint`: Runs ESLint on mobile

### Domain Package (`packages/domain/`)

- `npm test`: Runs Jest tests for business logic

---

## Required checks

Run only what applies to the ticket.

### If domain touched

- `npm test -w @money-shepherd/domain`

### If mobile touched

- `npm run lint -w @money-shepherd/mobile`
- `npx tsc -p apps/mobile/tsconfig.json --noEmit` (or repo typecheck script if present)

### If UI changes

- Ensure Expo boots (only if needed): `npx expo start`

---

## Development Conventions

- **Domain Purity:** never import infra/framework code into `packages/domain`. Use `DomainError` hierarchy for error handling.
- **Engine-First Mutation:** all state changes in mobile must be initiated through the Engine to ensure recompute/persist/sync.
- **Type Safety:** keep strict TypeScript across packages. Prefer shared models from domain.
- **Documentation:** maintain `README.md` and `CHANGELOG.md` in each package. Use Mermaid diagrams for architectural changes.

---

## Output format for agent responses

Every ticket response must include:

- **Plan** (goal + file list + test decision)
- **Implementation**
- **Checks** (commands + outputs)
- **Summary** (what changed, files touched, how to test, risks)

---

## PR summary format (recommended)

- What:
- Files:
- How to test:
- Risks / follow-ups:

---

## Memories & Workflow

- **Commit First:** commit architectural or documentation setup changes before starting feature implementations.
