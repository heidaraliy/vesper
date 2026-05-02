---
scope: Project
alwaysApply: true
description: Vesper agent entrypoint. Keep this file sparse; detailed workflows live in tools/agents and .codex/skills.
---

# Vesper Agent Guide

## Goal

Build Vesper into a safe Discord-controlled Codex orchestration platform for VM-isolated autonomous project work. Good work is small, repo-shaped, validated, auditable, and explicit about security boundaries.

## Load Order

1. Read this file first.
2. Before repo-tracked implementation, commit, push, worktree setup, or PR work, read `tools/agents/instructions/pre-worktree-pr.instructions.md`.
3. Read `tools/agents/instructions/index.md` and only the instruction files that match the touched paths or task domain.
4. For non-trivial features, orchestration changes, safety-sensitive behavior, or PR publishing, read `tools/agents/instructions/accuracy-pipeline.instructions.md`.
5. Load every relevant Vesper skill before planning or editing.
6. Search local repo context with `rg` before designing or changing behavior.

## Skill Routing

- `vesper-agent`: full feature pipeline from context bundle through audited plan, worktree implementation, validation, review, and draft PR.
- `vesper-feature-architect`: feature planning and architecture for orchestration, workers, queues, and safety boundaries.
- `vesper-plan-auditor`: plan review before implementation.
- `vesper-code-reviewer`: final diff review with correctness, safety, test, and operational-risk focus.
- `vesper-build-engineer`: TypeScript, Vitest, npm, packaging, and local run workflow.
- `vesper-safety-engineer`: command classification, approvals, guardrails, secrets, destructive actions, and sandbox policy.
- `vesper-discord-engineer`: Discord bot, slash commands, permissions, thread UX, and control-plane ergonomics.
- `vesper-vm-platform-engineer`: UTM, Ubuntu guests, bootstrap scripts, systemd, credentials, and VM isolation.
- `vesper-worker-engineer`: queue workers, SQLite concurrency, artifacts, Codex JSONL streaming, cancellation, and retry behavior.
- `vesper-memory-evals-engineer`: memory, retrospectives, eval artifacts, run scoring, and regression checks.

Use the smallest skill set that covers the task.

## Hard Invariants

- Discord approval is not a security boundary; VM isolation is.
- Do not mount the macOS host filesystem, personal dotfiles, SSH keys, `.env` files, keychain material, or all-access credentials into agent VMs.
- Keep the GUI operator VM separate from headless agent VMs.
- Do not give Discord users arbitrary shell execution. Route work through permission checks, typed commands, queues, and audited workers.
- Run Codex inside a project worktree, not at the VM root.
- Default agent execution to `workspace-write` and `--ask-for-approval never` only inside the intended isolated worker context.
- Destructive commands, secret access, piped network installers, and protected path targets must be blocked or approval-gated before they can damage durable state.
- Preserve durable artifacts for plans, logs, safety events, diffs, validation, memory, and PR links.
- Keep SQLite single-writer assumptions explicit. Do not share one database among many writers without a controlled queue service or locking design.
- Keep root guidance compact; put detailed agent rules in `tools/agents/**` or skills.

## Required Validation

- TypeScript changes: `npm run build`.
- Behavior changes: targeted Vitest tests, then `npm test`.
- Safety, worker, or Codex-runner changes: add or update tests under `src/*.test.ts`.
- Agent config/docs changes: `python3 tools/agents/scripts/validate_agent_config.py`, `bash -n tools/agents/git-hooks/* tools/agents/codex-hooks/*`, and `git diff --check`.
- VM/bootstrap changes: `bash -n scripts/**/*.sh` plus shellcheck when available.

## Failure Handling

Read the first meaningful error and fix the root cause. If the same validation failure persists after three focused attempts, stop and report what was tried, what failed, and the most likely next fix.
