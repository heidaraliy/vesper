#!/usr/bin/env bash
set -euo pipefail

NODE_MAJOR="${NODE_MAJOR:-22}"
INSTALL_CODEX="${INSTALL_CODEX:-1}"

usage() {
  cat <<'USAGE'
Usage: scripts/utm/bootstrap-operator-gui.sh [options]

Configure an Ubuntu Desktop ARM64 UTM VM for operator use: guest tools,
browser-adjacent utilities, terminal/admin tools, Node/npm, SQLite, Python,
and optional Codex CLI.

Options:
  --node-major <n>       Node.js major version to install (default: 22)
  --skip-codex           Do not install Codex CLI
  -h, --help             Show this help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --node-major)
      NODE_MAJOR="${2:?missing value for --node-major}"
      shift 2
      ;;
    --skip-codex)
      INSTALL_CODEX=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=()
else
  SUDO=(sudo)
fi

log() {
  printf '\n==> %s\n' "$*"
}

apt_install() {
  "${SUDO[@]}" apt-get install -y --no-install-recommends "$@"
}

install_node() {
  log "Installing Node.js ${NODE_MAJOR}.x"
  "${SUDO[@]}" install -d -m 0755 /etc/apt/keyrings
  "${SUDO[@]}" rm -f /etc/apt/keyrings/nodesource.gpg
  curl -fsSL "https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key" \
    | "${SUDO[@]}" gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  "${SUDO[@]}" chmod 0644 /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    | "${SUDO[@]}" tee /etc/apt/sources.list.d/nodesource.list >/dev/null
  "${SUDO[@]}" apt-get update
  apt_install nodejs
  "${SUDO[@]}" npm install -g npm@latest
  "${SUDO[@]}" corepack enable || true
}

install_github_cli() {
  log "Installing GitHub CLI"
  "${SUDO[@]}" install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | "${SUDO[@]}" tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null
  "${SUDO[@]}" chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | "${SUDO[@]}" tee /etc/apt/sources.list.d/github-cli.list >/dev/null
  "${SUDO[@]}" apt-get update
  apt_install gh
}

install_codex() {
  if [[ "${INSTALL_CODEX}" != "1" ]]; then
    log "Skipping Codex CLI"
    return
  fi
  log "Installing Codex CLI"
  "${SUDO[@]}" npm install -g @openai/codex
}

log "Updating operator GUI VM"
"${SUDO[@]}" apt-get update
"${SUDO[@]}" apt-get upgrade -y

log "Installing UTM guest support and operator tools"
apt_install \
  spice-vdagent \
  qemu-guest-agent \
  spice-webdavd \
  git \
  curl \
  ca-certificates \
  gnupg \
  jq \
  htop \
  tmux \
  unzip \
  zip \
  rsync \
  ripgrep \
  fd-find \
  sqlite3 \
  build-essential \
  python3 \
  python3-venv \
  python3-pip \
  python3-dev \
  neovim \
  fzf \
  xclip \
  wl-clipboard

log "Enabling guest services"
"${SUDO[@]}" systemctl enable --now qemu-guest-agent || true
"${SUDO[@]}" systemctl enable --now spice-vdagent || true

install_node
install_github_cli
install_codex

log "Operator GUI bootstrap complete"
cat <<'EOF'

Next:
  1. Reboot the VM.
  2. Run `codex login` if you installed Codex.
  3. Use this VM for dashboards, Discord/manual checks, browser checks, and administration.
  4. Keep dangerous agent execution in headless agent VMs, not this operator VM.
EOF
