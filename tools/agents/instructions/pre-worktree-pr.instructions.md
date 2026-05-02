# Pre-Worktree And PR Instructions

Use this before repo-tracked implementation, commit, push, worktree setup, or PR work.

## Branch Gate

- Do not implement, commit, or push feature work from `main` or `master`.
- Prefer a feature worktree under `~/programs/wt` with a branch named `agent/<slug>`.
- Use `python3 tools/agents/scripts/pre_worktree.py "<feature name>"` from the root checkout when creating a new worktree.
- If a user explicitly asks for local-only exploration, keep it uncommitted and say which validation was run.

## Preflight

Run:

```bash
git status --short --branch
git branch --show-current
```

If the worktree is dirty, identify whether the dirty files belong to this task. Never revert unrelated user changes.

## Publish Default

For completed feature work, prepare a clean commit, push the branch, and open a draft PR unless the user explicitly says `local-only`, `no-commit`, or `no-PR`.

## Validation Before Publish

- Agent config/docs-only changes: run the validation commands in `tools/agents/README.md`.
- TypeScript behavior changes: run targeted tests, then `npm run build` and `npm test`.
- VM shell changes: run `bash -n` on touched shell scripts and document any checks that require a real VM.
