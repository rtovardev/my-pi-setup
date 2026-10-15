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

The script installs every Pi package listed in [`packages/common.txt`](packages/common.txt), then installs the platform-specific list: [`packages/macos.txt`](packages/macos.txt) on macOS or [`packages/linux.txt`](packages/linux.txt) on Linux. It also installs the maintained local web tools with their lockfile before applying the shared preferences in [`settings.json`](settings.json), merging them into `~/.pi/agent/settings.json` (or `$PI_CODING_AGENT_DIR/settings.json`) and backing up the existing file before changing it. Other settings and installed packages are preserved; shared package filters are merged by source rather than replacing the package list.

After changing the package list or shared preferences, commit and push the changes. To refresh already-installed packages, run:

```bash
pi update --extensions
```

Registry package sources are intentionally unpinned, matching the current Pi setup; npm's current version is installed when setting up a machine. Dependencies of the maintained local web package are locked. Existing extra packages and unrelated local extensions on a machine are not removed automatically. Pi core itself is not upgraded by this installer; this setup is verified with Pi 1.2.0.

## What's shared

- Pi packages: extensions, tools, skills, prompts, and themes in `packages/common.txt`, installed on both macOS and Linux. This includes the Pi Topping suite: `pi-topping`, `pi-topping-statusline`, `pi-topping-splash`, `pi-topping-persona-audit`, `pi-topping-web-tools`, and `pi-topping-moa-fusion`.
- Default provider/model: `openai-codex` / `gpt-6.1-sol`.
- Theme and startup preferences.
- `pi-lens` for automatic, language-aware feedback while the agent edits: LSP diagnostics, supported linters/type checkers, related-test checks, structural/security findings, and read-before-edit guidance. Depending on project tools and configuration, it can also format or autofix files.
- `pi-codex-account-switcher` for switching between OpenAI Codex accounts in Pi.
- `AGENTS.md` with the shared working agreements: where the personal and company memory lives, the third-party integration gateway, and the spend limit of the instant tools. A different local copy is backed up under `backups/AGENTS.md/` before it is replaced.
- `@bacnh85/pi-attachments` for file attachments and `pi-btw` for side conversations.
- `agent-comms` with package extension discovery disabled and its Pi bridge loaded through a version-checked local guard. Paths are relative to the agent directory and support `PI_CODING_AGENT_DIR`.

The manifests match the configured Pi packages as of 2026-10-14. `pi-rename-session` is no longer in the current installation and is not part of this setup. Herdr plugins and the local `herdr-agent-state.ts` integration are not managed by this Pi installer; they are left unchanged.

## Agent Comms: local-only discovery safety patch

`agent-comms@8.13.20` broadcasts mesh ports on the LAN even though its data listener binds to `127.0.0.1`. Other machines repeatedly try the unreachable ports and Pi displays `connectToPeer ... ECONNREFUSED` notifications.

[`scripts/patch-agent-comms.mjs`](scripts/patch-agent-comms.mjs) stops LAN mesh advertisements, probes, inbound mesh discovery and automatic remote peer dials (including stale peer lists relayed by old coordinators). Same-machine multicast discovery, TLS, the local coordinator, hub support and independent web-UI discovery remain unchanged. Genuine errors are still reported. **This deliberately does not enable cross-machine Mac/MSI messaging**; that requires an upstream networking fix or separately configured relay. No data ports are exposed and no trust/TLS checks are weakened.

The installer applies the patch and installs a guard at `local-packages/agent-comms-guard.ts`; the guard checks it before importing the bridge on each new Pi process. A same-version `pi update` is repaired automatically. An unreviewed version or modified source is refused rather than overwritten. Both original modules are backed up with their checksums under `backups/agent-comms/8.13.20/`.

**Restart every open Pi session on both machines.** `/reload` is not sufficient evidence because imported dependency modules may stay cached. Old processes keep the previous network behavior until restarted; the installer does not terminate them.

Manual apply (the installer also installs the startup guard):

```bash
node scripts/patch-agent-comms.mjs "${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
```

To roll back, restore the original with the command below, replace the guard entry in Pi settings with `./npm/node_modules/agent-comms/dist/bridges/pi/extension.js`, then restart Pi. Otherwise the guard reapplies the safety policy at startup.

```bash
node scripts/patch-agent-comms.mjs "${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}" --restore
```

`node --test scripts/*.test.mjs` includes a regression against the reviewed installed package: unreachable LAN advertisements are ignored, local TLS delivers a real frame, and genuine local connection errors remain visible. It requires a non-loopback IPv4 interface. It also verifies checksum/version refusal, backups, rollback and idempotence. This is a reversible local mitigation, not a claim that upstream LAN networking has been repaired.

## Maintained web tools

[`local-packages/web-tools`](local-packages/web-tools/HARNESS_FIX.md) contains the maintained correction based on `@underactive/pi-topping-web-tools@0.2.8`. The upstream package stays installed with `extensions: []`; only the local copy provides `fetch_markdown`, `pdf_extract`, and `web_browser`. Other Topping extensions are unchanged.

Public HTTP(S) reads no longer ask for approval for every host. Explicit session denials, private/local destinations, and local-file confirmations remain enforced. Permission dialogs have a 15-second deadline and honor turn cancellation. HTML and PDF processing run in killable workers; downloads and extraction have bounded deadlines. Browser markdown conversion uses the same worker.

The installer uses a staging directory, omits install scripts and dev/peer dependencies, and preserves the previous package under the agent directory's `backups/web-tools/`. Package paths in shared settings are relative to the agent directory; no dependency symlinks or machine-specific paths are copied.

To also provision the Playwright headless Chromium required by `web_browser`:

```bash
./install.sh --with-browser
```

Restart Pi or run `/reload` in each open session after applying the setup. Credentials, trust decisions, MCP configuration, and the Pi core version are not copied between machines. Public-read permission is not permission to submit forms, publish content, or change external accounts.

Run the offline regression suite:

```bash
node --test scripts/*.test.mjs
cd local-packages/web-tools
npm ci --ignore-scripts
npm test
```

A runtime installation omits dev/peer dependencies; its tests can use the installed Pi host by setting `PI_TEST_HOST_ROOT` to the host's `node_modules` directory.

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
