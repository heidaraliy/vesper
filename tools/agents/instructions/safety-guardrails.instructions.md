# Safety Guardrails Instructions

Use this for command classification, approvals, protected paths, secrets, destructive actions, and sandbox policy.

## Security Boundary

The VM is the security boundary. Vesper still must prevent obvious unsafe commands before execution because agent VMs hold repos, credentials, artifacts, and queue state.

## Command Policy

- Deny secret-looking commands that target `.env`, SSH keys, credentials, tokens, keychains, or secret stores.
- Deny piped network installers such as `curl ... | sh`.
- Deny broad destructive deletes against `/`, `~`, `.`, `..`, `$HOME`, project roots, worktree roots, artifact roots, or database paths.
- Approval-gate narrow cleanup under build/cache outputs.
- Preserve command hash, command text, cwd, resolved targets, reason, and required approvals in safety artifacts.

Load `tools/agents/guardrails/command-safety-policy.md` before broadening this policy.

## Tests

Each policy change needs allow, deny, and approval-required examples in `src/safety.test.ts` or a focused sibling test.
