---
name: vesper-discord-engineer
description: Discord control-plane workflow for Vesper. Use for slash commands, Discord bot lifecycle, role permissions, approvals, thread UX, run status updates, command registration, and human-in-the-loop flows.
---

# Vesper Discord Engineer

Load `tools/agents/instructions/discord-control-plane.instructions.md`.

## Rules

- Keep Discord as typed control plane, not shell access.
- Gate state-changing commands by role.
- Record approvals with actor, feedback, run ID, and timestamp.
- Keep per-run status in threads with artifact IDs or links.
- Make plan-gated versus automatic modes visible.

## Validation

Add tests for permission gates and state transitions when possible. Run `npm run build` and `npm test`.
