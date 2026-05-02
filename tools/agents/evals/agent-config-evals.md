# Agent Config Evals

Run after changing `AGENTS.md`, `.codex/skills/**`, or `tools/agents/**`.

## Required

```bash
python3 tools/agents/scripts/validate_agent_config.py
bash -n tools/agents/git-hooks/* tools/agents/codex-hooks/*
git diff --check
```

## Manual Spot Checks

- Root `AGENTS.md` stays sparse and routes detail.
- Every instruction file named in `tools/agents/instructions/index.md` exists.
- Every skill has frontmatter `name` and a triggerable `description`.
- Hooks describe opt-in behavior and do not pretend to be installed.
