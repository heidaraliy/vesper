---
name: vesper-safety-engineer
description: Safety and guardrail workflow for Vesper. Use for command classification, approval policy, secrets handling, destructive command blocking, protected paths, sandbox defaults, audit artifacts, and security-boundary reviews.
---

# Vesper Safety Engineer

Load `tools/agents/instructions/safety-guardrails.instructions.md` and `tools/agents/guardrails/command-safety-policy.md`.

## Non-Negotiables

- Discord approval is not a security boundary; VM isolation is.
- Deny secrets and credential-looking commands.
- Deny piped network installers.
- Deny broad destructive deletes and protected path targets.
- Approval-gate scoped destructive cleanup.
- Persist safety artifacts for non-allow decisions.

## Validation

Update `src/safety.test.ts` for allow, deny, and approval-required paths. Run targeted safety tests, then `npm run build` and `npm test`.
