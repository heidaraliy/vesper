# Task Prompt Template

Use when handing work to an agent.

```text
Goal:
<specific user-visible result>

Repo:
<repo path and branch/worktree>

Context to read:
- AGENTS.md
- tools/agents/instructions/index.md
- <matching instruction files>
- <matching skills>

Constraints:
- Do not work from main.
- Preserve unrelated user changes.
- Keep Discord from becoming shell execution.
- Preserve VM isolation and artifact durability.

Validation:
- <targeted tests>
- npm run build
- npm test

Deliverable:
<diff, tests, commit/PR expectation, residual risk>
```
