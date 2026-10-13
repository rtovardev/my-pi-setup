#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v pi >/dev/null 2>&1; then
  printf 'Error: Pi is not installed or not on PATH.\n' >&2
  exit 1
fi

while IFS= read -r package || [[ -n "$package" ]]; do
  [[ -z "$package" || "$package" == \#* ]] && continue
  printf '\n==> Installing %s\n' "$package"
  pi install "$package"
done < "$ROOT/packages.txt"

AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
node "$ROOT/scripts/apply-settings.mjs" "$AGENT_DIR/settings.json" "$ROOT/settings.json"

printf '\nPi setup applied. Local credentials and machine-specific config were left untouched.\n'
