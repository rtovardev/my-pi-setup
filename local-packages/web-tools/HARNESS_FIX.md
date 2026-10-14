# Maintained web harness correction

Base: `@underactive/pi-topping-web-tools@0.2.8`, MIT license retained.
Maintained version: `rtovar-pi-web-tools@0.2.8-rtovar.2`.
Verified host: Pi 1.2.0. This package is local; it is not published to npm.

## Changes

- Public HTTP(S) fetches, PDF downloads, and browser navigation do not ask for permission for each origin. Explicit session denials are respected.
- Private/local origins and local files still need confirmation. Cancelled or expired permission dialogs do not become permanent session denials.
- Permission dialogs honor the turn's abort signal and expire after 15 seconds.
- HTML processing removes script/style/template payloads and runs in a worker that is terminated after 10 seconds or on cancellation. Browser markdown conversion uses this worker too.
- Fetch download plus conversion has a 30-second deadline and a 2 MiB body cap. The complete response body stays cancellable.
- PDF download and worker extraction each have a 30-second deadline. Existing 25 MiB and 2,000-page limits remain.
- Redirect handling remains explicit. A public read does not authorize destructive browser actions, account updates, or publication.

## Installation

From the setup repository run `./install.sh`, or `./install.sh --with-browser` to provision Playwright's headless Chromium.

The installer copies source into the agent directory, runs the lockfile-based dependency installation in staging, and retains the old package before promotion. Dependencies are installed locally rather than linked to another machine. Pi host modules are supplied by Pi's extension loader.

Shared settings disable upstream extension discovery and enable `./local-packages/web-tools`. Restart Pi or use `/reload` to activate the new source. Existing running sessions do not automatically reload it.

## Validation and limitations

`npm test` runs deterministic, offline tests of permissions, cancellation, HTML/PDF workers, size limits, explicit redirects, cache, shutdown, and browser markdown conversion. Installer and settings-merge tests are in the repository's `scripts/` directory.

MCP, Composio, computer-use permission policy, credentials, and machine-specific configuration are unchanged. Browser automation still needs a compatible Playwright Chromium installation. Headless browser verification does not prove desktop computer-use permissions.

## Rollback

Stop or reload Pi after any rollback. Restore the required prior package from `backups/web-tools/` and adjust only the web-related registration entries in `settings.json`. Do not replace the entire settings file blindly: it may contain newer unrelated changes. Removing the local source alone must not enable the upstream tools unless that is explicitly intended.
