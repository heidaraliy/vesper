# VM Isolation Policy

Use this when changing VM docs, bootstrap scripts, worker deployment, or sandbox assumptions.

- Use UTM Virtualize mode with ARM64 Ubuntu guests on Apple Silicon.
- Keep `operator-gui` for browser/manual checks and headless VMs for agents.
- Do not mount the macOS host filesystem read-write into agent VMs.
- Do not mount personal Mac directories, SSH keys, dotfiles, `.env` files, keychain data, or all-access credentials into agent VMs.
- Build and snapshot `agent-base` before cloning workers.
- Run worker processes as non-root users.
- Use per-VM or per-agent scoped credentials.
- Prefer disposable worker VMs and restore from git plus Vesper artifact backups.
