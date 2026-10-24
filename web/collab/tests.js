import { create_replica, new_identity, byte_length } from './core.js';
import { bind_field } from './input.js';
import { WebRTCTransport, connect_local_pair } from './webrtc.js';
const results = document.querySelector('#results');
let passed = 0, failed = 0;
const assert = (value, message = 'Assertion failed') => { if (!value) throw new Error(message); };
async function until(predicate, timeout = 10000) {
  const deadline = performance.now() + timeout;
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error('Convergence timeout');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
async function pair() { const document_id = new_identity(); return Promise.all([create_replica({ document_id }), create_replica({ document_id })]); }
async function test(name, run) {
  const li = document.createElement('li'); results.append(li);
  try { await run(); passed++; li.textContent = `PASS ${name}`; }
  catch (error) { failed++; li.textContent = `FAIL ${name}: ${error.message}`; console.error(error); }
}
await test('Actual WebRTC: simultaneous offline edits, own undo, reconnect and duplicate sync', async () => {
  const [a, b] = await pair(); let connection;
  try {
    a.replace_text(0, 0, 'ab'); b.merge(a.export_state());
    a.replace_text(1, 1, '한'); b.replace_text(1, 1, '😀');
    connection = await connect_local_pair(a, b);
    await until(() => a.snapshot.text === b.snapshot.text);
    assert(a.snapshot.text.includes('한') && a.snapshot.text.includes('😀'));
    a.undo(); await until(() => a.snapshot.text === b.snapshot.text);
    assert(a.snapshot.text.includes('😀') && !a.snapshot.text.includes('한'));
    connection.close(); connection = null;
    a.replace_text(0, 0, 'A'); b.replace_text(byte_length(b.snapshot.text), byte_length(b.snapshot.text), 'B');
    connection = await connect_local_pair(a, b);
    await until(() => a.snapshot.text === b.snapshot.text);
    const before = a.snapshot.text; a.merge(b.export_state()); a.merge(b.export_state());
    assert(a.snapshot.text === before && a.snapshot.pending === 0);
  } finally { connection?.close(); a.destroy(); b.destroy(); }
});
await test('Actual WebRTC: fragmented Unicode update and bounded backpressure', async () => {
  const [a, b] = await pair(); let connection;
  try {
    connection = await connect_local_pair(a, b);
    const text = '한😀x'.repeat(18000);
    a.replace_text(0, 0, text);
    await until(() => b.snapshot.text === text, 20000);
    assert(a.snapshot.markdown === b.snapshot.markdown);
    assert(connection.transports.every(transport => transport.queued_bytes === 0));
  } finally { connection?.close(); a.destroy(); b.destroy(); }
});
await test('Actual WebRTC: stable table cells, concurrent row insertion and retained deleted row', async () => {
  const [a, b] = await pair(); let connection;
  try {
    a.create_table(0, 2, 2); b.merge(a.export_state());
    const table = a.snapshot.tables[0], row = table.rows[1];
    const scope = { table: table.id, row, column: table.columns[0] };
    a.delete_row(table.id, row); b.replace_text(0, 0, '==원격 셀==', scope);
    a.insert_row(table.id, table.rows[0]); b.insert_row(table.id, table.rows[0]);
    connection = await connect_local_pair(a, b);
    await until(() => a.snapshot.markdown === b.snapshot.markdown && a.snapshot.operation_count === b.snapshot.operation_count);
    a.undo(); a.undo();
    await until(() => a.snapshot.markdown === b.snapshot.markdown);
    assert(b.snapshot.markdown.includes('원격 셀'));
    assert(b.snapshot.html.includes('data-kind="highlight"'));
  } finally { connection?.close(); a.destroy(); b.destroy(); }
});
await test('Captured composition, relative anchors, persistence and no remote update echo', async () => {
  const [a, b] = await pair();
  try {
    a.replace_text(0, 0, 'abc'); b.merge(a.export_state());
    const capture = a.capture_range(1, 2), anchor = a.anchor_at(1, 'before');
    b.replace_text(2, 2, '😀');
    let count = 0; a.addEventListener('update', () => count++);
    a.merge(b.export_state()); assert(count === 0);
    a.replace_capture(capture, '한'); b.merge(a.export_state());
    assert(count === 1 && a.snapshot.text === b.snapshot.text && b.snapshot.text.includes('😀'));
    assert(a.resolve_anchor(anchor) === 1);
    const restored = await create_replica({ document_id: a.snapshot.document_id });
    try { restored.merge(a.export_state()); assert(restored.snapshot.markdown === a.snapshot.markdown); } finally { restored.destroy(); }
  } finally { a.destroy(); b.destroy(); }
});
await test('Authorization rejects unknown peers before binary document exchange', async () => {
  const [a, b] = await pair();
  class FakeChannel extends EventTarget {
    ordered = true; maxRetransmits = null; maxPacketLifeTime = null; readyState = 'open'; bufferedAmount = 0;
    sent = []; send(value) { this.sent.push(value); } close() { this.readyState = 'closed'; }
  }
  const channel = new FakeChannel();
  const transport = new WebRTCTransport(a, channel, { authorize_peer: () => false });
  try {
    await Promise.resolve();
    channel.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'hello', protocol: 3, codec: 2, schema: 1, document_id: a.snapshot.document_id, actor_id: b.snapshot.actor_id }) }));
    await until(() => transport.closed);
    assert(channel.sent.length === 1 && typeof channel.sent[0] === 'string');
  } finally { transport.close(); a.destroy(); b.destroy(); }
});
await test('Malformed fragment is rejected and transport listeners are removed', async () => {
  const [a, b] = await pair();
  class FakeChannel extends EventTarget {
    ordered = true; maxRetransmits = null; maxPacketLifeTime = null; readyState = 'open'; bufferedAmount = 0;
    send() {} close() { this.readyState = 'closed'; }
  }
  const channel = new FakeChannel(), transport = new WebRTCTransport(a, channel, { authorize_peer: () => true });
  try {
    await Promise.resolve();
    channel.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'hello', protocol: 3, codec: 2, schema: 1, document_id: a.snapshot.document_id, actor_id: b.snapshot.actor_id }) }));
    await until(() => transport.ready);
    channel.dispatchEvent(new MessageEvent('message', { data: new ArrayBuffer(20) }));
    await until(() => transport.closed);
    assert(!transport.ready && transport.queued_bytes === 0);
  } finally { transport.close(); a.destroy(); b.destroy(); }
});
await test('Textarea composition keeps remote input, commits once, restores caret and cancels safely', async () => {
  const [a, b] = await pair(), field = document.createElement('textarea'); document.body.append(field);
  try {
    a.replace_text(0, 0, 'abc'); b.merge(a.export_state());
    const errors = [], binding = bind_field(a, field, null, error => errors.push(error));
    a.addEventListener('change', binding.refresh);
    field.focus(); field.setSelectionRange(1, 2);
    field.dispatchEvent(new CompositionEvent('compositionstart'));
    field.value = 'aㅎc';
    b.replace_text(2, 2, '😀'); a.merge(b.export_state());
    assert(field.value === 'aㅎc', 'Remote merge replaced composing DOM');
    const before = a.snapshot.operation_count;
    field.dispatchEvent(new CompositionEvent('compositionend', { data: '한' }));
    field.dispatchEvent(new InputEvent('input', { inputType: 'insertFromComposition', data: '한' }));
    await Promise.resolve();
    assert(a.snapshot.operation_count === before + 2, 'Composition committed twice');
    assert(field.value === a.snapshot.text && field.value.includes('😀') && field.value.includes('한'));
    assert(field.selectionStart === 2 && field.selectionEnd === 2, 'Caret did not follow local composition');
    b.merge(a.export_state()); assert(a.snapshot.text === b.snapshot.text);
    const saved = a.snapshot.text, count = a.snapshot.operation_count;
    field.setSelectionRange(1, 2); field.dispatchEvent(new CompositionEvent('compositionstart'));
    field.value = 'temporary'; field.dispatchEvent(new CompositionEvent('compositionend', { data: '' }));
    await Promise.resolve();
    assert(a.snapshot.text === saved && field.value === saved && a.snapshot.operation_count === count, 'Canceled composition deleted selected text');
    assert(errors.length === 0);
  } finally { field.remove(); a.destroy(); b.destroy(); }
});
await test('Textarea stable selection follows remote Unicode insertion', async () => {
  const [a, b] = await pair(), field = document.createElement('textarea'); document.body.append(field);
  try {
    a.replace_text(0, 0, 'abc'); b.merge(a.export_state());
    const binding = bind_field(a, field); a.addEventListener('change', binding.refresh);
    field.focus(); field.setSelectionRange(1, 2); field.dispatchEvent(new Event('select'));
    b.replace_text(0, 0, '한😀'); a.merge(b.export_state());
    assert(field.value === '한😀abc' && field.selectionStart === 4 && field.selectionEnd === 5);
  } finally { field.remove(); a.destroy(); b.destroy(); }
});
await test('Stable snapshots, error codes, reentry rules and repeatable replica teardown', async () => {
  const [a,b]=await pair();
  try {
    a.replace_text(0,0,'한😀');const snapshot=a.snapshot;
    assert(Object.isFrozen(snapshot)&&Object.isFrozen(snapshot.tables));
    let error;try{snapshot.text='bad';}catch(caught){error=caught;}assert(error instanceof TypeError);
    a.addEventListener('change',()=>{a.export_state();let error;try{a.undo();}catch(caught){error=caught;}assert(error?.code==='ReentrantCall');});
    a.replace_text(7,7,'!');assert(snapshot.text==='한😀');b.merge(a.export_state());assert(a.snapshot.text===b.snapshot.text);
    a.destroy();a.destroy();try{a.export_state();}catch(caught){error=caught;}assert(error?.code==='Destroyed');
  }finally{a.destroy();b.destroy();}
});
await test('Actual WebRTC: three-peer full mesh converges after offline edits and reconnect', async () => {
  const document_id=new_identity(),actors=await Promise.all([0,1,2].map(()=>create_replica({document_id})));let connections=[];
  const connect=async()=>{for(const [left,right]of [[0,1],[0,2],[1,2]])connections.push(await connect_local_pair(actors[left],actors[right]));};
  const converged=()=>actors.every(actor=>actor.snapshot.text===actors[0].snapshot.text&&actor.snapshot.operation_count===actors[0].snapshot.operation_count&&actor.snapshot.pending===0);
  try {
    actors[0].replace_text(0,0,'seed');actors[1].merge(actors[0].export_state());actors[2].merge(actors[0].export_state());await connect();
    actors.forEach((actor,i)=>actor.replace_text(0,0,['한','😀','C'][i]));await until(()=>converged()&&actors[0].snapshot.text.includes('C'));
    connections.forEach(connection=>connection.close());connections=[];
    actors.forEach((actor,i)=>actor.replace_text(0,0,String(i)));await connect();await until(()=>converged()&&['0','1','2'].every(char=>actors[0].snapshot.text.includes(char)));
  }finally{connections.forEach(connection=>connection.close());actors.forEach(actor=>actor.destroy());}
});
await test('Actual WebRTC: destroying a replica closes its transport but preserves the peer document', async () => {
  const [a,b]=await pair();let connection;
  try {
    a.replace_text(0,0,'preserved');connection=await connect_local_pair(a,b);await until(()=>b.snapshot.text==='preserved');
    a.destroy();a.destroy();await until(()=>connection.transports.every(transport=>transport.closed));
    b.replace_text(0,0,'still alive ');assert(b.snapshot.text==='still alive preserved');
  }finally{connection?.close();a.destroy();b.destroy();}
});
document.querySelector('#summary').textContent = `${passed} passed / ${failed} failed`;
document.documentElement.dataset.result = failed ? 'failed' : 'passed';
