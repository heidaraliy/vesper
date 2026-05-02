---
name: vesper-build-engineer
description: Build, test, and package workflow for Vesper. Use for TypeScript, npm scripts, Vitest, dependency updates, CLI packaging, local runs, CI equivalents, and validation triage.
---

# Vesper Build Engineer

Use existing npm scripts first.

## Commands

- Type check: `npm run build`
- Full tests: `npm test`
- Watch tests: `npm run test:watch`
- Local dev: `npm run dev`
- Production start after build packaging exists: `npm start`

## Rules

- Run targeted Vitest tests while debugging.
- Broaden to `npm run build` and `npm test` before finalizing behavior changes.
- Avoid dependency churn unless required by the task.
- Preserve ESM local imports with `.js` suffixes.
- For shell scripts, run `bash -n` on touched files.
