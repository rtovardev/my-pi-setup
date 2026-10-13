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

The script installs every Pi package listed in [`packages.txt`](packages.txt), then applies the shared preferences in [`settings.json`](settings.json). It merges those preferences into `~/.pi/agent/settings.json` (or `$PI_CODING_AGENT_DIR/settings.json`) and backs up the existing file before changing it. Other settings and the package list are preserved.

After changing the package list or shared preferences, commit and push the changes. To refresh already-installed packages, run:

```bash
pi update --extensions
```

Package sources are intentionally unpinned, matching the current Pi setup; npm's current version is installed when setting up a machine. Existing extra packages on a machine are not removed automatically.

## What's shared

- Pi packages: extensions, tools, skills, prompts, and themes supplied by the packages in `packages.txt`.
- Default provider/model: `openai-codex` / `gpt-6.1-sol`.
- Theme and startup preferences.

## What's intentionally local

Do not commit or sync API credentials, OAuth tokens, sessions, trust decisions, or machine-specific MCP/server configuration. In particular, keep `auth.json`, `mcp-auth.json`, `mcp.json`, and adapter-specific configuration local. Set up Linux-only desktop/computer-use tools on the Linux machine separately.

Pi extensions run with the permissions of the local user. Review packages before installing or updating them, especially before running this public setup on another machine.
