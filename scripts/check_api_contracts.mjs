// Public SDK compatibility checks; Node built-ins and real WASM only.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { create_renderer, Renderer } from '../web/renderer.js';
import { Core } from '../web/core.js';
import { CollaborativeReplica } from '../web/collab/core.js';
import { WebRTCTransport } from '../web/collab/webrtc.js';
const bytes = name => readFile(new URL(`../web/${name}.wasm`, import.meta.url));
const instantiate = async name => (await WebAssembly.instantiate(await bytes(name), {})).instance.exports;
const re = await instantiate('sohjae_render');
assert.throws(() => new Renderer({ ...re, renderer_abi_version: () => 99 }), /Unsupported/);
const url = `data:application/wasm;base64,${(await bytes('sohjae_render')).toString('base64')}`;
const first = await create_renderer({ wasm_url: url }), second = await create_renderer({ wasm_url: url });
first.destroy(); assert.match(second.render('**independent**'), /<strong/); second.destroy();
const ee = await instantiate('sohjae_editor');
assert.throws(() => new Core({ ...ee, abi_version: () => 99 }), /Unsupported/);
const core = new Core(ee); core.request(0, '한😀');
for (const offset of [-1, 0.5, NaN, Infinity, 2 ** 32, 1]) {
  assert.throws(() => core.request(3, 'bad', offset, offset));
  assert.equal(core.request(7).source, '한😀');
}
core.request(1);
const ce = await instantiate('sohjae_collaborator');
const expected = JSON.parse(await readFile(new URL('../spec/api/scv2-schema1.json', import.meta.url)));
const actor = '00000000000000000000000000000002';
assert.throws(() => new CollaborativeReplica({ ...ce, collab_schema_capabilities: undefined }, expected.document_id, actor), /schema/);
assert.throws(() => new CollaborativeReplica({ ...ce, collab_schema_capabilities: () => 2 }, expected.document_id, actor), /schema/);
const replica = new CollaborativeReplica(ce, expected.document_id, actor);
const saved = await readFile(new URL('../spec/api/scv2-schema1.bin', import.meta.url));
replica.merge(saved); assert.equal(replica.snapshot.markdown, expected.markdown);
const before = replica.export_state();
for (const mutate of [b => b[4] = 99, b => b[0] = 0, b => b[6] ^= 1]) {
  const invalid = Uint8Array.from(saved); mutate(invalid);
  assert.throws(() => replica.merge(invalid));
  assert.deepEqual(replica.export_state(), before);
}
class Channel extends EventTarget {
  ordered = true; maxRetransmits = null; maxPacketLifeTime = null;
  readyState = 'open'; bufferedAmount = 0; sent = [];
  send(data) { this.sent.push(data); }
  close() { this.readyState = 'closed'; }
}
const hello = { type: 'hello', protocol: 3, codec: 2, schema: 1, document_id: expected.document_id, actor_id: '00000000000000000000000000000003' };
for (const patch of [{protocol:2}, {codec:99}, {schema:0}, {schema:2}]) {
  const channel = new Channel(); let authorized = false;
  const transport = new WebRTCTransport(replica, channel, { authorize_peer: () => { authorized = true; return true; } });
  await Promise.resolve();
  const failure = new Promise(resolve => transport.addEventListener('error', event => resolve(event.detail), {once:true}));
  channel.dispatchEvent(new MessageEvent('message', {data:JSON.stringify({...hello,...patch})}));
  assert.match((await failure).message, /Incompatible/);
  assert(!authorized); assert(transport.closed); assert(channel.sent.every(data => typeof data === 'string'));
}
const channel = new Channel(), transport = new WebRTCTransport(replica, channel, {authorize_peer:()=>true});
await Promise.resolve(); await transport.receive(JSON.stringify(hello));
assert(transport.ready); assert(channel.sent.some(data => data instanceof Uint8Array)); transport.close();
replica.destroy();
console.log('API contracts: ABI rejection, isolated renderer lifecycles, strict UTF-8 offsets, archived SCV2 restore, atomic rejection and transport schema negotiation passed.');
