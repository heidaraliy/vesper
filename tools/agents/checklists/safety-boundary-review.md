# Safety Boundary Review

Use for changes that affect command execution, credentials, VM setup, worker lifecycle, or Discord approvals.

- Can any Discord input become shell syntax without typed validation?
- Does Codex run only in the intended project worktree?
- Is the sandbox mode appropriate for the VM and project?
- Are project root, worktree root, artifact root, database path, home directory, and `/` protected?
- Are `.env`, SSH keys, tokens, credentials, and keychain material denied?
- Are destructive commands blocked or approval-gated before execution?
- Are safety decisions persisted as artifacts and audit events?
- Can cancellation stop the active Codex process and leave durable state understandable?
- Does the change preserve the rule that VM isolation is the actual security boundary?
