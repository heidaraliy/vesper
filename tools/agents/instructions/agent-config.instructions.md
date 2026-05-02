# Agent Config Instructions

Use this for `AGENTS.md`, `.codex/skills/**`, `tools/agents/**`, hooks, evals, guardrails, and prompt artifacts.

## Shape

- Keep root `AGENTS.md` sparse and outcome-first.
- Put detailed task routing in `tools/agents/instructions/index.md`.
- Put reusable domain workflows in `.codex/skills/*/SKILL.md`.
- Put deterministic checks in `tools/agents/scripts/`.
- Put optional examples in `tools/agents/codex-hooks/`; do not imply they are enabled.

## Skill Rules

- Use lowercase hyphenated skill names.
- Make descriptions triggerable and specific.
- Keep skill bodies concise; route detailed policy to `tools/agents/**`.
- Add a repo skill only when it removes repeated context gathering or captures a durable domain workflow.

## Required Checks

```bash
python3 tools/agents/scripts/validate_agent_config.py
bash -n tools/agents/git-hooks/* tools/agents/codex-hooks/*
git diff --check
```

Run `python3 tools/agents/scripts/assert_worktree_ready.py --allow-dirty-agent-config` only from a feature branch or when validating that the branch gate works.
