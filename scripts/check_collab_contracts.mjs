// Stable collaboration API/protocol contract tests, using real WASM and fixed wire fixtures.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CollaborativeReplica, CollaborationError, create_replica} from '../web/collab/core.js';
import {WebRTCTransport, TransportError, connect_local_pair} from '../web/collab/webrtc.js';
const wasm=await WebAssembly.compile(await readFile(new URL('../web/sohjae_collaborator.wasm',import.meta.url)));
const document_id='00000000000000000000000000000011', actor=n=>n.toString(16).padStart(32,'0');
const replica=async(n=99,document=document_id)=>new CollaborativeReplica((await WebAssembly.instantiate(wasm,{})).exports,document,actor(n));
let passed=0;
async function test(name,action){await action(); console.log(`PASS ${name}`);passed++;}
// Independent reference reader for the documented SCV2 schema; no production codec reuse.
function wire_tags(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let at=0;const tags=new Set();
 const take=n=>{assert(at+n<=bytes.length);at+=n;};
 const u8=()=>{const n=view.getUint8(at);take(1);return n;};
 const u32=()=>{const n=view.getUint32(at,true);take(4);return n;};
 const boolean=()=>{const n=u8();assert(n===0||n===1);return n;};
 const id=()=>take(24),atom=()=>take(28),optional=read=>{if(boolean())read();};
 const scope=()=>{const n=u8();assert(n===0||n===1);if(n){id();id();id();}};
 assert.equal(Buffer.from(bytes.subarray(0,4)).toString(),'SCV2');take(4);assert.equal(view.getUint16(at,true),2);take(2);take(16);
 const count=u32();
 for(let i=0;i<count;i++){
  id();const dependencies=u32();take(dependencies*24);const tag=u8();tags.add(tag);
  switch(tag){
   case 0: scope();optional(atom);take(u32());break;
   case 1: scope();take(u32()*28);break;
   case 2: optional(atom);break;
   case 3: case 4: id();optional(id);break;
   case 5: case 6: id();id();break;
   case 7: id();id();assert(u8()<=2);break;
   case 8: id();boolean();break;
   case 9: id();boolean();take(u32()*24);optional(id);break;
   default: assert.fail(`Unknown schema tag ${tag}`);
  }
 }
 assert.equal(at,bytes.length);return {tags,count};
}
await test('All schema tags 0–9 restore and re-encode the fixed canonical SCV2 log',async()=>{
 const bytes=await readFile(new URL('../spec/api/scv2-all-operations.bin',import.meta.url));
 const expected=JSON.parse(await readFile(new URL('../spec/api/scv2-all-operations.json',import.meta.url)));
 const parsed=wire_tags(bytes);assert.deepEqual([...parsed.tags].sort((a,b)=>a-b),Array.from({length:10},(_,i)=>i));assert.equal(parsed.count,expected.operation_count);
 const a=await replica();try{a.merge(bytes);assert.equal(a.snapshot.markdown,expected.markdown);assert.deepEqual(a.snapshot.tables,expected.tables);assert.deepEqual(a.export_state(),Uint8Array.from(bytes));}finally{a.destroy();}
});
await test('Factory rejects invalid identities before fetching; factory loads the actual independent WASM',async()=>{
 for(const document_id of [0,null,'0'.repeat(32),'x'.repeat(32)])await assert.rejects(create_replica({document_id,wasm_url:'invalid:not-fetched'}),TypeError);
 const bytes=await readFile(new URL('../web/sohjae_collaborator.wasm',import.meta.url));
 const wrong=await readFile(new URL('../web/sohjae_render.wasm',import.meta.url));
 await assert.rejects(create_replica({document_id,wasm_url:`data:application/wasm;base64,${wrong.toString('base64')}`}),error=>error instanceof CollaborationError&&error.code==='UnsupportedABI');
 const a=await create_replica({document_id,actor_id:actor(98),wasm_url:`data:application/wasm;base64,${bytes.toString('base64')}`});a.destroy();a.destroy();
});
await test('Invalid arguments preserve state; snapshots are deeply immutable',async()=>{
 const a=await replica();try{
  a.replace_text(0,0,'한😀');a.create_table(7,2,2);const table=a.snapshot.tables[0],before=a.export_state();
  for(const action of [()=>a.merge([]),()=>a.merge(new ArrayBuffer(0)),()=>a.replace_text(0,0,null),()=>a.replace_text(0,0,'x',false),()=>a.projected_anchor(0,'invalid'),()=>a.insert_row(table.id,''),()=>a.reorder(table.id,'row',[],null),()=>a.table_action(table.id,'clear',0,0,[]),()=>a.set_alignment(table.id,table.columns[0],'invalid'),()=>a.resolve_anchor([]),()=>a.replace_capture([], 'x')]){assert.throws(action);assert.deepEqual(a.export_state(),before);}
  assert.throws(()=>{a.snapshot.text='corrupt';},TypeError);assert.throws(()=>{a.snapshot.tables[0].rows.push('fake');},TypeError);assert.throws(()=>{a.snapshot={};},TypeError);
 }finally{a.destroy();}
});
await test('Event order, read-only reentry, mutation rejection, history and idempotent destruction',async()=>{
 const a=await replica(),events=[];let current;
 a.addEventListener('change',event=>{events.push('change');current=event.detail.snapshot;assert.equal(current,a.snapshot);a.export_state();a.anchor_at(0);assert.throws(()=>a.replace_text(0,0,'bad'),error=>error instanceof CollaborationError&&error.code==='ReentrantCall');});
 a.addEventListener('update',()=>events.push('update'));
 a.replace_text(0,0,'text');assert.deepEqual(events,['change','update']);assert.equal(current.text,'text');
 a.undo();a.redo();assert.equal(a.snapshot.text,'text');let destroyed=0;a.addEventListener('destroy',()=>destroyed++);a.destroy();a.destroy();assert.equal(destroyed,1);
 assert.throws(()=>a.export_state(),error=>error.code==='Destroyed');assert.equal(a.snapshot.text,'text');
});
class Channel extends EventTarget{
 ordered=true;maxRetransmits=null;maxPacketLifeTime=null;readyState='open';bufferedAmount=0;sent=[];closes=0;
 send(data){this.sent.push(typeof data==='string'?data:data.slice());}
 close(){this.readyState='closed';this.closes++;}
}
const hello=(a,patch={})=>({type:'hello',protocol:3,codec:2,schema:1,document_id:a.snapshot.document_id,actor_id:actor(88),...patch});
async function connected(authorize_peer=()=>true,options={}){
 const a=await replica(),channel=new Channel(),transport=new WebRTCTransport(a,channel,{authorize_peer,...options});await Promise.resolve();return {a,channel,transport};
}
async function incoming(channel,data){channel.dispatchEvent(new MessageEvent('message',{data}));await new Promise(resolve=>setTimeout(resolve,0));}
function frame(payload,{id=1,index=0,count=Math.ceil(payload.length/12288),total=payload.length}={}){
 const data=new Uint8Array(20+payload.length),view=new DataView(data.buffer);[0x32564353,id,index,count,total].forEach((v,i)=>view.setUint32(i*4,v,true));data.set(payload,20);return data.buffer;
}
await test('Handshake rejects unknown versions, schema, identity and malformed JSON before document exchange',async()=>{
 for(const value of [null,[],{},'{bad', {protocol:2},{codec:99},{schema:2},{actor_id:actor(99)},{actor_id:[actor(88)]},{document_id:actor(9)}]){
  let authorized=false;const {a,channel,transport}=await connected(()=>{authorized=true;return true;});let error;transport.addEventListener('error',event=>error=event.detail);
  try{const data=typeof value==='string'?value:JSON.stringify(value===null||Array.isArray(value)?value:hello(a,value));await incoming(channel,data);
   if(value&& !Array.isArray(value)&&typeof value==='object'&&Object.keys(value).length===0){assert(transport.ready);continue;}
   assert(transport.closed);assert(error instanceof TransportError);assert(!authorized);assert(channel.sent.every(data=>typeof data==='string'));
  }finally{transport.close();a.destroy();}
 }
});
await test('Authorization false, rejected promises, close-during-authorization and handshake timeout',async()=>{
 for(const authorize of [()=>false,async()=>{throw new Error('denied');}]){
  const {a,channel,transport}=await connected(authorize);let error;transport.addEventListener('error',event=>error=event.detail);await incoming(channel,JSON.stringify(hello(a)));assert.equal(error.code,'UNAUTHORIZED');assert(transport.closed);a.destroy();
 }
 let release;const {a,channel,transport}=await connected(()=>new Promise(resolve=>release=resolve));await incoming(channel,JSON.stringify(hello(a)));transport.close();release(true);await transport.incoming_chain;assert(!transport.ready);assert.equal(channel.sent.length,1);a.destroy();
 const timed=await connected(()=>true,{handshake_timeout_ms:10});const error=await new Promise(resolve=>timed.transport.addEventListener('error',event=>resolve(event.detail),{once:true}));assert.equal(error.code,'TIMEOUT');assert(timed.transport.closed);timed.a.destroy();
});
await test('Golden hello and fragments preserve payload bytes; queued updates drain under backpressure',async()=>{
 const {a,channel,transport}=await connected();try{
  const sent=JSON.parse(channel.sent[0]);assert.deepEqual(sent,{...hello(a),actor_id:a.snapshot.actor_id});
  await transport.receive(JSON.stringify(hello(a)));const initial=channel.sent[1],view=new DataView(initial.buffer);assert.equal(view.getUint32(0,true),0x32564353);assert.equal(view.getUint32(8,true),0);assert.equal(view.getUint32(12,true),1);assert.equal(view.getUint32(16,true),26);assert.deepEqual(initial.subarray(20),a.export_state());
  channel.bufferedAmount=512*1024;a.replace_text(0,0,'😀'.repeat(8000));assert(transport.queued_bytes>0);const saved=a.export_state();transport.send_update(saved);assert(transport.queued_bytes>saved.length);
  const start=channel.sent.length;channel.bufferedAmount=0;channel.dispatchEvent(new Event('bufferedamountlow'));assert.equal(transport.queued_bytes,0);
  const frames=channel.sent.slice(start);const lastId=new DataView(frames.at(-1).buffer).getUint32(4,true);const parts=frames.filter(f=>new DataView(f.buffer).getUint32(4,true)===lastId);const payload=Buffer.concat(parts.map(f=>f.subarray(20)));assert.deepEqual(payload,Buffer.from(saved));
 }finally{transport.close();a.destroy();}
});
await test('Invalid fragments and codec mutations never change a receiver document',async()=>{
 for(const kind of ['short','wrong-magic','wrong-count','out-of-order','wrong-total','corrupt-codec','duplicate-hello','overlap','invalid-type']){
  const {a,channel,transport}=await connected();try{
   await transport.receive(JSON.stringify(hello(a)));const before=a.export_state();let error;transport.addEventListener('error',event=>error=event.detail);
   let data=frame(before);
   if(kind==='invalid-type')data=null;
   if(kind==='short')data=new ArrayBuffer(19);
   if(kind==='wrong-magic')new DataView(data).setUint32(0,0,true);
   if(kind==='wrong-count')new DataView(data).setUint32(12,99,true);
   if(kind==='out-of-order')new DataView(data).setUint32(8,1,true);
   if(kind==='wrong-total')new DataView(data).setUint32(16,1,true);
   if(kind==='corrupt-codec')new Uint8Array(data)[24]=99;
   if(kind==='duplicate-hello')data=JSON.stringify(hello(a));
   if(kind==='overlap'){
    const partial=frame(new Uint8Array(12288),{count:2,total:12289});await incoming(channel,partial);data=partial;
   }
   await incoming(channel,data);assert(transport.closed,kind);assert(error instanceof TransportError,kind);assert.deepEqual(a.export_state(),before,kind);
  }finally{transport.close();a.destroy();}
 }
});
await test('Initial send failures never emit ready; replica teardown closes transports exactly once',async()=>{
 const failed=await connected();let ready=0,error;failed.transport.addEventListener('ready',()=>ready++);failed.transport.addEventListener('error',event=>error=event.detail);
 failed.channel.send=()=>{throw new Error('send failed');};await failed.transport.receive(JSON.stringify(hello(failed.a)));assert.equal(ready,0);assert.equal(error.code,'CHANNEL_ERROR');assert(failed.transport.closed);failed.a.destroy();
 const {a,channel,transport}=await connected();let closed=0;transport.addEventListener('close',()=>closed++);a.destroy();a.destroy();transport.close();assert.equal(closed,1);assert.equal(channel.closes,1);
});
await test('Queue quota, failed initial export and failed hello are terminal with stable codes',async()=>{
 const queued=await connected();let error;queued.transport.addEventListener('error',event=>error=event.detail);
 try{await queued.transport.receive(JSON.stringify(hello(queued.a)));queued.channel.bufferedAmount=512*1024;const bytes=new Uint8Array(16*1024*1024);queued.transport.send_update(bytes);queued.transport.send_update(bytes);assert.equal(error.code,'RESOURCE_LIMIT');assert(queued.transport.closed);assert.equal(queued.transport.queued_bytes,0);}finally{queued.transport.close();queued.a.destroy();}
 const exported=await connected();let ready=0;exported.transport.addEventListener('ready',()=>ready++);exported.transport.addEventListener('error',event=>error=event.detail);exported.a.export_state=()=>{throw new CollaborationError('ResourceLimit','too large');};await incoming(exported.channel,JSON.stringify(hello(exported.a)));assert.equal(error.code,'SYNC_FAILED');assert.equal(ready,0);assert(exported.transport.closed);exported.a.destroy();
 const a=await replica(),channel=new Channel();channel.send=()=>{throw new Error('hello failed');};const transport=new WebRTCTransport(a,channel,{authorize_peer:()=>true});error=await new Promise(resolve=>transport.addEventListener('error',event=>resolve(event.detail),{once:true}));assert.equal(error.code,'CHANNEL_ERROR');assert(transport.closed);a.destroy();
});
await test('Local RTC helper forwards end-of-candidates and closes failed ICE peers',async()=>{
 const original=globalThis.RTCPeerConnection,peers=[],a=await replica(71),b=await replica(72);
 class Peer {
  constructor(config){this.config=config;this.iceConnectionState='new';this.candidates=[];peers.push(this);}
  createDataChannel(){const channel=new Channel();channel.readyState='connecting';return channel;}
  async createOffer(){return {type:'offer',sdp:''};} async createAnswer(){return {type:'answer',sdp:''};}
  async setLocalDescription(sdp){this.localDescription=sdp;this.onicecandidate({candidate:null});}
  async setRemoteDescription(sdp){this.remoteDescription=sdp;if(sdp.type==='answer')queueMicrotask(()=>{this.iceConnectionState='failed';this.oniceconnectionstatechange();});}
  async addIceCandidate(candidate){this.candidates.push(candidate);}
  close(){this.closed=true;}
 }
 try{globalThis.RTCPeerConnection=Peer;
  await assert.rejects(connect_local_pair(a,b,{ice_servers:[{urls:'stun:example.test'}]}),error=>error.code==='ICE_CONNECTION_FAILED'&&error.message.includes('failed'));
  assert(peers.every(peer=>peer.closed));assert(peers.every(peer=>peer.candidates.includes(null)));assert.equal(peers[0].config.iceServers[0].urls,'stun:example.test');
 }finally{globalThis.RTCPeerConnection=original;a.destroy();b.destroy();}
});
console.log(`Collaboration contracts: ${passed}/${passed} passed.`);
