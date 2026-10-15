import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { mkdtemp } from 'node:fs/promises';
const dir = await mkdtemp('/tmp/pi-comms-smoke-');
process.chdir(dir);
const {loadExtensions}=await import(pathToFileURL(process.env.PI_LOADER));
const loaded=await loadExtensions([`${homedir()}/.pi/agent/local-packages/agent-comms-guard.ts`],dir);
assert.deepEqual(loaded.errors,[]);
const extension=loaded.extensions[0];
assert.ok(extension.tools.has('agent_comms'));
const notices=[];
const ctx={ui:{notify:(text,level)=>notices.push({text,level}),setStatus:()=>{}}};
try {
  for(const handler of extension.handlers.get('session_start')) await handler({},ctx);
  assert.ok(notices.some(n=>n.text==='Agent Comms: connected'),JSON.stringify(notices));
  const result = await extension.tools.get('agent_comms').definition.execute('smoke',{action:'whoami'});
  assert.ok(!result.isError,JSON.stringify(result));
  await new Promise(r=>setTimeout(r,35000));
  assert.deepEqual(notices.filter(n=>n.level==='error'),[]);
  console.log(JSON.stringify({result:'PASS',windowSeconds:35,tool:'agent_comms',notices,whoami:result.content}));
} finally { for(const handler of extension.handlers.get('session_shutdown') ?? []) await handler({}); }
