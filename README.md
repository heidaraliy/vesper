# Vesper

Vesper is a Discord-controlled, headless Codex orchestrator for running autonomous software work from a phone, tablet, or shared Discord server.

It is designed for a specific kind of workflow:

- keep a durable todo list for many projects
- pick a todo and spawn a Codex agent
- stream the agent's status, logs, artifacts, plans, and PR links into a Discord thread
- choose between plan-gated work and fully automatic PR creation
- persist memory, retrospectives, evaluations, and safety events so the system improves over time
- run the whole thing inside a disposable VM so the bot cannot touch your personal laptop data

Vesper is early, but the foundation is real: Discord slash commands, SQLite state, Codex JSONL streaming, role-based permissions, project readiness checks, artifacts, memory, approvals, and command safety classification.

## The Mental Model

Vesper has three layers:

1. **Discord control plane**
   Humans add todos, start agents, approve plans, cancel runs, inspect memory, and receive pings.

2. **Vesper daemon**
   A long-running Node process stores state in SQLite, starts Codex, creates artifacts, enforces permissions, and maps each run to a Discord thread.

3. **Codex worker**
   `codex exec --json` runs inside a project worktree and streams machine-readable events back to Vesper.

For production, all three layers should run inside a Linux VM.

## Why A VM?

Discord approval is not a security boundary. A VM is.

The recommended production setup is:

- Vesper runs inside a Linux VM.
- Codex CLI runs inside that VM.
- repos are cloned inside the VM.
- worktrees are created inside the VM.
- SQLite and artifacts live inside the VM.
- GitHub CLI auth lives inside the VM.
- Discord bot token lives inside the VM.
- your Mac home directory is not mounted.
- your Mac `~/.ssh`, `.env` files, dotfiles, keychain, and global credentials are not mounted.

If an agent ever destroys the VM, you delete the VM and restore from git plus Vesper artifact backups. Your Mac remains untouched.

Vesper also has a `local-dev` mode for solo development on your Mac, but automatic agents are disabled in that mode.

## Current Status

Implemented:

- Discord gateway bot
- slash command registration
- per-agent Discord threads
- SQLite-backed projects, todos, runs, artifacts, memory, approvals, and audit logs
- `codex exec --json` wrapper
- Codex stream parsing
- plan-gated and automatic autonomy modes
- project readiness checks
- role-based Discord permissions
- safety classifier for destructive commands, secrets, and piped installers
- artifact writing
- memory search/write commands
- TypeScript build and Vitest test suite

Not yet implemented:

- outer pre-exec command firewall before Codex executes shell commands
- VM provisioning scripts
- artifact backup/restore commands
- GitHub repo/issue importers
- rich Discord buttons/select menus
- two-person approval completion flow for scoped destructive commands
- web dashboard

The current safety layer detects command events from Codex and stops unsafe runs. The next hardening step should add Codex exec-policy hooks or an outer worker sandbox so unsafe commands are blocked before execution.

## Prerequisites

Inside the VM or development machine:

- Node.js 22+
- npm 11+
- Codex CLI installed and authenticated
- Git
- GitHub CLI, if you want PR creation
- a Discord application and bot token

Check local tools:

```bash
node --version
npm --version
codex --version
gh --version
git --version
```

Authenticate Codex:

```bash
codex login
```

Authenticate GitHub CLI if agents should push branches and create PRs:

```bash
gh auth login
gh auth status
```

## Create The Discord Bot

1. Open the Discord Developer Portal:
   <https://discord.com/developers/applications>

2. Create an application named `Vesper`.

3. Open **Bot**.

4. Create or reset the bot token.

5. Copy the token into `.env` as `DISCORD_TOKEN`.

6. Open **OAuth2** -> **General**.

7. Copy the application/client ID into `.env` as `DISCORD_CLIENT_ID`.

8. Invite the bot to your server with these scopes:

```text
bot
applications.commands
```

Recommended bot permissions:

```text
View Channels
Send Messages
Create Public Threads
Create Private Threads
Send Messages in Threads
Manage Threads
Read Message History
Use Slash Commands
Embed Links
Attach Files
```

9. Enable these privileged intents only if you later add message-content features:

```text
Message Content Intent
Server Members Intent
```

The current slash-command flow does not require message content intent.

## Find Your Discord Guild ID

Enable Discord developer mode:

```text
User Settings -> Advanced -> Developer Mode
```

Right-click your Discord server and choose **Copy Server ID**.

Put it in `.env` as:

```bash
DISCORD_GUILD_ID=your-server-id
```

## Install Vesper

```bash
git clone https://github.com/heidaraliy/vesper.git
cd vesper
npm install
cp .env.example .env
cp vesper.config.example.json vesper.config.json
```

Fill in `.env`:

```bash
DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-application-client-id
DISCORD_GUILD_ID=your-development-guild-id
VESPER_OWNER_IDS=your-discord-user-id
```

Build and test:

```bash
npm run build
npm test
```

Start the bot:

```bash
npm run dev
```

On startup, Vesper registers slash commands to the configured guild.

## Configure Projects

Edit `vesper.config.json`.

Example:

```json
{
  "runtimeMode": "vm",
  "databasePath": "./data/vesper.db",
  "artifactRoot": "./data/artifacts",
  "codex": {
    "model": null,
    "reasoning": "high",
    "sandbox": "workspace-write",
    "approvalPolicy": "never"
  },
  "discord": {
    "clientId": "${DISCORD_CLIENT_ID}",
    "guildId": "${DISCORD_GUILD_ID}",
    "ownerIds": []
  },
  "projects": [
    {
      "name": "Lune",
      "slug": "lune",
      "path": "/home/vesper/projects/lune",
      "worktreeRoot": "/home/vesper/worktrees/lune",
      "buildCommand": "cpp/tools/dev/lune build",
      "testCommand": "cpp/tools/dev/lune test",
      "profile": "lune",
      "gitRequired": true
    }
  ]
}
```

Fields:

| Field | Meaning |
| --- | --- |
| `runtimeMode` | `vm` for production, `local-dev` for solo Mac development |
| `databasePath` | SQLite DB path |
| `artifactRoot` | run logs, plans, retrospectives, safety events |
| `codex.model` | optional Codex model override |
| `codex.reasoning` | `low`, `medium`, `high`, or `max` |
| `codex.sandbox` | Codex sandbox mode; use `workspace-write` |
| `codex.approvalPolicy` | Codex approval policy; Vesper currently expects `never` |
| `projects[].slug` | short name used in Discord commands |
| `projects[].path` | repo clone path inside the VM |
| `projects[].worktreeRoot` | where Vesper creates git worktrees |
| `projects[].buildCommand` | project build command inserted into prompts |
| `projects[].testCommand` | project test command inserted into prompts |
| `projects[].profile` | project instruction profile label |
| `projects[].gitRequired` | block agents unless `.git` exists |

## Lune Setup

Inside the VM:

```bash
mkdir -p /home/vesper/projects /home/vesper/worktrees
cd /home/vesper/projects
git clone git@github.com:heidaraliy/lune.git
```

Configure:

```json
{
  "name": "Lune",
  "slug": "lune",
  "path": "/home/vesper/projects/lune",
  "worktreeRoot": "/home/vesper/worktrees/lune",
  "buildCommand": "cpp/tools/dev/lune build",
  "testCommand": "cpp/tools/dev/lune test",
  "profile": "lune",
  "gitRequired": true
}
```

Lune already has mature agent guidance:

- `AGENTS.md`
- `CLAUDE.md`
- `.codex/skills`
- `tools/agents`
- build/test wrappers

Vesper treats those as project-local authority. It does not copy those instructions into global prompts.

Recommended workflow:

1. Vesper agent works in VM clone/worktree.
2. Agent pushes branch and opens PR.
3. You pull the PR branch locally on your Mac for playtesting.
4. Merge after review.

## Navia Setup

Navia is a Go/Bubble Tea project. If your local copy is not a git repo yet, initialize it before using automatic mode:

```bash
cd /home/vesper/projects/navia
git init
git remote add origin git@github.com:heidaraliy/navia.git
```

Add an `AGENTS.md` before automatic runs. Until then, Vesper should be used in `plan-gated` mode only.

Suggested Navia config:

```json
{
  "name": "Navia",
  "slug": "navia",
  "path": "/home/vesper/projects/navia",
  "worktreeRoot": "/home/vesper/worktrees/navia",
  "buildCommand": "go test ./...",
  "testCommand": "go test ./...",
  "profile": "go-bubbletea",
  "gitRequired": true
}
```

## Discord Roles

Create these roles in your Discord server:

| Role | Capability |
| --- | --- |
| `Vesper Viewer` | inspect status |
| `Vesper Requester` | create todos |
| `Vesper Operator` | start/cancel agents, write memory |
| `Vesper Approver` | approve plan-gated runs |
| `Vesper Owner` | full access |

Users listed in `VESPER_OWNER_IDS` are owners even without roles.

Role inheritance:

- owner includes approver, operator, requester, viewer
- approver includes operator, requester, viewer
- operator includes requester, viewer

## Commands

Project commands:

```text
/project list
/project inspect project:lune
```

Todo commands:

```text
/todo add project:lune title:"Fix tooltip spacing" body:"Make the left margin 2px tighter." mode:automatic
/todo add project:lune title:"Design combat lab" body:"Explore implementation options." mode:plan-gated
/todo list project:lune
/todo pick todo:todo_xxxxxxxxxxxx
```

Agent commands:

```text
/agent spawn project:lune prompt:"Investigate how to add combat lab frame step controls." mode:plan-gated
/agent approve run:run_xxxxxxxxxxxx
/agent approve run:run_xxxxxxxxxxxx feedback:"Use the smaller UI-only approach."
/agent cancel run:run_xxxxxxxxxxxx
/agent status
```

Memory commands:

```text
/memory write project:lune title:"Golden replay rule" content:"Run golden record/verify when deterministic simulation output changes."
/memory search project:lune query:"golden replay"
```

## Autonomy Modes

### `plan-gated`

The agent:

1. reads project instructions
2. gathers context
3. writes a decision-complete plan
4. stops
5. waits for `/agent approve`

Use this for exploratory, architectural, risky, or ambiguous work.

### `automatic`

The agent may:

1. plan
2. implement
3. build/test
4. commit
5. push
6. open a PR

Use this for narrow tasks where you already know what you want.

Automatic mode is disabled in `local-dev`.

## Safety Policy

Vesper's current policy:

- deny commands that appear to access secrets:
  - `.env`
  - `.ssh`
  - private keys
  - credentials
  - tokens
- deny piped network installers:
  - `curl ... | bash`
  - `wget ... | sh`
- deny broad destructive deletes:
  - `rm -rf /`
  - `rm -rf ~`
  - `rm -rf .`
  - deleting repo roots
  - deleting worktree roots
  - deleting artifact roots
  - deleting DB paths
- require approval for destructive commands
- require two approvals for scoped cleanup deletes such as:
  - `build/`
  - `dist/`
  - `.cache/`
  - `node_modules/`
  - `coverage/`

Important: the current implementation observes Codex command events and kills unsafe runs. For stronger production safety, add a pre-execution command firewall through Codex hooks, exec policy, or a dedicated worker sandbox.

## Recommended VM Layout

```text
/home/vesper/
  app/vesper/             # this repo
  projects/lune/          # normal clone
  projects/navia/         # normal clone
  worktrees/lune/         # Vesper-created worktrees
  worktrees/navia/
  data/vesper.db
  data/artifacts/
```

Do not mount:

```text
/Users/yourname
~/.ssh from your Mac
Mac .env files
Mac dotfiles
Mac keychain material
```

## Backups

Back up:

```text
data/vesper.db
data/artifacts/
vesper.config.json
```

Do not back up:

```text
node_modules/
worktrees/
cloned repos/
temporary build outputs/
```

Repos and worktrees should be recoverable from GitHub.

## Development

```bash
npm install
npm run build
npm test
npm run dev
```

Test files live beside source:

```text
src/*.test.ts
```

Current checks:

```bash
npm run build
npm test
```

## First Run Checklist

1. Create Discord application.
2. Invite bot with `bot` and `applications.commands`.
3. Create Discord roles.
4. Copy `.env.example` to `.env`.
5. Fill `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, and `VESPER_OWNER_IDS`.
6. Copy `vesper.config.example.json` to `vesper.config.json`.
7. Clone target repos inside VM.
8. Confirm each target repo has `.git`.
9. Confirm each automatic-mode project has `AGENTS.md` or `CLAUDE.md`.
10. Run `npm install`.
11. Run `npm run build`.
12. Run `npm test`.
13. Run `npm run dev`.
14. In Discord, run `/project list`.
15. Add a tiny `plan-gated` todo.
16. Approve the plan only after inspecting it.
17. Try a tiny `automatic` todo after the plan-gated flow works.

## Troubleshooting

### Slash commands do not show up

- confirm `DISCORD_CLIENT_ID`
- confirm `DISCORD_GUILD_ID`
- confirm the bot was invited with `applications.commands`
- restart Vesper and watch logs for command registration errors

### Bot cannot create threads

Check bot permissions:

- Create Public Threads
- Create Private Threads
- Send Messages in Threads
- Manage Threads
- Read Message History

### Codex fails

Inside the VM:

```bash
codex login
codex exec "Say hello" --sandbox workspace-write --json
```

### GitHub PR creation fails

Inside the VM:

```bash
gh auth status
git remote -v
git push --dry-run
```

### Project says `needs_git`

The project path exists, but `.git` is missing. Clone the repo normally or initialize git.

### Project says `needs_agents`

The project has no `AGENTS.md` or `CLAUDE.md`. Plan-gated mode may still be useful, but automatic mode is blocked until project instructions exist.

## Roadmap

Near-term:

- pre-execution command firewall
- Discord buttons and select menus
- complete two-approver destructive approval flow
- `vesper doctor`
- VM provisioning script
- GitHub PR creation helper
- artifact backup/restore command
- project bootstrap command that writes initial `AGENTS.md`

Later:

- web dashboard
- GitHub Issues sync
- markdown todo import/export
- richer eval system
- self-improvement proposal queue
- per-project prompt profiles
- remote worker pool

## License

MIT.
