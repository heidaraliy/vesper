---
name: vesper-memory-evals-engineer
description: Memory and evaluation workflow for Vesper. Use for project memory, retrospectives, run scoring, evaluation artifacts, safety regressions, lifecycle evals, and agent-quality feedback loops.
---

# Vesper Memory And Evals Engineer

Load `tools/agents/instructions/memory-evals.instructions.md` and matching files under `tools/agents/evals/`.

## Rules

- Treat memory as evidence, not as a replacement for current repo verification.
- Keep retrospectives concrete: trigger, failure, fix, and future routing.
- Make evals small, parsable, and tied to a run or fixture.
- Cover safety, Discord permissions, worker lifecycle, artifact durability, and VM assumptions.

## Validation

Prefer focused tests or fixtures over prose-only evals when behavior exists in code.
