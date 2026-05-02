# Memory And Evals Instructions

Use this for `src/memory.ts`, retrospectives, eval artifacts, run scoring, and regression checks.

## Memory Rules

- Treat memory as evidence with timestamps and project/run context.
- Do not let memory override current repo state when source files or commands are cheap to verify.
- Store retrospectives that explain what failed, what fixed it, and what should be routed earlier next time.

## Eval Rules

- Make evals parsable and tied to a concrete run, artifact, or fixture.
- Prefer small regression cases over broad prose checklists.
- Include safety, Discord permission, worker lifecycle, and artifact durability cases.

Load `tools/agents/evals/run-lifecycle-evals.md` and `tools/agents/evals/safety-evals.md` when designing eval coverage.
