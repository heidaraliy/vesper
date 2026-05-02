# UTM VM Platform

This guide sets up Vesper as a local, disposable Linux agent platform on an Apple Silicon Mac. The target shape is one GUI operator VM plus one clean headless agent-base VM that is snapshotted and cloned into individual agent VMs.

Use UTM in **Virtualize** mode with ARM64 Ubuntu guests. Do not use Emulate mode for this platform.

## Target Topology

```text
macOS Apple Silicon host
└── UTM
    ├── operator-gui
    │   ├── Ubuntu Desktop ARM64
    │   ├── browser
    │   ├── Discord/log viewing/manual checks
    │   └── terminal/admin tools
    │
    ├── agent-base
    │   ├── Ubuntu Server ARM64
    │   ├── Docker
    │   ├── Node.js/npm
    │   ├── Codex CLI
    │   ├── SQLite
    │   ├── git/build tools
    │   └── hardened default configuration
    │
    ├── agent-01
    └── agent-02
```

Recommended initial sizing:

| VM | OS | CPU | RAM | Disk |
| --- | --- | ---: | ---: | ---: |
| `operator-gui` | Ubuntu Desktop ARM64 | 4 cores | 8 GB | 100 GB |
| `agent-base` | Ubuntu Server ARM64 | 4 cores | 6 GB | 60 GB |
| `agent-01` | clone of `agent-base` | 2-4 cores | 4-6 GB | 60 GB |
| `agent-02` | clone of `agent-base` | 2-4 cores | 4-6 GB | 60 GB |

Add more agent VMs only after watching host CPU and memory pressure.

## Safety Rules

- Do not mount the macOS host filesystem read-write into agent VMs.
- Do not mount personal Mac directories, `~/.ssh`, dotfiles, `.env` files, or keychain material into agent VMs.
- Keep the GUI operator VM separate from the headless agent VMs.
- Build a clean `agent-base`, shut it down, snapshot it, then clone it.
- Run bot workers as a non-root user.
- Do not give Discord users direct shell execution.
- Route Discord commands through validation and a queue.
- Use one SQLite database per agent, or a controlled single-writer queue service.
- Avoid sharing one SQLite file between many writers.
- Avoid mounting `/var/run/docker.sock` into untrusted containers unless root-equivalent control of that VM is acceptable.
- Use per-VM or per-agent scoped credentials.
- Prefer deploy keys or fine-grained GitHub tokens over personal all-access tokens.

The intended execution flow is:

```text
Discord command
-> permission check
-> validated task inserted into SQLite queue
-> worker claims task
-> worker creates or reuses an isolated repo worktree
-> Codex CLI runs in a controlled workspace
-> result, logs, diff summary, and artifacts are recorded
-> bot posts completion back to Discord
```

Avoid this flow:

```text
Discord command
-> arbitrary shell command
```

## Install UTM

Install UTM from <https://mac.getutm.app/> or with Homebrew:

```bash
brew install --cask utm
```

Download ARM64 Ubuntu ISOs:

- Ubuntu Desktop ARM64 for `operator-gui`
- Ubuntu Server ARM64 for `agent-base`

Use the current supported Ubuntu ARM64 release from Ubuntu's official downloads. In UTM, choose **Virtualize**, **Linux**, and the ARM64 ISO.

## Create `operator-gui`

In UTM:

1. Create a new VM.
2. Choose **Virtualize**.
3. Choose **Linux**.
4. Select the Ubuntu Desktop ARM64 ISO.
5. Set CPU to 4 cores.
6. Set memory to 8192 MB.
7. Set disk to 100 GB.
8. Use NAT/shared networking.
9. Leave host shared folders disabled initially.
10. Install Ubuntu normally.

After Ubuntu boots, copy this repo into the VM or transfer only the script, then run:

```bash
sudo scripts/utm/bootstrap-operator-gui.sh
```

Useful variants:

```bash
sudo scripts/utm/bootstrap-operator-gui.sh --node-major 22
sudo scripts/utm/bootstrap-operator-gui.sh --skip-codex
```

Then reboot:

```bash
sudo reboot
```

Use `operator-gui` for dashboards, browser checks, Discord/manual checks, logs, and administration. Keep dangerous automation in agent VMs.

## Create `agent-base`

In UTM:

1. Create a new VM.
2. Choose **Virtualize**.
3. Choose **Linux**.
4. Select the Ubuntu Server ARM64 ISO.
5. Set CPU to 4 cores.
6. Set memory to 6144 MB.
7. Set disk to 60 GB.
8. Use NAT/shared networking.
9. Leave host shared folders disabled.
10. Enable OpenSSH during Ubuntu install if offered.
11. Install Ubuntu normally.

After Ubuntu boots, copy or clone this repo inside the VM, then run:

```bash
sudo scripts/utm/bootstrap-agent-base.sh
```

Useful variants:

```bash
sudo scripts/utm/bootstrap-agent-base.sh --agent-id agent-01
sudo scripts/utm/bootstrap-agent-base.sh --node-major 22
sudo scripts/utm/bootstrap-agent-base.sh --skip-codex
sudo scripts/utm/bootstrap-agent-base.sh --skip-docker
```

The script installs SSH, guest tools, Git, GitHub CLI, Node/npm, Codex CLI, SQLite, Docker, Go, C/C++ build tools, Python, Neovim, and common CLI tools. It creates a non-root `agent` user and initializes the first agent queue database.

After the script finishes:

```bash
codex login
gh auth login
newgrp docker
```

Authenticate as the user that will actually run Vesper and Codex. Do not add the `agent` user to sudo by default.

## Agent Layout

The bootstrap creates this layout:

```text
/srv/vesper/
  agents/
    agent-01/
      data/
        agent.sqlite
      workspace/
      logs/
      codex-home/
      .env
```

`sql/agent-queue.sql` defines the minimal queue tables:

- `tasks`
- `task_logs`

It enables WAL mode, a busy timeout, normal sync, and foreign keys. Keep SQLite local to each VM unless you add a proper queue service.

## Worker Service Template

`systemd/vesper-worker@.service` is a template for a future worker process:

```bash
sudo cp systemd/vesper-worker@.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vesper-worker@agent-01
```

The template expects a worker executable at:

```text
/usr/local/bin/vesper-worker
```

It also expects per-agent config at:

```text
/srv/vesper/agents/agent-01/.env
```

The current Vesper app does not install that worker binary yet; this service file is scaffolding for the queue-based worker milestone.

## Preferred Codex Shape

Run Codex inside a project worktree, not at the VM root:

```bash
codex \
  --cd /srv/vesper/agents/agent-01/workspace/my-repo \
  --ask-for-approval never \
  --sandbox workspace-write
```

Avoid dangerous bypass/full-access modes unless the VM is disposable, contains no sensitive credentials, and has no mounted host data.

## Clone `agent-base`

After validating `agent-base`:

1. Shut down the VM cleanly.
2. Create a snapshot named `agent-base-clean`.
3. Clone `agent-base` to `agent-01`.
4. Clone `agent-base` to `agent-02`.
5. Boot each clone one at a time.
6. Change hostname if needed:

```bash
sudo hostnamectl set-hostname agent-01
```

7. Adjust `/srv/vesper/agents/<agent-id>` if you want each VM to use its matching ID.
8. Keep host shared folders disabled.
9. Create a fresh snapshot before letting users run tasks.

## Validation Checklist

On `operator-gui`:

```bash
node --version
npm --version
git --version
gh --version
sqlite3 --version
codex --version
systemctl status qemu-guest-agent --no-pager
```

On `agent-base`:

```bash
systemctl status ssh --no-pager
systemctl status qemu-guest-agent --no-pager
node --version
npm --version
git --version
gh --version
go version
sqlite3 --version
docker run --rm hello-world
docker compose version
codex --version
sudo -u agent sqlite3 /srv/vesper/agents/agent-01/data/agent.sqlite '.tables'
```

Before production use:

- `agent-base` is snapshotted as `agent-base-clean`.
- `agent-01` and `agent-02` are clones, not the base image.
- No macOS host folders are mounted into agent VMs.
- Discord users cannot run arbitrary shell commands.
- Bot commands go through validation and queueing.
- Credentials are scoped per VM or agent.
- Project repos and worktrees live inside the VM.
