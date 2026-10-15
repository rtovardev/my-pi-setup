import assert from "node:assert/strict";
import { test } from "node:test";
import { networkInterfaces, homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const packageDir = process.env.AGENT_COMMS_PACKAGE_DIR ?? join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi/agent"), "npm/node_modules/agent-comms");
const load = (file) => import(pathToFileURL(join(packageDir, file)).href);
const { FirstContact, FIRST_CONTACT_GROUP } = await import(pathToFileURL(process.env.AGENT_COMMS_FIRST_CONTACT ?? join(packageDir, "dist/core/first-contact.js")).href);
const { WireMeshTransport } = await load("dist/core/wire-mesh-transport.js");
const { generateIdentity } = await load("dist/core/identity.js");
const { noopTransportEvents, waitFor } = await load("dist/test/test-transport.js");
const id = (identity) => Buffer.from(identity.deviceId).toString("hex");
const packet = (peerId, port) => Buffer.from(JSON.stringify({ type: "agent-comms-beacon", name: "regression-peer", peerId, port }));

// Real TLS listener bound ONLY to loopback, advertised from a non-loopback address:
// exactly the broken LAN-beacon -> connectToPeer -> onError -> Pi-toast chain.
test("LAN beacons do not dial loopback-only data ports or emit Pi error notifications", async () => {
  const lan = Object.values(networkInterfaces()).flat().find((iface) => iface?.family === "IPv4" && !iface.internal)?.address;
  assert.ok(lan, "A non-loopback IPv4 interface is required for the exact regression");
  const errors = [];
  const pending = [];
  const aIdentity = generateIdentity();
  const bIdentity = generateIdentity();
  const a = new WireMeshTransport(noopTransportEvents({ onError: (error) => errors.push(error.message) }), aIdentity);
  const b = new WireMeshTransport(noopTransportEvents(), bIdentity);
  try {
    await b.startDataServer();
    const presence = new FirstContact({ peerId: id(aIdentity), dataPort: 1, name: "regression", onPeerDiscovered: (peer) => pending.push(a.connectToPeer({ id: peer.peerId, host: peer.host, port: peer.port }, id(aIdentity))) });
    presence.handlePacket(packet(id(bIdentity), b.dataPort), { address: lan });
    await Promise.all(pending);
    assert.deepEqual(errors, [], "The same onError callback that Pi displays must stay empty");
    assert.equal(pending.length, 0, "Do not attempt a known-unreachable cross-machine data dial");
  } finally {
    await a.shutdown();
    await b.shutdown();
  }
});

test("old coordinator LAN peer lists cannot bypass local-only automatic dials", async () => {
  const errors = [];
  const identity = generateIdentity();
  const transport = new WireMeshTransport(noopTransportEvents({ onError: (error) => errors.push(error.message) }), identity);
  try {
    await transport.connectToPeer({ id: "stale-lan-peer", host: "192.0.2.1", port: 1 }, id(identity));
    assert.deepEqual(errors, []);
    assert.equal(transport.dataDials.size, 0);
  } finally { await transport.shutdown(); }
});

test("loopback discovery still establishes TLS and delivers a real mesh frame", async () => {
  const errors = [];
  const messages = [];
  const pending = [];
  const aIdentity = generateIdentity();
  const bIdentity = generateIdentity();
  const a = new WireMeshTransport(noopTransportEvents({ onError: (error) => errors.push(error.message) }), aIdentity);
  const b = new WireMeshTransport(noopTransportEvents({ onMessage: (_peerId, message) => messages.push(message), onError: (error) => errors.push(error.message) }), bIdentity);
  try {
    await b.startDataServer();
    const presence = new FirstContact({ peerId: id(aIdentity), dataPort: 1, name: "regression", onPeerDiscovered: (peer) => pending.push(a.connectToPeer({ id: peer.peerId, host: peer.host, port: peer.port }, id(aIdentity))) });
    presence.handlePacket(packet(id(bIdentity), b.dataPort), { address: "127.0.0.1" });
    await Promise.all(pending);
    assert.equal(pending.length, 1);
    const message = { method: "peer_left", peerId: "regression-delivery" };
    await a.send({ id: id(bIdentity) }, message);
    await waitFor(() => messages.some((message) => message.method === "peer_left" && message.peerId === "regression-delivery"), "local TLS message", 3000);
    assert.deepEqual(errors, []);
  } finally {
    await a.shutdown();
    await b.shutdown();
  }
});

test("mesh beacons and probes stay on loopback multicast; web discovery is preserved", () => {
  const sends = [];
  const discovered = [];
  const web = [];
  const presence = new FirstContact({ peerId: "self", dataPort: 43210, name: "regression", onPeerDiscovered: (peer) => discovered.push(peer), onWebBeacon: (peer) => web.push(peer) });
  presence.socket = { send: (...args) => sends.push(args) };
  presence.sendBeacon();
  presence.sendProbe();
  assert.equal(sends.length, 2);
  assert.ok(sends.every((args) => args[2] === FIRST_CONTACT_GROUP));
  sends.length = 0;
  presence.handlePacket(Buffer.from('{"type":"agent-comms-probe"}'), { address: "192.0.2.1" });
  assert.equal(sends.length, 0, "Do not answer LAN mesh probes with loopback-only ports");
  presence.handlePacket(packet("local", 43211), { address: "127.0.0.1" });
  presence.handlePacket(packet("local", 43211), { address: "127.0.0.1" });
  assert.equal(discovered.length, 1, "Keep local deduplication");
  presence.handlePacket(Buffer.from('{"type":"agent-comms-web-beacon","peerId":"web","webPort":8080}'), { address: "192.0.2.1" });
  assert.equal(web.length, 1, "Independent LAN web-UI discovery must not be disabled");
});

test("genuine local connection errors are still reported, not filtered away", async () => {
  const errors = [];
  const identity = generateIdentity();
  const transport = new WireMeshTransport(noopTransportEvents({ onError: (error) => errors.push(error.message) }), identity);
  try {
    await transport.connectToPeer({ id: "missing-peer", host: "127.0.0.1", port: 1 }, id(identity));
    assert.ok(errors.some((error) => /connectToPeer.*ECONNREFUSED/.test(error)));
  } finally {
    await transport.shutdown();
  }
});
