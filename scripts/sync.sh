#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_root"

push=true
if [[ "${1:-}" == "--no-push" ]]; then
  push=false
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--no-push]" >&2
  exit 64
fi

./scripts/generate-inventory.sh
git add README.md LICENSE .gitignore docs scripts inventory/pi-inventory.json

if git diff --cached --quiet; then
  echo "No safe inventory or documentation changes to commit."
  exit 0
fi

./scripts/check-public.sh
git diff --cached --stat
git diff --cached

read -r -p "Create this local commit? [y/N] " answer
if [[ ! "$answer" =~ ^[Yy]$ ]]; then
  echo "Cancelled before commit."
  exit 0
fi

git commit -m "chore: update Pi setup inventory"

if [[ "$push" == false ]]; then
  echo "Committed locally. Push when ready with: git push"
  exit 0
fi

read -r -p "Push this public commit to origin? [y/N] " answer
if [[ "$answer" =~ ^[Yy]$ ]]; then
  git push
else
  echo "Committed locally; not pushed."
fi
