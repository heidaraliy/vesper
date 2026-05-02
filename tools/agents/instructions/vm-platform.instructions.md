# VM Platform Instructions

Use this for `docs/utm-platform.md`, `scripts/utm/**`, `scripts/bootstrap-vm.sh`, `systemd/**`, and VM setup.

## Platform Invariants

- Use UTM Virtualize mode on Apple Silicon with ARM64 Ubuntu guests.
- Keep `operator-gui` separate from headless agent VMs.
- Build `agent-base`, shut it down, snapshot it, then clone disposable workers.
- Do not mount the Mac host filesystem read-write into agent VMs.
- Keep personal dotfiles, SSH keys, `.env` files, and keychain material out of agent VMs.
- Run workers as non-root users.

## Script Rules

- Keep scripts idempotent where practical.
- Make role-specific scripts clear: operator GUI setup belongs in `scripts/utm/bootstrap-operator-gui.sh`; agent base setup belongs in `scripts/utm/bootstrap-agent-base.sh`.
- Do not run interactive auth in bootstrap scripts; document `codex login` and `gh auth login` separately.

## Validation

Run `bash -n` on touched shell scripts. Document checks that require a fresh VM or snapshot.
