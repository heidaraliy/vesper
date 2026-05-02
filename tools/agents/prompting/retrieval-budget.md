# Retrieval Budget

Start with targeted local evidence.

1. Read `AGENTS.md`.
2. Read `tools/agents/instructions/index.md`.
3. Read matching instruction files.
4. Load relevant `.codex/skills/**/SKILL.md`.
5. Use `rg` for owning modules and nearby tests.
6. Read only the source files needed to explain current behavior.

For Vesper, common anchors are:

- `src/core.ts` for run lifecycle
- `src/codex.ts` for Codex JSONL
- `src/safety.ts` for command policy
- `src/projects.ts` for readiness and worktrees
- `src/discord-commands.ts` and `src/discord-bot.ts` for control plane
- `docs/utm-platform.md` and `scripts/utm/**` for VM setup
