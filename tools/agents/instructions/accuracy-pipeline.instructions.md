# Accuracy Pipeline Instructions

Use this for non-trivial implementation, orchestration, safety-sensitive behavior, multi-agent work, or PR publishing.

## Pipeline

1. Preflight branch, dirty state, and project readiness.
2. Build a context bundle from local repo search.
3. Produce an implementation plan with explicit risk boundaries.
4. Audit the plan before editing when the task crosses safety, worker lifecycle, or Discord permission boundaries.
5. Implement with scoped write sets.
6. Run targeted validation, then broaden.
7. Review the final diff against invariants and tests.
8. Publish a draft PR when requested or when full delivery is implied.

## Context Bundle

Include:

- owning modules and nearby tests
- current user-facing behavior
- queue, worker, artifact, and Discord surfaces affected
- security boundary assumptions
- validation gates and any VM-only checks

Prefer `rg` and direct source reads over assumptions.

## Plan Audit

Use `vesper-plan-auditor` for non-trivial plans. The audit should challenge:

- whether Discord input can become shell execution
- whether Codex runs in a bounded worktree
- whether secrets, host files, and databases are protected
- whether artifacts make failures diagnosable
- whether tests cover the actual risk

## Implementation

Keep edits scoped to the modules involved. Preserve existing async lifecycle, database, and artifact patterns. For concurrent or long-running work, make cancellation and retry behavior explicit.

## Review

Use `vesper-code-reviewer` on the final diff. Fix correctness, safety, and test gaps before publishing. Draft PR descriptions must cover summary, validation, and residual risk.
