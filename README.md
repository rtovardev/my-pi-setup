# My Pi Setup

Portable Pi configuration for my macOS and Linux machines.

## Install

From this repository directory:

```bash
./install.sh
```

Or clone it first:

```bash
git clone https://github.com/rtovardev/my-pi-setup.git
cd my-pi-setup
./install.sh
```

The script installs every Pi package listed in [`packages/common.txt`](packages/common.txt), then installs [`packages/linux.txt`](packages/linux.txt) only on Linux. It then applies the shared preferences in [`settings.json`](settings.json), merging them into `~/.pi/agent/settings.json` (or `$PI_CODING_AGENT_DIR/settings.json`) and backing up the existing file before changing it. Other settings and the package list are preserved.

After changing the package list or shared preferences, commit and push the changes. To refresh already-installed packages, run:

```bash
pi update --extensions
```

Package sources are intentionally unpinned, matching the current Pi setup; npm's current version is installed when setting up a machine. Existing extra packages on a machine are not removed automatically.

## What's shared

- Pi packages: extensions, tools, skills, prompts, and themes in `packages/common.txt`, installed on both macOS and Linux.
- Default provider/model: `openai-codex` / `gpt-6.1-sol`.
- Theme and startup preferences.

## Linux-only packages

Put packages that require Linux (for example, a desktop/computer-use integration) in `packages/linux.txt`. The installer applies that list only when `uname -s` reports `Linux`. The list is intentionally empty until the exact package is chosen. This script installs Pi packages; any OS-level dependencies or desktop-session setup will need separate instructions.

## What's intentionally local

Do not commit or sync API credentials, OAuth tokens, sessions, trust decisions, or machine-specific MCP/server configuration. In particular, keep `auth.json`, `mcp-auth.json`, `mcp.json`, and adapter-specific configuration local. Linux-only desktop/computer-use packages are listed separately and should run on the Linux desktop that owns the display session.

Pi extensions run with the permissions of the local user. Review packages before installing or updating them, especially before running this public setup on another machine.
