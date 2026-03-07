Start the next ticket from PHASE_PLAN.MD.

1. Read PHASE_PLAN.MD and find the first unchecked (`- [ ]`) ticket in the current active phase.
2. Map the ticket ID (e.g. MS-19.18) to its GitHub issue using `gh issue list --state open` and find the matching issue number.
3. Fetch the full issue details with `gh issue view <number>`.
4. Run the selector pass — do NOT write code yet:
   a. Pick the best template from PROMPT_TEMPLATES.md (A–H) and explain why.
   b. Pick the skill to use (max 1; 2 only if clearly required) per CLAUDE.md skills table.
   c. List the exact files you will touch (estimate).
   d. Decide if tests are required based on CLAUDE.md testing policy and say which tests.
   e. Provide a short plan (5–10 bullets).
5. After presenting the plan, STOP and wait for explicit user approval before writing any code. Do NOT proceed to implementation until the user confirms.
