import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const script = new URL("./apply-settings.mjs", import.meta.url);
const defaults = new URL("../settings.json", import.meta.url);
const shared = JSON.parse(await readFile(defaults, "utf8"));
const bridge = "./local-packages/agent-comms-guard.ts";

async function fixture(t, current) {
  const dir = await mkdtemp(join(tmpdir(), "pi-setup-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const target = join(dir, "settings.json");
  if (current !== undefined) await writeFile(target, JSON.stringify(current));
  const apply = (source = defaults) => spawnSync(process.execPath, [script.pathname, target, source.pathname ?? source], { encoding: "utf8" });
  const read = async () => JSON.parse(await readFile(target, "utf8"));
  return { dir, target, apply, read };
}

test("merges package filters, preserves local settings, backs up once, and is idempotent", async (t) => {
  const current = {
    packages: ["npm:pi-btw", "npm:agent-comms", { source: "npm:local-extra", skills: [] }],
    skills: ["/local/skills"],
    extensions: ["-builtin:mcp", "/old/agent-comms/dist/bridges/pi/extension.js", "./npm/node_modules/agent-comms/dist/bridges/pi/extension.js", "/local/custom.ts"],
    theme: "dark",
  };
  const f = await fixture(t, current);
  assert.equal(f.apply().status, 0);
  const merged = await f.read();
  assert.deepEqual(merged.packages, ["npm:pi-btw", shared.packages[0], current.packages[2], ...shared.packages.slice(1)]);
  assert.deepEqual(merged.skills, current.skills);
  assert.equal(merged.theme, "system");
  assert.deepEqual(merged.extensions, ["-builtin:mcp", "/local/custom.ts", bridge]);
  const backups = (await readdir(f.dir)).filter((name) => name.includes(".bak-"));
  assert.equal(backups.length, 1);
  assert.equal(await readFile(join(f.dir, backups[0]), "utf8"), JSON.stringify(current));
  assert.equal(f.apply().status, 0);
  assert.deepEqual(await f.read(), merged);
  assert.equal((await readdir(f.dir)).filter((name) => name.includes(".bak-")).length, 1);
});

test("preserves unrelated filters on existing package objects and disables upstream web extensions", async (t) => {
  const f = await fixture(t, { packages: [
    { source: "npm:agent-comms", extensions: ["old.js"], skills: [] },
    { source: "npm:@underactive/pi-topping-web-tools", extensions: ["old-web.ts"], themes: [] },
  ] });
  assert.equal(f.apply().status, 0);
  assert.deepEqual((await f.read()).packages, [
    { source: "npm:agent-comms", extensions: [], skills: [] },
    { source: "npm:@underactive/pi-topping-web-tools", extensions: [], themes: [] },
    "./local-packages/web-tools",
  ]);
});

test("migrates an absolute local package path without a duplicate or losing its filters", async (t) => {
  const f = await fixture(t, {});
  await writeFile(f.target, JSON.stringify({ packages: [{ source: join(f.dir, "local-packages/web-tools"), skills: [] }] }));
  assert.equal(f.apply().status, 0);
  const packages = (await f.read()).packages;
  assert.equal(packages.filter((entry) => (typeof entry === "string" ? entry : entry.source).includes("local-packages/web-tools")).length, 1);
  assert.deepEqual(packages[0], { source: "./local-packages/web-tools", skills: [] });
  assert.equal(f.apply().status, 0);
  assert.deepEqual((await f.read()).packages, packages);
});

test("creates settings on a fresh machine", async (t) => {
  const f = await fixture(t);
  assert.equal(f.apply().status, 0);
  assert.deepEqual(await f.read(), shared);
  assert.equal((await readdir(f.dir)).length, 1);
});

test("rejects malformed shared settings without changing the target", async (t) => {
  const current = { packages: ["npm:local-extra"] };
  const f = await fixture(t, current);
  const broken = join(f.dir, "broken.json");
  await writeFile(broken, "{");
  assert.equal(f.apply(broken).status, 1);
  assert.equal(await readFile(f.target, "utf8"), JSON.stringify(current));
  assert.equal((await readdir(f.dir)).some((name) => name.includes(".bak-")), false);
});
