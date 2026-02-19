# AGENT_WORKFLOW.md

# Money Shepherd - Agent Workflow (Gemini CLI + Antigravity)

> Purpose:
>
> - This file is the "HOW" to build with an agent safely.
> - Follow `PHASE_PLAN.md` for the ordered checklist of tickets.
> - Keep changes small, scoped, and reversible.

---

## North Star

Ship a usable MVP to Los + Jackia with:

- local-first reliability
- predictable domain rules (envelopes, assignments, allocations)
- optional cloud sync (Firebase)
- optional Plaid (later)
- minimal anxiety: small PRs, green checks, repeatable steps

---

## Non-negotiables (agent guardrails)

1. **One ticket per branch** (no batching).
2. **Small scope only**: touch the fewest files possible.
3. **No drive-by refactors**: do not rename/move files unless the ticket requires it.
4. **Domain purity**: `packages/domain` must never import mobile/infra/framework code.
5. **Engine-first mutation**: app state changes flow through the Engine so recompute/persist/sync stays correct.
6. **Keep the app running**: don’t break build to “prepare for later.”
7. **Stop at checkpoints**: Plan -> Implement -> Checks -> Summary.

---

## Per-ticket workflow (required)

For EVERY ticket, the agent must do these steps in order:

### Step 1: Plan (no code yet)

- Restate the ticket goal in 1–2 sentences.
- List the **exact files** it will touch (keep this list short).
- Note whether tests are required (see “Testing policy”).

### Step 2: Implement (only planned files)

- Implement only what the ticket asks for.
- If new files are needed, add them, but keep them minimal.
- Do not refactor unrelated code.

### Step 3: Run checks (show outputs)

Run the minimum set of checks below and paste the results.

### Step 4: Fix until green

- If anything fails, fix it **without widening scope**.

### Step 5: Summarize (required format)

- What changed
- Files touched
- How to test (manual steps)
- Risks / follow-ups

---

## Testing policy (Thin TDD)

We do NOT write tests for everything. We write tests where regressions are expensive.

### Tests REQUIRED when the ticket touches:

- `packages/domain/**` (domain logic)
- `apps/mobile/src/domain/**` (engine, recompute, commands, sync strategy)
- parsing/formatting helpers (MoneyInput logic, cents parsing)
- migrations/storage integrity helpers

### Tests NOT required (manual smoke only) when the ticket is:

- UI-only layout/polish (spacing, typography, card styles)
- navigation wiring (unless it changes business rules)
- copy/empty state text

### If tests already exist:

- Extend them ONLY for the behavior you changed.
- Avoid snapshot testing unless we explicitly decide to.

---

## Required checks (what to run)

Run only what applies to the ticket.

### If domain was touched:

- `npm test -w @money-shepherd/domain`

### If mobile code was touched:

- `npm run lint -w @money-shepherd/mobile` (or `-w apps/mobile` depending on your workspace)
- Typecheck (one of these depending on your setup):
  - `npx tsc -p apps/mobile/tsconfig.json --noEmit`
  - OR your repo’s existing `npm run typecheck` if present

### For UI changes:

- Ensure Expo boots:
  - `npm run dev:mobile` OR `npx expo start` (only if needed to validate)

---

## “Stop points” (prevent agent drift)

The agent MUST pause and ask for confirmation when:

- it needs to touch more than ~6 files
- it proposes changing the folder structure
- it proposes new architecture or new libraries
- it wants to refactor domain models or state shape
- it hits Firebase rules/auth issues and suggests weakening security permanently

---

## Skills usage policy (avoid overkill)

You choose 1 skill per ticket, max 2 when required.

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

### Never let the agent “choose skills automatically”

It increases scope and causes unnecessary refactors.

---

## Definition of Done (DoD)

A ticket is “done” only when:

- Code compiles
- Required checks are green
- Manual smoke steps for that ticket pass
- The agent produced a summary (what/how to test/risks)
- No unrelated files were changed

---

## Escalation playbook (when stuck)

If the agent gets stuck, do NOT thrash.

### Paste back to Los (you) or to ChatGPT:

- the ticket ID
- the failing command output
- the exact error stack
- the file(s) changed in the last attempt

### What we do next:

- we decide: rollback / narrow scope / adjust plan
- we fix the smallest failing unit first

---

## Recommended ticket cadence (ADHD-friendly)

- 1 ticket = 1 clear win
- Stop after every 2–3 tickets to run the Phase Smoke Check
- If you feel “stuck,” switch to a small UI-only ticket for momentum

---

## Manual smoke is king (for UI-heavy phases)

- Always update `SMOKE_TESTS.md` if a flow changes.
- UI changes should be validated by running the smoke steps, not writing dozens of UI tests.
