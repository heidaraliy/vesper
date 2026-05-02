# Run Lifecycle Evals

Use when changing VesperCore, CodexRunner, project worktrees, artifacts, or Discord run updates.

## Required Cases

- Missing or unready projects cannot start automatic runs.
- Plan-gated runs enter planning and wait for approval.
- Automatic runs create or reuse the expected worktree.
- Codex session IDs are preserved for resume.
- Command events are routed through safety classification.
- Blocked commands create safety artifacts and stop the run.
- Cancellation kills the active Codex process and records cancelled state.
- Completion writes result artifacts and marks todo/run state consistently.
