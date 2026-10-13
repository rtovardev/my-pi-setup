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

The script installs every Pi package listed in [`packages/common.txt`](packages/common.txt), then installs the platform-specific list: [`packages/macos.txt`](packages/macos.txt) on macOS or [`packages/linux.txt`](packages/linux.txt) on Linux. It then applies the shared preferences in [`settings.json`](settings.json), merging them into `~/.pi/agent/settings.json` (or `$PI_CODING_AGENT_DIR/settings.json`) and backing up the existing file before changing it. Other settings and the package list are preserved.

After changing the package list or shared preferences, commit and push the changes. To refresh already-installed packages, run:

```bash
pi update --extensions
```

Package sources are intentionally unpinned, matching the current Pi setup; npm's current version is installed when setting up a machine. Existing extra packages on a machine are not removed automatically.

## What's shared

- Pi packages: extensions, tools, skills, prompts, and themes in `packages/common.txt`, installed on both macOS and Linux.
- Default provider/model: `openai-codex` / `gpt-6.1-sol`.
- Theme and startup preferences.
- `pi-lens` for automatic, language-aware feedback while the agent edits: LSP diagnostics, supported linters/type checkers, related-test checks, structural/security findings, and read-before-edit guidance. Depending on project tools and configuration, it can also format or autofix files.
- `pi-codex-account-switcher` for switching between OpenAI Codex accounts in Pi.

### Using pi-lens

Most checks run automatically as the agent writes or edits files; no separate command is needed. In interactive Pi, you can:

- Run `/lens-widget-toggle` to show or hide the diagnostics summary.
- Run `/lens-health` to inspect pi-lens runtime health and diagnostic telemetry.
- Run `/lens-map` to generate an interactive dependency map.
- Run `/lens-toggle` to enable or disable pi-lens for the current session.
- Run `/lens-context-toggle` to toggle automatic findings in the agent's context while leaving diagnostics and other tools active.

Pi-lens may reformat or autofix files when suitable project tools are available. Review those changes, and treat partial or degraded diagnostics as incomplete rather than as proof that the project is clean. The commit/push blocker guard is opt-in and is not enabled by this setup.

## Cross-platform Computer Use

`npm:@amaster.ai/pi-computer-use` is installed on both macOS and Linux. It bundles Cua Driver 0.34.0 for desktop accessibility, screenshots, native input, and optional browser tools. Restart Pi or run `/reload` after installation.

The default `core` tool profile keeps optional groups deferred. Keep app-launch and dangerous-action confirmations enabled. On macOS, the signed `CuaDriver.app` requests Accessibility and Screen Recording permissions on first use. On Ubuntu, run in the active graphical user's session; Wayland capabilities depend on the compositor and may require additional helpers and permission grants. Installation alone does not verify desktop control.

Use `/computer-use-tools diagnostics` to expose permission and health tools. The extension owns its driver lifecycle; it does not install a persistent system service. This is the sole desktop controller in this setup; the previous macOS Codex adapter has been removed.

## Platform-specific packages

Keep packages that require a particular operating system in a separate manifest: `packages/macos.txt` for macOS and `packages/linux.txt` for Linux. The installer selects exactly one based on `uname -s`; platform-specific packages are not installed on the other OS.

This script installs Pi packages; any OS-level dependencies, app installation, permissions, or desktop-session setup need separate instructions.

## What's intentionally local

Do not commit or sync API credentials, OAuth tokens, sessions, trust decisions, or machine-specific MCP/server configuration. In particular, keep `auth.json`, `mcp-auth.json`, `mcp.json`, and adapter-specific configuration local. Cross-platform computer-use packages belong in the common manifest; OS-specific alternatives belong in platform manifests. Desktop control should run in the local, unlocked desktop session that owns the display.

Pi extensions run with the permissions of the local user. Review packages before installing or updating them, especially before running this public setup on another machine.
