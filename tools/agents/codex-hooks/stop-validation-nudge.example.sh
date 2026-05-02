#!/usr/bin/env bash
set -euo pipefail

# Example Codex stop hook. Keep as an opt-in reminder, not mandatory policy.

if git diff --quiet --exit-code; then
  exit 0
fi

cat >&2 <<'MSG'
Before final response, report validation:
- docs/agent config: validate_agent_config, bash -n hooks, git diff --check
- TypeScript: targeted tests, npm run build, npm test
- VM scripts: bash -n touched scripts
MSG
