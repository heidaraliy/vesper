---
name: vesper-agent
description: Generic autonomous implementation pipeline for Vesper. Use when a feature or fix should move from request to context bundle, audited plan, worktree implementation, validation, code review, and draft PR with dependency-aware agent workflow.
---

# Vesper Agent Pipeline

Use this skill for full feature-to-PR work or when the user asks for agent-team orchestration.

## Pipeline Contract

1. Preflight branch and worktree state.
2. Build a context bundle from local repo search.
3. Produce an architecture plan.
4. Audit the plan when safety, worker lifecycle, Discord permissions, or VM boundaries are involved.
5. Implement from a feature worktree.
6. Run targeted validation, then `npm run build` and `npm test`.
7. Review the diff.
8. Push and open a draft PR when requested or when full delivery is implied.

Never implement, commit, push, or open a PR from `main`.

## Preflight

- Derive branch slug `agent/<short-feature-slug>`.
- Run `git branch --show-current` and `git status -sb`.
- If on `main`, create a worktree with `tools/agents/scripts/pre_worktree.py`.
- Load `tools/agents/instructions/index.md`, matching instruction files, and relevant Vesper skills.

## Context Bundle

Use `rg` before designing. Include owning modules, nearby tests, user-facing Discord behavior, worker lifecycle, safety risks, VM assumptions, artifact durability, and validation gates.

## Implementation

Keep write scopes disjoint when delegating. Tell workers they are not alone in the codebase and must not revert unrelated changes. Keep urgent blocking work local.

## Review And PR

Run `vesper-code-reviewer` on the final diff. Fix correctness, safety, and test gaps before publishing. Draft PR descriptions must cover summary, validation, and residual risk.
