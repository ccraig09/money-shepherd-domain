The user has approved the plan. Proceed with implementation.

**Model reminder:** This command is best run on Sonnet for speed/cost. If you're on Opus, remind the user: "Tip: switch to Sonnet with `/model` for faster implementation."

Execute the plan that was just presented:
1. Implement all planned changes — write the code, create files, edit files as specified.
2. Run all required checks per CLAUDE.md (tests, lint, typecheck as applicable).
3. If checks fail, fix the issues without widening scope. Use systematic-debugging if needed.
4. When all checks pass, present the summary (what changed, files touched, how to test, risks).
5. Do NOT commit or push — wait for `/done` or explicit user instruction.
