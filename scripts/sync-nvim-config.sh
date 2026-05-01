#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${SOURCE_DIR:-$HOME/.config/nvim}"
REMOTE_DIR="${REMOTE_DIR:-.config/nvim}"
DRY_RUN=0

usage() {
  cat <<'USAGE'
Usage: scripts/sync-nvim-config.sh [options] <ssh-target>

Copy your local Neovim config to a Vesper VM over SSH.

Arguments:
  ssh-target              SSH target, e.g. vesper@192.168.64.12 or vm-alias

Options:
  --source <path>         Local nvim config dir (default: ~/.config/nvim)
  --remote-dir <path>     Remote config dir relative to remote home unless absolute
                          (default: .config/nvim)
  --dry-run               Show what rsync would copy
  -h, --help              Show this help

Examples:
  scripts/sync-nvim-config.sh vesper@192.168.64.12
  scripts/sync-nvim-config.sh --dry-run --source ~/.config/nvim vm-alias

Notes:
  - This copies config only, not plugin cache/state.
  - Run nvim once in the VM to let your plugin manager install plugins.
  - Keep secrets out of your Neovim config before syncing.
USAGE
}

target=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE_DIR="${2:?missing value for --source}"
      shift 2
      ;;
    --remote-dir)
      REMOTE_DIR="${2:?missing value for --remote-dir}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      if [[ -n "${target}" ]]; then
        echo "Only one ssh-target is supported." >&2
        exit 2
      fi
      target="$1"
      shift
      ;;
  esac
done

if [[ -z "${target}" ]]; then
  usage >&2
  exit 2
fi

if [[ ! -d "${SOURCE_DIR}" ]]; then
  echo "Local Neovim config does not exist: ${SOURCE_DIR}" >&2
  exit 1
fi

remote_parent="$(dirname "${REMOTE_DIR}")"
ssh "${target}" "mkdir -p ${remote_parent@Q}"

rsync_args=(
  -az
  --delete
  --exclude ".git/"
  --exclude ".DS_Store"
  --exclude "plugin/packer_compiled.lua"
)

if [[ "${DRY_RUN}" == "1" ]]; then
  rsync_args+=(--dry-run --itemize-changes)
fi

rsync "${rsync_args[@]}" "${SOURCE_DIR%/}/" "${target}:${REMOTE_DIR%/}/"

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "Dry run complete. No files were copied."
else
  echo "Synced ${SOURCE_DIR} to ${target}:${REMOTE_DIR}"
  echo "Next: SSH into the VM and run 'nvim' once to install plugins."
fi
