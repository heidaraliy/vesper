# Discord Permission Policy

Use this when changing Discord commands, roles, approvals, or run controls.

- View/list commands may be available to trusted project members.
- Creating todos and spawning plan-gated runs requires a project operator role.
- Automatic implementation runs require a higher-trust automation role.
- Approval actions must record approver ID and optional feedback.
- Cancellation must be available to the requester and operators.
- No command may accept arbitrary shell text for execution.
- Destructive or credential-touching operations must not be exposed through Discord.
