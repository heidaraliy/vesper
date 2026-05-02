---
name: vesper-worker-engineer
description: Worker orchestration workflow for Vesper. Use for CodexRunner, Codex JSONL parsing, VesperCore run lifecycle, project readiness, worktree creation, SQLite queue assumptions, artifacts, cancellation, retries, and systemd workers.
---

# Vesper Worker Engineer

Load `tools/agents/instructions/worker-orchestration.instructions.md`.

## Rules

- Preserve the run lifecycle from Discord request through worktree, Codex stream, safety check, artifacts, and completion.
- Parse Codex JSONL defensively.
- Preserve session IDs for resume.
- Route command events through safety classification.
- Make cancellation and failure state durable.
- Keep SQLite single-writer assumptions visible.

## Validation

Add focused tests around lifecycle transitions, parser cases, artifacts, or worktree behavior. Run targeted tests, then `npm run build` and `npm test`.
