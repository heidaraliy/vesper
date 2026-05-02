# Agent Instruction Index

Read only the instruction files that match the task.

| Path or task | Instruction file |
| --- | --- |
| before implementation, commit, push, worktree setup, or PR workflow | `pre-worktree-pr.instructions.md` |
| full feature-to-PR pipeline, autonomous implementation, or multi-agent orchestration | `accuracy-pipeline.instructions.md` |
| `AGENTS.md`, `.codex/skills/**`, `tools/agents/**`, hooks, evals, guardrails | `agent-config.instructions.md` |
| `src/**/*.ts`, TypeScript runtime behavior, npm scripts, build/test flow | `typescript-runtime.instructions.md` |
| `src/discord-*`, slash commands, Discord roles, thread UX, approvals | `discord-control-plane.instructions.md` |
| `src/safety.ts`, command classification, approvals, protected paths, secrets | `safety-guardrails.instructions.md` |
| `src/codex.ts`, `src/core.ts`, `src/projects.ts`, worker lifecycle, queue flow, artifacts | `worker-orchestration.instructions.md` |
| `src/memory.ts`, evals, retrospectives, run scoring, regression artifacts | `memory-evals.instructions.md` |
| `docs/utm-platform.md`, `scripts/utm/**`, `scripts/bootstrap-vm.sh`, `systemd/**`, VM setup | `vm-platform.instructions.md` |
| `.github/**`, releases, install docs, repo automation, PR publishing | `repo-automation.instructions.md` |

When a task spans domains, read all matching files and load the corresponding skills.
