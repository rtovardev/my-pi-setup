# MyPi Setup

A public, reproducible overview of my [Pi coding agent](https://github.com/badlogic/pi-mono) setup.

This repository documents the **portable, non-sensitive** parts of the harness: installed extension/package names, skills, themes, configuration shape, operating practices, and a safe inventory workflow.

## What this repository is

- A public reference and recovery guide for my Pi environment.
- A generated inventory of safe metadata, not a backup of `~/.pi`.
- A deliberately curated repository: all changes are reviewed locally before pushing.

## What it never contains

- API keys, tokens, OAuth data, sessions, or account snapshots.
- Raw MCP configuration, local configuration, logs, caches, transcripts, or history.
- Personal paths, private repositories, or private skill/configuration content.
- Copies of `~/.pi`, `~/.claude`, `~/.config`, or package source code.

See [Security policy](docs/security.md) before contributing or publishing a change.

## Repository layout

```text
scripts/                 Safe inventory, validation, and synchronization tools
docs/                    Setup, restoration, and security documentation
inventory/pi-inventory.json  Generated, public-safe metadata snapshot
```

## Update workflow

Run from this checkout:

```bash
./scripts/sync.sh
```

The command:

1. Generates `inventory/pi-inventory.json` from an allowlisted set of metadata.
2. Verifies the Git staging area contains only approved paths.
3. Runs a conservative secret scan.
4. Creates a local commit if safe changes exist.
5. Shows the pending commit and asks before pushing.

For a non-interactive local commit without a push:

```bash
./scripts/sync.sh --no-push
```

A push is never automatic. This is intentional: public publication needs a human approval gate.

## Restore a setup

Use this repository as a checklist, not as a configuration copier:

1. Install Pi using its official documentation.
2. Read [the restoration guide](docs/restore.md).
3. Install each public extension/skill only after reviewing its source and compatibility.
4. Configure provider accounts, OAuth, and local secrets manually on the target machine.
5. Run `./scripts/generate-inventory.sh` and compare the result with the committed inventory.

## License

[MIT](LICENSE)
