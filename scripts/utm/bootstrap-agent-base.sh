#!/usr/bin/env bash
set -euo pipefail

NODE_MAJOR="${NODE_MAJOR:-22}"
AGENT_USER="${AGENT_USER:-agent}"
AGENT_ID="${AGENT_ID:-agent-01}"
VESPER_ROOT="${VESPER_ROOT:-/srv/vesper}"
INSTALL_CODEX="${INSTALL_CODEX:-1}"
INSTALL_DOCKER="${INSTALL_DOCKER:-1}"

usage() {
  cat <<'USAGE'
Usage: scripts/utm/bootstrap-agent-base.sh [options]

Configure an Ubuntu Server ARM64 UTM VM as a hardened agent-base image.
Run this inside the freshly installed agent-base VM before snapshotting/cloning.

Options:
  --node-major <n>       Node.js major version to install (default: 22)
  --agent-user <name>    Non-root worker user to create (default: agent)
  --agent-id <id>        Initial agent directory name (default: agent-01)
  --root <path>          Vesper runtime root (default: /srv/vesper)
  --skip-codex           Do not install Codex CLI
  --skip-docker          Do not install Docker packages
  -h, --help             Show this help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --node-major)
      NODE_MAJOR="${2:?missing value for --node-major}"
      shift 2
      ;;
    --agent-user)
      AGENT_USER="${2:?missing value for --agent-user}"
      shift 2
      ;;
    --agent-id)
      AGENT_ID="${2:?missing value for --agent-id}"
      shift 2
      ;;
    --root)
      VESPER_ROOT="${2:?missing value for --root}"
      shift 2
      ;;
    --skip-codex)
      INSTALL_CODEX=0
      shift
      ;;
    --skip-docker)
      INSTALL_DOCKER=0
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
QUEUE_SQL="${REPO_ROOT}/sql/agent-queue.sql"

log() {
  printf '\n==> %s\n' "$*"
}

apt_install() {
  "${SUDO[@]}" apt-get install -y --no-install-recommends "$@"
}

run_as_agent() {
  if [[ "$(id -u)" -eq 0 ]]; then
    runuser -u "${AGENT_USER}" -- "$@"
  else
    sudo -u "${AGENT_USER}" "$@"
  fi
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

install_docker() {
  if [[ "${INSTALL_DOCKER}" != "1" ]]; then
    log "Skipping Docker"
    return
  fi
  log "Installing Docker"
  apt_install docker.io docker-compose-v2
  "${SUDO[@]}" systemctl enable --now docker
  "${SUDO[@]}" usermod -aG docker "$USER" || true
}

install_codex() {
  if [[ "${INSTALL_CODEX}" != "1" ]]; then
    log "Skipping Codex CLI"
    return
  fi
  log "Installing Codex CLI"
  "${SUDO[@]}" npm install -g @openai/codex
}

create_agent_user() {
  log "Creating non-root ${AGENT_USER} user"
  if ! id "${AGENT_USER}" >/dev/null 2>&1; then
    "${SUDO[@]}" adduser --disabled-password --gecos "" "${AGENT_USER}"
  fi
}

create_layout() {
  local agent_root="${VESPER_ROOT}/agents/${AGENT_ID}"
  log "Creating ${agent_root}"
  "${SUDO[@]}" mkdir -p "${agent_root}"/{data,workspace,logs,codex-home}
  "${SUDO[@]}" touch "${agent_root}/.env"
  "${SUDO[@]}" chmod 0600 "${agent_root}/.env"
  "${SUDO[@]}" chown -R "${AGENT_USER}:${AGENT_USER}" "${VESPER_ROOT}"
}

init_sqlite() {
  local db_path="${VESPER_ROOT}/agents/${AGENT_ID}/data/agent.sqlite"
  log "Initializing SQLite queue at ${db_path}"
  if [[ ! -f "${QUEUE_SQL}" ]]; then
    echo "Missing queue schema: ${QUEUE_SQL}" >&2
    exit 1
  fi
  run_as_agent sqlite3 "${db_path}" < "${QUEUE_SQL}"
}

log "Updating agent-base VM"
"${SUDO[@]}" apt-get update
"${SUDO[@]}" apt-get upgrade -y

log "Installing base server, build, and guest packages"
apt_install \
  openssh-server \
  qemu-guest-agent \
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
  libsqlite3-dev \
  build-essential \
  gcc \
  g++ \
  clang \
  clang-format \
  clang-tidy \
  cmake \
  ninja-build \
  gdb \
  make \
  pkg-config \
  python3 \
  python3-venv \
  python3-pip \
  python3-dev \
  golang-go \
  neovim

log "Enabling server services"
"${SUDO[@]}" systemctl enable --now ssh
"${SUDO[@]}" systemctl enable --now qemu-guest-agent || true

install_node
install_github_cli
install_docker
install_codex
create_agent_user
create_layout
init_sqlite

log "Agent-base bootstrap complete"
cat <<EOF

Important:
  - Log out and back in, or run 'newgrp docker', before using Docker as $USER.
  - Run 'codex login' for the user that will invoke Codex.
  - Do not add ${AGENT_USER} to sudo by default.
  - Shut down this VM and snapshot it as agent-base-clean before cloning.

Validation:
  systemctl status ssh --no-pager
  systemctl status qemu-guest-agent --no-pager
  docker run --rm hello-world
  codex --version
  sudo -u ${AGENT_USER} sqlite3 ${VESPER_ROOT}/agents/${AGENT_ID}/data/agent.sqlite '.tables'
EOF
