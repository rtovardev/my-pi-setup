import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const [targetPath, defaultsPath] = process.argv.slice(2);
if (!targetPath || !defaultsPath) {
  console.error("Usage: node apply-settings.mjs <settings.json> <defaults.json>");
  process.exit(2);
}

const defaults = JSON.parse(await readFile(defaultsPath, "utf8"));
let current = {};
let targetExists = false;

try {
  current = JSON.parse(await readFile(targetPath, "utf8"));
  targetExists = true;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

// Keep local settings (including the package list) and apply only the shared defaults.
const merged = { ...current, ...defaults };
const serialized = `${JSON.stringify(merged, null, 2)}\n`;

if (targetExists && JSON.stringify(current) !== JSON.stringify(merged)) {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  await copyFile(targetPath, `${targetPath}.bak-${timestamp}`);
}

await mkdir(dirname(targetPath), { recursive: true });
await writeFile(targetPath, serialized, "utf8");
console.log(`Updated shared Pi settings in ${targetPath}`);
