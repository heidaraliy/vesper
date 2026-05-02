#!/usr/bin/env bash
set -euo pipefail

# Example Codex pre-tool-use hook. Adapt to the JSON shape provided by the local
# Codex hook runner before enabling it.

branch="$(git branch --show-current 2>/dev/null || true)"
if [[ "$branch" == "main" || "$branch" == "master" ]]; then
  echo "blocked: do not edit tracked files from $branch" >&2
  exit 1
fi
