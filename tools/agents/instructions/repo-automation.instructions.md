# Repo Automation Instructions

Use this for `.github/**`, releases, install docs, git helpers, publishing, and draft PR workflow.

## PR Hygiene

- Keep commits scoped and messages explicit.
- Use draft PRs for agent-created feature work until a human reviews.
- PR bodies should include summary, validation, and residual risk.
- Do not include secrets, Discord tokens, Codex auth files, or VM-local `.env` material in commits.

## CI Expectations

- TypeScript build should run `npm run build`.
- Tests should run `npm test`.
- Shell script checks should run at least `bash -n` on tracked shell scripts.

Use `tools/agents/templates/pr-body.md` for PR descriptions.
