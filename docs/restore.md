# Restoration guide

This is a reproducibility guide, not a secrets backup. A new machine starts with fresh credentials and explicitly configured integrations.

## 1. Install prerequisites

- Install Git and GitHub CLI.
- Install Node.js and npm if required by Pi and the desired extensions.
- Install Pi from its official release/install documentation.

Confirm the binary is available:

```bash
pi --version
```

## 2. Clone this reference

```bash
git clone https://github.com/rtovardev/my-pi-setup.git
cd my-pi-setup
```

Read `inventory/pi-inventory.json` and the linked documentation. Treat package names as a checklist, not blind installation commands.

## 3. Recreate public capabilities intentionally

For every extension, skill, or theme you want:

1. Find the upstream project and review it.
2. Confirm it is compatible with your Pi version.
3. Install it using the upstream instructions.
4. Configure credentials locally, outside Git.
5. Keep MCP connections least-privileged and set them up one at a time.

## 4. Verify parity

Generate a local metadata snapshot:

```bash
./scripts/generate-inventory.sh
```

Compare it with the committed inventory:

```bash
git diff -- inventory/pi-inventory.json
```

Differences are expected for OS details, Pi version, and deliberately omitted private configuration.

## 5. Publish an intentional update

After reviewing the diff:

```bash
./scripts/sync.sh
```

The script commits locally and asks before a remote push.
