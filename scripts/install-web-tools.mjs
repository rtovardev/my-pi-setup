import { access, cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const setupRoot = fileURLToPath(new URL("../", import.meta.url));
const defaultSource = join(setupRoot, "local-packages/web-tools");

export async function installWebTools({
  agentDir,
  source = defaultSource,
  withBrowser = false,
  run = spawnSync,
}) {
  const base = join(agentDir, "local-packages");
  const target = join(base, "web-tools");
  const lock = join(base, ".web-tools-install-lock");
  await mkdir(base, { recursive: true });
  // One installer per agent directory; never remove another process's lock.
  await mkdir(lock);
  let stage;
  let backup;
  try {
    const manifest = JSON.parse(await readFile(join(source, "package.json"), "utf8"));
    if (manifest.name !== "rtovar-pi-web-tools") throw new Error("Unexpected web-tools package");
    await access(join(source, "package-lock.json"));
    stage = await mkdtemp(join(base, ".web-tools-stage-"));
    await cp(source, stage, {
      recursive: true,
      filter: (path) => !path.split(/[\\/]/).some((part) => part === "node_modules" || part === ".git"),
    });
    const checkedRun = (command, args, timeout) => {
      const result = run(command, args, { cwd: stage, stdio: "inherit", timeout });
      if (result.error || result.status !== 0) {
        throw new Error(`${command} failed before activation: ${result.error?.message ?? result.signal ?? result.status}`);
      }
    };
    checkedRun("npm", ["ci", "--omit=dev", "--omit=peer", "--ignore-scripts", "--no-audit", "--no-fund"], 120_000);
    if (withBrowser) {
      checkedRun(process.execPath, [join(stage, "node_modules/playwright/cli.js"), "install", "chromium", "--only-shell"], 180_000);
    }
    let exists = true;
    try { await access(target); } catch (error) {
      if (error.code !== "ENOENT") throw error;
      exists = false;
    }
    if (exists) {
      const backups = join(agentDir, "backups/web-tools");
      await mkdir(backups, { recursive: true });
      backup = join(await mkdtemp(join(backups, "install-")), "previous");
      await rename(target, backup);
    }
    try {
      await rename(stage, target);
      stage = undefined;
    } catch (error) {
      if (backup) await rename(backup, target);
      throw error;
    }
    console.log(`Installed ${manifest.name}@${manifest.version} in ${target}`);
    if (backup) console.log(`Previous package preserved in ${backup}`);
    return { target, backup, version: manifest.version };
  } finally {
    if (stage) await rm(stage, { recursive: true, force: true });
    await rm(lock, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [agentDir, ...flags] = process.argv.slice(2);
  if (!agentDir || flags.some((flag) => flag !== "--with-browser") || flags.length > 1) {
    console.error("Usage: node install-web-tools.mjs <agent-directory> [--with-browser]");
    process.exitCode = 2;
  } else {
    try {
      await installWebTools({ agentDir: resolve(agentDir), withBrowser: flags.includes("--with-browser") });
    } catch (error) {
      console.error(`Web tools not activated: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
