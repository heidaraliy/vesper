---
name: vesper-plan-auditor
description: Independent plan review for Vesper. Use before implementing non-trivial plans that affect Discord controls, Codex execution, command safety, worker lifecycle, VM isolation, credentials, artifacts, SQLite state, or PR packaging.
---

# Vesper Plan Auditor

Review plans for correctness, missing context, and safety gaps.

## Audit Questions

- Can Discord input become shell execution?
- Does the plan preserve VM isolation as the security boundary?
- Does Codex run only inside the intended project worktree?
- Are secret-looking paths and credentials denied?
- Are destructive actions blocked or approval-gated before execution?
- Are SQLite concurrency and artifact durability addressed?
- Is cancellation/failure state coherent?
- Do tests cover the riskiest behavior?
- Are validation commands realistic for local and VM-only surfaces?

Return required changes first, then optional improvements.
