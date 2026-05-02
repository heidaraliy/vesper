# TypeScript Runtime Instructions

Use this for `src/**/*.ts`, npm scripts, build tooling, and Vitest coverage.

## Runtime Rules

- Keep ESM imports explicit with `.js` suffixes for local TypeScript modules.
- Keep public types in `src/types.ts` unless a narrow local type is clearer.
- Prefer Zod validation for config and external input.
- Preserve durable database and artifact writes before reporting completion to Discord.
- Avoid hidden background promises unless errors are routed to `failRun` or a logged artifact.

## Tests

- Add or update focused Vitest tests next to the behavior.
- Run targeted tests while debugging, then `npm run build` and `npm test`.
- For command parsing, queue, or safety logic, include denial/approval/allow examples.
