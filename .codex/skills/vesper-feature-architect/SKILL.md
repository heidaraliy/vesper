---
name: vesper-feature-architect
description: Architecture planning for Vesper features. Use for Discord-to-Codex orchestration, worker queues, safety boundaries, VM operations, memory/evals, artifacts, database schema, and feature plans before implementation.
---

# Vesper Feature Architect

Use this skill to produce implementation plans grounded in current source.

## Inputs To Gather

- User-visible workflow and autonomy mode.
- Owning modules and tests.
- Discord command/thread impact.
- Worker, worktree, Codex JSONL, artifact, and database impact.
- Safety boundary: secrets, destructive commands, host mounts, VM assumptions.
- Validation and rollout path.

## Plan Shape

Keep plans concrete:

- files to touch
- state transitions
- database/artifact changes
- safety decisions
- tests to add or update
- validation commands
- residual VM-only checks

Route broad or risky plans through `vesper-plan-auditor` before implementation.
