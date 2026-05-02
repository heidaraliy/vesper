# Reasoning Profiles

Use the lightest profile that can handle the risk.

| Profile | Use for |
| --- | --- |
| Fast local | Docs, small tests, simple refactors, clearly bounded fixes |
| Standard | Most TypeScript features, Discord UX, worker lifecycle, PR packaging |
| Deep safety | Command policy, sandbox defaults, VM isolation, credentials, queue concurrency |
| Audit | Independent plan review or final diff review |

Escalate reasoning when a change crosses Discord input, shell execution, credentials, VM isolation, or durable state.
