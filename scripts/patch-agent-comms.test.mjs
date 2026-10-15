import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ORIGINAL_SHA256, TRANSPORT_SHA256, VERSION, patchSource, patchTransport, patchAgentComms } from "./patch-agent-comms.mjs";

// Tests require the reviewed installed package, but never mutate its files.
const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi/agent");
let original = await readFile(join(agentDir, "npm/node_modules/agent-comms/dist/core/first-contact.js"), "utf8");
try { patchSource(original); }
catch { original = await readFile(join(agentDir, "backups/agent-comms", VERSION, `first-contact.${ORIGINAL_SHA256}.js`), "utf8"); }
const patched = patchSource(original);
let transport = await readFile(join(agentDir, "npm/node_modules/agent-comms/dist/core/wire-mesh-transport.js"), "utf8");
try { patchTransport(transport); }
catch { transport = await readFile(join(agentDir, "backups/agent-comms", VERSION, `wire-mesh-transport.${TRANSPORT_SHA256}.js`), "utf8"); }
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "comms-patch-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const packageDir = join(dir, "npm/node_modules/agent-comms");
  await mkdir(join(packageDir, "dist/core"), { recursive: true });
  await writeFile(join(packageDir, "package.json"), JSON.stringify({ version: VERSION }));
  const target = join(packageDir, "dist/core/first-contact.js");
  await writeFile(target, original);
  await writeFile(join(packageDir, "dist/core/wire-mesh-transport.js"), transport);
  return { dir, target, packageDir, apply: (restore = false) => patchAgentComms({ agentDir: dir, restore }) };
}

test("patch is backed up, idempotent and reversible", async (t) => {
  const f = await fixture(t);
  const first = await f.apply();
  assert.equal(first.changed, true);
  assert.equal(await readFile(first.backup, "utf8"), original);
  assert.equal(await readFile(f.target, "utf8"), patched);
  assert.equal((await f.apply()).changed, false);
  assert.equal((await f.apply(true)).changed, true);
  assert.equal(await readFile(f.target, "utf8"), original);
  assert.equal((await f.apply(true)).changed, false);
});
test("rejects unreviewed versions without mutation", async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.packageDir, "package.json"), '{"version":"9.0.0"}');
  await assert.rejects(f.apply(), /not reviewed/);
  assert.equal(await readFile(f.target, "utf8"), original);
});
test("rejects modified source instead of overwriting", async (t) => {
  const f = await fixture(t);
  await f.apply();
  const custom = `${patched}\n// unrelated user edit\n`;
  await writeFile(f.target, custom);
  await assert.rejects(f.apply(), /unexpected changes/);
  assert.equal(await readFile(f.target, "utf8"), custom);
});
test("rejects corrupted backup before repeat installation", async (t) => {
  const f = await fixture(t);
  const result = await f.apply();
  await writeFile(result.backup, "corrupted");
  await assert.rejects(f.apply(), /Unrecognized/);
  assert.equal(await readFile(f.target, "utf8"), patched);
});
test("reapplies after same-version upstream reinstall", async (t) => {
  const f = await fixture(t);
  await f.apply();
  await writeFile(f.target, original);
  assert.equal((await f.apply()).changed, true);
  assert.equal(await readFile(f.target, "utf8"), patched);
});
