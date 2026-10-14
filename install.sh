#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v pi >/dev/null 2>&1; then
  printf 'Error: Pi is not installed or not on PATH.\n' >&2
  exit 1
fi

install_packages() {
  local manifest="$1"
  [[ -f "$manifest" ]] || return 0

  local package
  while IFS= read -r package || [[ -n "$package" ]]; do
    [[ -z "$package" || "$package" == \#* ]] && continue
    printf '\n==> Installing %s\n' "$package"
    pi install "$package"
  done < "$manifest"
}

install_shared_agents_md() {
  local source="$ROOT/AGENTS.md"
  local target="$AGENT_DIR/AGENTS.md"

  if [[ ! -f "$source" ]]; then
    printf 'Error: AGENTS.md is missing from the repository.\n' >&2
    exit 1
  fi

  if [[ -f "$target" ]] && cmp -s "$source" "$target"; then
    printf 'Shared AGENTS.md is already up to date.\n'
    return 0
  fi

  if [[ -f "$target" ]]; then
    local backup_dir="$AGENT_DIR/backups/AGENTS.md"
    mkdir -p "$backup_dir"
    cp "$target" "$backup_dir/AGENTS.md.$(date +%Y%m%d%H%M%S)"
    printf 'Backed up the previous AGENTS.md under %s\n' "$backup_dir"
  fi

  mkdir -p "$AGENT_DIR"
  cp "$source" "$target"
  printf 'Installed the shared AGENTS.md into %s\n' "$target"
}

install_packages "$ROOT/packages/common.txt"
case "$(uname -s)" in
  Darwin) install_packages "$ROOT/packages/macos.txt" ;;
  Linux) install_packages "$ROOT/packages/linux.txt" ;;
esac

AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
install_shared_agents_md
node "$ROOT/scripts/apply-settings.mjs" "$AGENT_DIR/settings.json" "$ROOT/settings.json"

printf '\nPi setup applied. Local credentials and machine-specific config were left untouched.\n'
