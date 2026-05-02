# Discord Control Plane Instructions

Use this for `src/discord-bot.ts`, `src/discord-commands.ts`, permissions, approvals, and thread UX.

## Invariants

- Discord is a control plane, not a shell.
- Every command must pass role-based permission checks before changing durable state or starting agents.
- Use typed slash-command inputs instead of free-form shell fields.
- Keep per-run discussion in a thread and preserve run IDs, artifact IDs, and PR links.
- Make plan-gated and automatic modes visible in the run state.

## UX Rules

- Prefer concise status updates that include run phase and the next required action.
- Include links or IDs for artifacts rather than dumping large logs into Discord.
- Approval flows must record approver, feedback, timestamp, run ID, and resulting phase.

## Validation

Cover command registration shape, permission gates, and state transitions with tests when changed.
