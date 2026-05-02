# Command Safety Policy

Use this when changing command classification, approvals, or execution policy.

## Deny

Deny commands that:

- read, print, copy, delete, or modify secret-looking paths or names
- use piped network installers such as `curl ... | sh`
- broadly delete `/`, `~`, `.`, `..`, `$HOME`, project roots, worktree roots, artifact roots, or database paths
- target durable Vesper state outside the active worktree
- attempt to escape the VM boundary or mount host-sensitive paths

## Approval Required

Require approval for:

- narrow destructive cleanup under build/cache outputs
- suspicious but bounded filesystem changes where intent is clear
- operational actions that alter worker service state

Use two approvers for destructive cleanup that deletes directories.

## Allow

Allow ordinary read, build, test, format, and scoped edit commands inside the active worktree when they do not match deny or approval rules.

## Artifact Requirements

Every non-allow decision should include command text, command hash, cwd, resolved targets, reason, action, required approvals, run ID, and project ID.
