import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const VERSION = "8.13.20";
export const ORIGINAL_SHA256 = "28119c6d4c0fc26edfa8497af8c8192f8092499dffc26562fe83f0cb5e6fe244";
export const TRANSPORT_SHA256 = "ed2e7d7ff59a5e1420487be5b7cf09330e6648160226f6ff27c7e051a2a608dd";
export const sha256 = (text) => createHash("sha256").update(text).digest("hex");

// Temporary safety policy, NOT an upstream LAN fix: the data server is bound to
// 127.0.0.1, so first-contact must not advertise/dial it across machines.
// Keep local multicast, the well-known coordinator, web-UI discovery and the hub.
// Never suppress store.onError or weaken TLS/trust to make the UI quiet.
export function patchSource(original) {
  if (sha256(original) !== ORIGINAL_SHA256) throw new Error("Unrecognized agent-comms first-contact.js; review upstream before patching");
  return original
    .replace('import * as dgram from "node:dgram";', '// my-pi-setup: loopback-only mesh first-contact for agent-comms 8.13.20.\nimport * as dgram from "node:dgram";')
    .replace('        if (!isBeaconPayload(parsed)) {', '        // The data listener is loopback-only; LAN mesh packets cannot reach it.\n        // Keep web-UI beacons above independent: their listener may support LAN.\n        if (rinfo.address !== LOOPBACK_INTERFACE)\n            return;\n        if (!isBeaconPayload(parsed)) {')
    .replace('        this.sendBeaconTo(BROADCAST_ADDRESS, port);\n', '')
    .replace('for (const address of [FIRST_CONTACT_GROUP, BROADCAST_ADDRESS]) {', 'for (const address of [FIRST_CONTACT_GROUP]) {');
}

export function patchTransport(original) {
  if (sha256(original) !== TRANSPORT_SHA256) throw new Error("Unrecognized agent-comms wire-mesh-transport.js; review upstream before patching");
  return original.replace('    async connectToPeer(peer, _ownPeerId) {', '    async connectToPeer(peer, _ownPeerId) {\n        // Old coordinators can relay LAN peer lists even after discovery is fixed.\n        // Local-only mesh policy must also apply at the automatic dial boundary.\n        if (!isLoopbackAddress(peer.host ?? COORDINATOR_HOST))\n            return;');
}

async function patchFile({ agentDir, restore, name, checksum, transform, validateOnly = false }) {
  const packageDir = join(agentDir, "npm/node_modules/agent-comms");
  const target = join(packageDir, "dist/core", name);
  const backupDir = join(agentDir, "backups/agent-comms", VERSION);
  const backup = join(backupDir, `${name.replace(/\.js$/, "")}.${checksum}.js`);
  const current = await readFile(target, "utf8");
  let original;
  if (sha256(current) === checksum) {
    original = current;
    if (restore || validateOnly) return { changed: false, restored: restore };
    await mkdir(backupDir, { recursive: true });
    try { await writeFile(backup, original, { flag: "wx", mode: 0o600 }); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
  } else {
    original = await readFile(backup, "utf8");
  }
  const patched = transform(original);
  if (current !== original && current !== patched) throw new Error("Local first-contact.js has unexpected changes; refusing to overwrite");
  // Validate backups even on a repeat run; never trust a stale or edited file.
  if (sha256(await readFile(backup, "utf8")) !== checksum) throw new Error("agent-comms backup checksum mismatch");
  if (validateOnly) return { changed: false };
  const content = restore ? original : patched;
  if (current === content) return { changed: false, restored: restore, backup };
  const temporary = `${target}.mypi-${process.pid}.tmp`;
  try {
    await writeFile(temporary, content, { flag: "wx", mode: 0o644 });
    // Refuse to overwrite a dependency that another installer changed mid-run.
    if (await readFile(target, "utf8") !== current) throw new Error("agent-comms changed during patch installation");
    await rename(temporary, target);
  } finally { await rm(temporary, { force: true }); }
  return { changed: true, restored: restore, backup, sha256: sha256(content) };
}

export async function patchAgentComms({ agentDir, restore = false }) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(agentDir, "npm/node_modules/agent-comms/package.json"), "utf8"));
  } catch (error) {
    throw new Error(`Cannot read installed agent-comms manifest: ${error.message}`, { cause: error });
  }
  if (manifest.version !== VERSION) throw new Error(`agent-comms ${manifest.version} is not reviewed; expected ${VERSION}. No files changed.`);
  const files = [
    { name: "first-contact.js", checksum: ORIGINAL_SHA256, transform: patchSource },
    { name: "wire-mesh-transport.js", checksum: TRANSPORT_SHA256, transform: patchTransport },
  ];
  // Preflight both files before mutating either one.
  for (const file of files) await patchFile({ agentDir, restore, ...file, validateOnly: true });
  const results = [];
  for (const file of files) results.push(await patchFile({ agentDir, restore, ...file }));
  return { changed: results.some((result) => result.changed), restored: restore, backup: results[0].backup, files: results };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [agentDir, ...flags] = process.argv.slice(2);
  if (!agentDir || flags.length > 1 || flags.some((flag) => flag !== "--restore")) {
    console.error("Usage: node patch-agent-comms.mjs <agent-directory> [--restore]");
    process.exitCode = 2;
  } else {
    try {
      const result = await patchAgentComms({ agentDir: resolve(agentDir), restore: flags.includes("--restore") });
      console.log(JSON.stringify({ policy: "loopback-only mesh first-contact", ...result }));
      console.log("Restart Pi in every open session; running modules are not modified.");
    } catch (error) {
      console.error(`Agent Comms patch not applied: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
