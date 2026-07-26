# Pi setup architecture

## Principle

Keep the harness portable without treating a public Git repository as a home-directory backup.

## Layers

1. **Public reference:** this repository. It contains high-level architecture, safe inventory data, restore instructions, and sync tooling.
2. **Local harness:** `~/.pi` and related local configuration. It may contain extensions, skills, settings, and other machine-specific files.
3. **Private state:** credentials, OAuth sessions, provider/account state, caches, logs, and conversation history. It remains on the machine or in approved secret storage, never in this repository.

## Synchronization contract

A human invokes `scripts/sync.sh`. The script generates a deterministic safe snapshot, validates staged content, makes a local commit, and requests explicit confirmation for `git push`.

This design intentionally avoids filesystem watchers and automatic pushes. A watcher makes it too easy to publish an accidental change. If automation is added later, it must retain the same allowlist, validation, staged-diff review, and an explicit publish approval boundary.
