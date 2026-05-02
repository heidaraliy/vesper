# Worker Orchestration Instructions

Use this for `src/codex.ts`, `src/core.ts`, `src/projects.ts`, queue flow, artifacts, cancellation, and Codex JSONL streaming.

## Run Lifecycle

The intended flow is:

```text
Discord command
-> permission check
-> todo or ad-hoc run
-> isolated project worktree
-> Codex JSONL stream
-> safety classification on command events
-> artifacts and audit logs
-> Discord thread updates
-> completion, block, cancel, or failure state
```

Do not add direct shell execution from Discord.

## Worktree Rules

- Resolve base refs conservatively: `origin/main`, `origin/master`, `main`, `master`, then `HEAD`.
- Use deterministic branch and path names.
- Reuse existing worktrees only when the path and branch are the expected pair.
- Make cleanup explicit; do not delete worktrees automatically after failures.

## Streaming Rules

- Preserve session IDs for resume.
- Parse Codex JSONL defensively.
- Route command events through safety checks before continuing.
- Convert significant failures into artifacts with enough context to debug.
