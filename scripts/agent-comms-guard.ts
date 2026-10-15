import { fileURLToPath } from "node:url";
import { patchAgentComms } from "./patch-agent-comms.mjs";

// Installed under <agentDir>/local-packages. Keep this entry as TypeScript so
// Pi's loader resolves its bridge imports with the host's dependency aliases.
export default async function agentCommsGuard(pi: unknown) {
  const agentDir = fileURLToPath(new URL("../", import.meta.url));
  await patchAgentComms({ agentDir });
  const bridge = await import(new URL("../npm/node_modules/agent-comms/dist/bridges/pi/extension.js", import.meta.url).href);
  return bridge.default(pi);
}
