#!/usr/bin/env bash
set -euo pipefail

NODE_MAJOR="${NODE_MAJOR:-22}"
GO_VERSION="${GO_VERSION:-}"
INSTALL_CODEX="${INSTALL_CODEX:-1}"
INSTALL_GO="${INSTALL_GO:-1}"
INSTALL_CPP="${INSTALL_CPP:-1}"
INSTALL_RUST="${INSTALL_RUST:-1}"
CREATE_USER="${CREATE_USER:-0}"
VESPER_USER="${VESPER_USER:-vesper}"

usage() {
  cat <<'USAGE'
Usage: scripts/bootstrap-vm.sh [options]

Bootstrap an Ubuntu/Debian VM for running Vesper, Codex, GitHub CLI, Node,
Go, Rust, Python, and common C/C++ build tooling.

Options:
  --node-major <n>       Node.js major version to install (default: 22)
  --go-version <v>       Install Go from go.dev tarball instead of apt, e.g. 1.23.6
  --skip-codex           Do not install the Codex CLI npm package
  --skip-go              Do not install Go
  --skip-cpp             Do not install C/C++ build dependencies
  --skip-rust            Do not install Rust packages
  --create-user          Create a non-root "vesper" user and workspace dirs
  --user <name>          User name for --create-user (default: vesper)
  -h, --help             Show this help

Environment overrides:
  NODE_MAJOR=22
  GO_VERSION=1.23.6
  INSTALL_CODEX=1
  INSTALL_GO=1
  INSTALL_CPP=1
  INSTALL_RUST=1
  CREATE_USER=0
  VESPER_USER=vesper

After this script finishes, run these manually:
  codex login
  gh auth login
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --node-major)
      NODE_MAJOR="${2:?missing value for --node-major}"
      shift 2
      ;;
    --go-version)
      GO_VERSION="${2:?missing value for --go-version}"
      shift 2
      ;;
    --skip-codex)
      INSTALL_CODEX=0
      shift
      ;;
    --skip-go)
      INSTALL_GO=0
      shift
      ;;
    --skip-cpp)
      INSTALL_CPP=0
      shift
      ;;
    --skip-rust)
      INSTALL_RUST=0
      shift
      ;;
    --create-user)
      CREATE_USER=1
      shift
      ;;
    --user)
      VESPER_USER="${2:?missing value for --user}"
      shift 2
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

if [[ "$(id -u)" -ne 0 ]]; then
  echo "This script needs root privileges. Re-run with sudo:" >&2
  echo "  sudo $0 $*" >&2
  exit 1
fi

if [[ ! -f /etc/os-release ]]; then
  echo "Cannot detect OS: /etc/os-release is missing." >&2
  exit 1
fi

. /etc/os-release
case "${ID:-}" in
  ubuntu|debian)
    ;;
  *)
    echo "Unsupported OS '${ID:-unknown}'. This script targets Ubuntu/Debian VMs." >&2
    exit 1
    ;;
esac

export DEBIAN_FRONTEND=noninteractive

log() {
  printf '\n==> %s\n' "$*"
}

apt_install() {
  apt-get install -y --no-install-recommends "$@"
}

install_base_packages() {
  log "Installing base packages"
  apt-get update
  apt_install \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    apt-transport-https \
    git \
    openssh-client \
    jq \
    unzip \
    zip \
    tar \
    xz-utils \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    pipx \
    software-properties-common \
    file \
    rsync \
    ripgrep \
    fd-find \
    shellcheck \
    pkg-config \
    sqlite3 \
    libsqlite3-dev
}

install_node() {
  log "Installing Node.js ${NODE_MAJOR}.x from NodeSource"
  install -d -m 0755 /etc/apt/keyrings
  rm -f /etc/apt/keyrings/nodesource.gpg
  curl -fsSL "https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key" \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  chmod 0644 /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt_install nodejs
  npm install -g npm@latest
  corepack enable || true
  node --version
  npm --version
  npx --version
}

install_github_cli() {
  log "Installing GitHub CLI"
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    -o /etc/apt/keyrings/githubcli-archive-keyring.gpg
  chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list
  apt-get update
  apt_install gh
  gh --version
}

install_go() {
  if [[ "${INSTALL_GO}" != "1" ]]; then
    log "Skipping Go"
    return
  fi

  if [[ -n "${GO_VERSION}" ]]; then
    log "Installing Go ${GO_VERSION} from go.dev"
    local arch
    arch="$(dpkg --print-architecture)"
    case "${arch}" in
      amd64) arch="amd64" ;;
      arm64) arch="arm64" ;;
      *) echo "Unsupported Go architecture: ${arch}" >&2; exit 1 ;;
    esac
    local tarball="go${GO_VERSION}.linux-${arch}.tar.gz"
    curl -fsSLO "https://go.dev/dl/${tarball}"
    rm -rf /usr/local/go
    tar -C /usr/local -xzf "${tarball}"
    rm -f "${tarball}"
    ln -sf /usr/local/go/bin/go /usr/local/bin/go
    ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt
  else
    log "Installing Go from apt"
    apt_install golang-go
  fi
  go version
}

install_cpp_deps() {
  if [[ "${INSTALL_CPP}" != "1" ]]; then
    log "Skipping C/C++ dependencies"
    return
  fi

  log "Installing C/C++ build dependencies"
  apt_install \
    build-essential \
    gcc \
    g++ \
    clang \
    clang-format \
    clang-tidy \
    lldb \
    lld \
    cmake \
    ninja-build \
    gdb \
    valgrind \
    make \
    autoconf \
    automake \
    libtool \
    ccache \
    libssl-dev \
    zlib1g-dev \
    libbz2-dev \
    libffi-dev \
    liblzma-dev \
    libreadline-dev \
    libncurses-dev \
    libxml2-dev \
    libxslt1-dev \
    libcurl4-openssl-dev \
    mesa-common-dev \
    libgl1-mesa-dev \
    libglu1-mesa-dev \
    libegl1-mesa-dev \
    libgles2-mesa-dev \
    libx11-dev \
    libxext-dev \
    libxfixes-dev \
    libxrender-dev \
    libxrandr-dev \
    libxi-dev \
    libxcursor-dev \
    libxinerama-dev \
    libwayland-dev \
    libxkbcommon-dev \
    libasound2-dev \
    libpulse-dev \
    libudev-dev \
    libsdl2-dev \
    libsdl2-image-dev \
    libsdl2-mixer-dev \
    libsdl2-ttf-dev \
    libfreetype6-dev \
    libpng-dev \
    libjpeg-dev \
    libopenal-dev \
    libogg-dev \
    libvorbis-dev \
    libglfw3-dev \
    libglm-dev \
    libvulkan-dev \
    vulkan-tools
}

install_rust() {
  if [[ "${INSTALL_RUST}" != "1" ]]; then
    log "Skipping Rust"
    return
  fi

  log "Installing Rust from apt"
  apt_install rustc cargo
  rustc --version
  cargo --version
}

install_codex() {
  if [[ "${INSTALL_CODEX}" != "1" ]]; then
    log "Skipping Codex CLI"
    return
  fi

  log "Installing Codex CLI"
  npm install -g @openai/codex
  codex --version || true
}

create_vesper_user() {
  if [[ "${CREATE_USER}" != "1" ]]; then
    return
  fi

  log "Creating ${VESPER_USER} user and workspace"
  if ! id "${VESPER_USER}" >/dev/null 2>&1; then
    useradd --create-home --shell /bin/bash "${VESPER_USER}"
  fi

  install -d -o "${VESPER_USER}" -g "${VESPER_USER}" "/home/${VESPER_USER}/app"
  install -d -o "${VESPER_USER}" -g "${VESPER_USER}" "/home/${VESPER_USER}/projects"
  install -d -o "${VESPER_USER}" -g "${VESPER_USER}" "/home/${VESPER_USER}/worktrees"
  install -d -o "${VESPER_USER}" -g "${VESPER_USER}" "/home/${VESPER_USER}/data/artifacts"
}

write_profile() {
  log "Writing global toolchain profile"
  cat >/etc/profile.d/vesper-toolchain.sh <<'EOF'
# Vesper VM toolchain paths.
if [ -d /usr/local/go/bin ]; then
  case ":$PATH:" in
    *:/usr/local/go/bin:*) ;;
    *) export PATH="/usr/local/go/bin:$PATH" ;;
  esac
fi

if [ -d "$HOME/.cargo/bin" ]; then
  case ":$PATH:" in
    *:"$HOME/.cargo/bin":*) ;;
    *) export PATH="$HOME/.cargo/bin:$PATH" ;;
  esac
fi
EOF
  chmod 0644 /etc/profile.d/vesper-toolchain.sh
}

print_versions() {
  log "Installed tool versions"
  for cmd in git node npm npx gh go gcc g++ clang clang++ cmake ninja python3 sqlite3 codex rustc cargo; do
    if command -v "${cmd}" >/dev/null 2>&1; then
      printf '%-10s %s\n' "${cmd}" "$("${cmd}" --version 2>/dev/null | head -n 1)"
    else
      printf '%-10s %s\n' "${cmd}" "not installed"
    fi
  done
}

install_base_packages
install_node
install_github_cli
install_go
install_cpp_deps
install_rust
install_codex
create_vesper_user
write_profile
print_versions

log "Bootstrap complete"
cat <<EOF

Next steps:
  1. Switch to your Vesper runtime user if you created one:
       sudo -iu ${VESPER_USER}

  2. Authenticate tools:
       codex login
       gh auth login

  3. Clone Vesper and your target repos inside the VM:
       mkdir -p ~/app ~/projects ~/worktrees ~/data/artifacts
       git clone https://github.com/<you>/vesper.git ~/app/vesper

  4. Configure Vesper:
       cd ~/app/vesper
       cp .env.example .env
       cp vesper.config.example.json vesper.config.json
       npm install
       npm run build
       npm test
       npm run dev
EOF
