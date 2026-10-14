import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const [targetPath, defaultsPath] = process.argv.slice(2);
if (!targetPath || !defaultsPath) {
  console.error("Usage: node apply-settings.mjs <settings.json> <defaults.json>");
  process.exit(2);
}

let defaults;
try {
  defaults = JSON.parse(await readFile(defaultsPath, "utf8"));
} catch (error) {
  console.error(`Cannot read shared settings from ${defaultsPath}: ${error.message}`);
  process.exit(1);
}
let current = {};
let targetExists = false;

try {
  current = JSON.parse(await readFile(targetPath, "utf8"));
  targetExists = true;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

// Apply shared package filters without dropping other installed packages or filters.
const sourceOf = (entry) => {
  const source = typeof entry === "string" ? entry : entry.source;
  return source.startsWith(".") || source.startsWith("/")
    ? resolve(dirname(targetPath), source)
    : source;
};
const packages = [...(current.packages ?? [])];
for (const entry of defaults.packages ?? []) {
  const index = packages.findIndex((local) => sourceOf(local) === sourceOf(entry));
  if (index === -1) {
    packages.push(entry);
  } else {
    const local = packages[index];
    if (typeof local === "string" && typeof entry === "string") {
      packages[index] = entry;
    } else {
      const previous = typeof local === "string" ? { source: local } : local;
      const incoming = typeof entry === "string" ? { source: entry } : entry;
      packages[index] = { ...previous, ...incoming };
    }
  }
}

// Keep local settings and apply only the shared defaults.
const merged = { ...current, ...defaults };
if (defaults.extensions !== undefined) {
  // Migrate the old absolute agent-comms bridge, preserving unrelated local extensions.
  const local = (current.extensions ?? []).filter((entry) =>
    !entry.endsWith("/agent-comms/dist/bridges/pi/extension.js"));
  merged.extensions = [...new Set([...local, ...defaults.extensions])];
}
if (current.packages !== undefined || defaults.packages !== undefined) {
  merged.packages = packages;
}
const serialized = `${JSON.stringify(merged, null, 2)}\n`;

if (targetExists && JSON.stringify(current) !== JSON.stringify(merged)) {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  await copyFile(targetPath, `${targetPath}.bak-${timestamp}`);
}

await mkdir(dirname(targetPath), { recursive: true });
await writeFile(targetPath, serialized, "utf8");
console.log(`Updated shared Pi settings in ${targetPath}`);
