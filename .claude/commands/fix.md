A check or build has failed. Debug and fix it.

**Model reminder:** This command is best run on Opus for deep reasoning. If you're on Sonnet, remind the user: "Tip: switch to Opus with `/model` for better debugging."

Use systematic-debugging approach:
1. Read the error output carefully — identify the exact failure (file, line, message).
2. Identify the root cause — do NOT guess. Read the relevant source files.
3. Form a hypothesis and verify it before making changes.
4. Apply the minimal fix — do not refactor or widen scope.
5. Re-run the failing check to confirm the fix works.
6. If the fix introduces new failures, repeat from step 1.
7. Present what went wrong and what you changed.
