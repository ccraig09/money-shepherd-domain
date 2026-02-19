# PROMPT_TEMPLATES.md

# Money Shepherd - Prompt Templates (Gemini CLI / Antigravity)

> Purpose:
> Copy/paste prompts for consistent agent behavior.
> These templates enforce: scope control, checkpoints, correct checks, and thin TDD.

---

## Global defaults (paste once per session if helpful)

Use these rules for every ticket unless the ticket explicitly requires otherwise:

- One ticket per branch.
- Plan first (list files you will touch).
- Implement only those files.
- No unrelated refactors.
- Run checks (tests/typecheck/lint) and paste output.
- Summarize what changed, how to test, and risks.

---

## Template A: Implement a ticket (standard)

**Use for most tickets.** Replace placeholders.

**Prompt:**
Ticket: `{TICKET_ID} - {TITLE}`

Goal:

- Implement exactly what the ticket requests, with minimal scope.

Skill to use:

- `{SKILL}`

Workflow (must follow):

1. Plan first: restate the goal and list the exact files you will touch.
2. Implement only those files. If you need new files, list them before creating them.
3. Testing policy:
   - If you touch domain/engine/parsing/storage: add/extend tests.
   - If UI-only: no tests required; update manual steps in your summary.
4. Run checks and paste outputs:
   - If domain touched: `npm test -w @money-shepherd/domain`
   - If mobile touched: `npm run lint -w @money-shepherd/mobile` and `npx tsc -p apps/mobile/tsconfig.json --noEmit`
5. Summarize:
   - What changed
   - Files touched
   - How to test (manual steps)
   - Risks / follow-ups

Stop points:

- If you need to touch more than ~6 files, stop and ask before proceeding.

Output format:

- Plan
- Implementation
- Checks (with outputs)
- Summary + Risks

---

## Template B: Plan only (no code)

**Use when you want the agent to think before touching anything.**

**Prompt:**
Ticket: `{TICKET_ID} - {TITLE}`

Skill to use:

- `{SKILL}`

Task:

- Do NOT write code.
- Produce a plan with:
  1. Goal restatement
  2. Minimal file touch list
  3. Proposed UI flow (if relevant)
  4. Whether tests are required and which ones
  5. Manual verification steps

Keep scope small and avoid refactors.

---

## Template C: Fix a failing check (tight scope)

**Use when tests/lint/typecheck failed.**

**Prompt:**
We have a failure in `{COMMAND}`.

Error output:
{PASTE_ERROR_OUTPUT}

Constraints:

- Fix the failure with the smallest possible change.
- Do NOT refactor unrelated code.
- Touch as few files as possible.
- After fixing, re-run `{COMMAND}` and paste output.
- Summarize what changed and why.

Skill to use:

- `{SKILL}`

---

## Template D: Add/extend tests (Thin TDD)

**Use for domain/engine/parsing/storage logic.**

**Prompt:**
We are changing behavior in `{MODULE_OR_FUNCTION}` to satisfy ticket `{TICKET_ID}`.

Skill to use:

- `solid`

Task:

- Write/extend tests to cover:
  1. the happy path
  2. one edge case
  3. one failure/invalid input case (if applicable)

Constraints:

- No snapshots.
- One behavior per test.
- Keep tests readable and deterministic.
- Run `npm test -w @money-shepherd/domain` and paste output.
- Do not modify unrelated tests.

---

## Template E: UI-only ticket (manual smoke, no tests)

**Use for layout/polish/navigation only.**

**Prompt:**
Ticket: `{TICKET_ID} - {TITLE}`

Skill to use:

- `react-native-architecture`

Task:

- Implement the UI changes with minimal scope.
- Do not touch domain logic.
- Do not add tests.
- Ensure the app boots.
- In your summary, include manual steps to verify and expected results.

Constraints:

- No new libraries unless ticket explicitly requires it.
- Keep file changes minimal.

---

## Template F: Firebase/sync troubleshooting (rules + permissions)

**Use when you hit permission-denied / auth / rules issues.**

**Prompt:**
We are seeing Firebase errors:

{PASTE_TERMINAL_ERRORS}

Skill to use:

- `firebase`

Task:

1. Identify the most likely root cause(s).
2. Propose the simplest safe fix for an MVP.
3. List the exact console settings/rules to change.
4. List the exact code changes (minimal).
5. Give a verification checklist (what logs should change).

Constraints:

- Do NOT weaken security to "allow all" unless explicitly approved.
- Prefer rules that allow only authenticated users and only their household doc.

---

## Template G: Update docs only

**Use when you’re improving GEMINI.md / workflow docs.**

**Prompt:**
Update `{DOC_FILE}` to reflect:

- {CHANGE_1}
- {CHANGE_2}

Constraints:

- Docs only. No code changes.
- Keep it concise and actionable.
- Use bullet points and checklists where useful.

---

## Template H: “Touch list enforcement”

**Use if the agent keeps changing too many files.**

**Prompt:**
Before implementing ticket `{TICKET_ID}`, list the exact files you will touch.
After you list them, STOP. Do not implement yet.

Constraint:

- If you need more than ~6 files, propose an alternate smaller plan.

Skill:

- `{SKILL}`

---

## Quick picks (what skill to use)

- Most UI tickets: `react-native-architecture`
- Domain/engine logic tickets: `solid`
- Firebase auth/rules/sync errors: `firebase`
- Plaid tickets: `plaid-fintech`
- Unknown library behavior: `context7-auto-research`
- CI/automation: `github-actions-templates`
- Design system polish: `design-md`
- Git hygiene: `git-pushing`
