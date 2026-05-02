# Risk Class Validation Matrix

| Risk class | Examples | Minimum validation |
| --- | --- | --- |
| Docs and agent config | `AGENTS.md`, `.codex/skills/**`, `tools/agents/**` | `python3 tools/agents/scripts/validate_agent_config.py`, `bash -n tools/agents/git-hooks/* tools/agents/codex-hooks/*`, `git diff --check` |
| TypeScript behavior | `src/**/*.ts` | Targeted Vitest, `npm run build`, `npm test` |
| Safety policy | `src/safety.ts`, command parsing, approvals | Deny/approval/allow tests, `npm run build`, `npm test` |
| Discord control plane | slash commands, permissions, approvals, thread UX | Permission/state tests where possible, `npm run build`, `npm test` |
| Worker lifecycle | Codex JSONL, worktrees, cancellation, artifacts | Focused lifecycle tests, `npm run build`, `npm test` |
| VM/bootstrap | `scripts/**/*.sh`, `docs/utm-platform.md`, `systemd/**` | `bash -n` on touched scripts, document VM-only checks |
| Repo automation | CI, hooks, release, PR templates | Syntax checks, local equivalent commands, hosted-check note |
