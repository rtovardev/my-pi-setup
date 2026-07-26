#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_root"

allowed='^(README\.md|LICENSE|\.gitignore|docs/[A-Za-z0-9._/-]+\.md|scripts/[A-Za-z0-9._-]+\.sh|inventory/pi-inventory\.json)$'
for path in $(git diff --cached --name-only); do
  if ! [[ "$path" =~ $allowed ]]; then
    echo "Refusing to publish unexpected path: $path" >&2
    exit 1
  fi
  if [[ "$path" =~ (^|/)(\.env|.*\.pem|.*\.key|.*credential|.*secret|.*token|mcp\.json|settings\.json)$ ]]; then
    echo "Refusing to publish prohibited filename: $path" >&2
    exit 1
  fi
done

# Conservative pattern scan of the staged text. It complements, but cannot replace, review.
pattern='(gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|[Pp]assword[[:space:]]*[:=]|[Tt]oken[[:space:]]*[:=]|[Aa]pi[_ -]?[Kk]ey[[:space:]]*[:=])'
while IFS= read -r path; do
  if git show ":$path" | grep -En "$pattern" >/dev/null; then
    echo "Potential secret pattern found in staged file: $path" >&2
    exit 1
  fi
done < <(git diff --cached --name-only)

echo "Public-repository checks passed. Review 'git diff --cached' before pushing."
