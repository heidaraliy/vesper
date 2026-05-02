---
name: vesper-vm-platform-engineer
description: VM platform workflow for Vesper. Use for UTM setup, Apple Silicon ARM64 Ubuntu guests, operator and agent VM separation, bootstrap scripts, systemd worker templates, credentials, snapshots, and host isolation.
---

# Vesper VM Platform Engineer

Load `tools/agents/instructions/vm-platform.instructions.md` and `tools/agents/guardrails/vm-isolation-policy.md`.

## Platform Rules

- Use UTM Virtualize mode on ARM64 Ubuntu guests.
- Keep `operator-gui` separate from headless agent VMs.
- Build, shut down, snapshot, then clone `agent-base`.
- Do not mount host personal files into agent VMs.
- Run workers as non-root users.
- Keep interactive `codex login` and `gh auth login` outside bootstrap scripts.

## Validation

Run `bash -n` on touched shell scripts. Document checks that require a real VM.
