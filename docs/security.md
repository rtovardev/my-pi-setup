# Security and publication policy

`my-pi-setup` is public. Treat every tracked file as permanently public.

## Publication model

The repository uses a **metadata-only allowlist**. The inventory script can publish only:

- Pi version and operating-system version.
- Names of installed Pi packages/extensions, skills, and themes.
- Hashes of extension files, used only to detect change.
- MCP server names, never server commands, arguments, environment variables, URLs, or configuration values.

No configuration file from the home directory is copied into this repository.

## Explicitly excluded

Do not add any of the following, directly or indirectly:

- `~/.pi/agent/mcp-oauth/`, `sessions/`, `intercom/`, `status/`, `tmp/`, `projects-memory/`, caches, or logs.
- OAuth state, browser cookies, API keys, access tokens, passwords, SSH keys, credential stores, or account snapshots.
- Raw `mcp.json`, `settings.json`, `.env*`, `codex-accounts.json`, or any config whose contents have not been reviewed line-by-line for public release.
- Usernames, email addresses, absolute home paths, private repository names, client names, local network details, or personally sensitive data.

## Required validation before a push

`scripts/sync.sh` runs `scripts/check-public.sh`. It rejects unexpected paths and common credential patterns. This scanner is a safety net, not proof that a file is safe.

The approved weekly maintenance workflow may use `./scripts/sync.sh --draft-pr` only from a clean, dedicated non-`main` worktree. It validates the staged diff, pushes only that isolated branch, and creates/updates a Draft PR. It cannot push `main` or merge the PR. Ricardo reviews the public diff in GitHub before merging.

Interactive runs still show `git diff --cached` before asking for a push.

If a useful Pi setting is too personal to publish, document its **purpose** in `docs/` and explain how another user can recreate it. Do not publish the original file.

## Incident response

If sensitive material ever reaches the remote:

1. Revoke or rotate the exposed credential immediately.
2. Remove it from the repository and history using GitHub's documented secret-removal procedure.
3. Force-push only after understanding the impact and notifying affected collaborators.
4. Assume cloned/forked copies may persist.
