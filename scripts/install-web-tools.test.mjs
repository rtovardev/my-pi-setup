import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { installWebTools } from "./install-web-tools.mjs";

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "pi-web-install-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = join(dir, "source");
  const agentDir = join(dir, "agent");
  await mkdir(join(source, "node_modules/ignored"), { recursive: true });
  await writeFile(join(source, "node_modules/ignored/secret"), "not copied");
  await writeFile(join(source, "package.json"), JSON.stringify({ name: "rtovar-pi-web-tools", version: "test" }));
  await writeFile(join(source, "package-lock.json"), "{}");
  await writeFile(join(source, "entry.ts"), "new");
  return { source, agentDir };
}

test("installs portably without vendored dependencies and retains the previous version", async (t) => {
  const f = await fixture(t);
  const old = join(f.agentDir, "local-packages/web-tools");
  await mkdir(old, { recursive: true });
  await writeFile(join(old, "entry.ts"), "old");
  const calls = [];
  const installed = await installWebTools({ ...f, run: (command, args, options) => {
    calls.push({ command, args, options });
    return { status: 0 };
  }});
  assert.equal(await readFile(join(installed.target, "entry.ts"), "utf8"), "new");
  assert.equal(await readFile(join(installed.backup, "entry.ts"), "utf8"), "old");
  await assert.rejects(readFile(join(installed.target, "node_modules/ignored/secret")), { code: "ENOENT" });
  assert.deepEqual(calls[0].args, ["ci", "--omit=dev", "--omit=peer", "--ignore-scripts", "--no-audit", "--no-fund"]);
  assert.equal(calls[0].options.timeout, 120_000);
  assert.deepEqual(await readdir(join(f.agentDir, "local-packages")), ["web-tools"]);
});

test("npm failure leaves the current package intact and cleans staging and lock", async (t) => {
  const f = await fixture(t);
  const old = join(f.agentDir, "local-packages/web-tools");
  await mkdir(old, { recursive: true });
  await writeFile(join(old, "entry.ts"), "old");
  await assert.rejects(installWebTools({ ...f, run: () => ({ status: 1 }) }), /failed before activation/);
  assert.equal(await readFile(join(old, "entry.ts"), "utf8"), "old");
  assert.deepEqual(await readdir(join(f.agentDir, "local-packages")), ["web-tools"]);
});

test("browser installation is optional, bounded, and completed before promotion", async (t) => {
  const f = await fixture(t);
  const calls = [];
  await assert.rejects(installWebTools({ ...f, withBrowser: true, run: (command, args, options) => {
    calls.push({ command, args, options });
    return { status: calls.length === 2 ? 1 : 0 };
  }}), /failed before activation/);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].args.slice(1), ["install", "chromium", "--only-shell"]);
  assert.equal(calls[1].options.timeout, 180_000);
  assert.deepEqual(await readdir(join(f.agentDir, "local-packages")), []);
});

test("does not delete an existing install lock or start a concurrent installation", async (t) => {
  const f = await fixture(t);
  const lock = join(f.agentDir, "local-packages/.web-tools-install-lock");
  await mkdir(lock, { recursive: true });
  await writeFile(join(lock, "owner"), "another installer");
  await assert.rejects(installWebTools({ ...f, run: () => assert.fail("must not run") }), { code: "EEXIST" });
  assert.equal(await readFile(join(lock, "owner"), "utf8"), "another installer");
});
