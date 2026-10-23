// ABI v2. Each replica owns an independent WASM instance and actor identity.
export { byte_length, byte_to_utf16, utf16_to_byte } from '../core.js';
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
const modules = new Map();
export function new_identity() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
function integer_bytes(hex, length) {
  if (!new RegExp(`^[0-9a-f]{${length * 2}}$`, 'iu').test(hex) || !BigInt(`0x${hex}`)) throw new TypeError('Invalid identity');
  let value = BigInt(`0x${hex}`);
  return Uint8Array.from({ length }, () => { const byte = Number(value & 255n); value >>= 8n; return byte; });
}
function id_bytes(id) {
  const parts = id.split('-');
  if (parts.length !== 2) throw new TypeError('Invalid operation ID');
  return concat(integer_bytes(parts[0], 8), integer_bytes(parts[1], 16));
}
function u32(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError('Invalid u32');
  const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value, true); return bytes;
}
function concat(...parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.length; } return result;
}
function scope_bytes(scope) {
  return scope ? concat(Uint8Array.of(1), id_bytes(scope.table), id_bytes(scope.row), id_bytes(scope.column)) : Uint8Array.of(0);
}
export async function create_replica({ document_id, actor_id = new_identity(), wasm_url = new URL('../sohjae_core.wasm', import.meta.url) }) {
  const key = String(wasm_url);
  if (!modules.has(key)) modules.set(key, fetch(wasm_url).then(async response => {
    if (!response.ok) throw new Error(`WASM load failed: ${response.status}`);
    return WebAssembly.compile(await response.arrayBuffer());
  }).catch(error => { modules.delete(key); throw error; }));
  const instance = await WebAssembly.instantiate(await modules.get(key), {});
  return new CollaborativeReplica(instance.exports, document_id, actor_id);
}
export class CollaborativeReplica extends EventTarget {
  constructor(exports, document_id, actor_id) {
    super(); this.exports = exports; this.handle = 0;
    if (exports.collab_abi_version() !== 2) throw new Error('Unsupported collaboration ABI');
    this.request(0, concat(integer_bytes(document_id, 16), integer_bytes(actor_id, 16)));
  }
  request(op, bytes = new Uint8Array(), start = 0, end = start) {
    u32(start); u32(end);
    if (op !== 0 && !this.handle) throw new Error('Replica is destroyed');
    const pointer = this.exports.collab_reserve_input(bytes.length);
    if (!pointer) throw new RangeError('Input exceeds 16 MiB');
    new Uint8Array(this.exports.memory.buffer, pointer, bytes.length).set(bytes);
    const status = this.exports.collab_dispatch(op, this.handle, start, end);
    const output = new Uint8Array(this.exports.memory.buffer, this.exports.collab_output_pointer(), this.exports.collab_output_length()).slice();
    if (status) throw new Error(`Collaboration core: ${decoder.decode(output)}`);
    if (op === 1) { this.handle = 0; return; }
    if ([4, 16, 17, 18, 22, 23, 24, 32].includes(op)) return output;
    const view = new DataView(output.buffer), json_length = view.getUint32(0, true);
    const state = JSON.parse(decoder.decode(output.subarray(4, 4 + json_length)));
    const length = view.getUint32(4 + json_length, true), update = output.slice(8 + json_length);
    if (length !== update.length) throw new Error('Invalid ABI envelope');
    this.handle = state.handle; this.snapshot = state;
    const origin = op === 3 ? 'remote' : 'local';
    // Install snapshot before emitting: listeners may synchronously read it.
    this.dispatchEvent(new CustomEvent('change', { detail: { snapshot: state, origin } }));
    if (update.length && new DataView(update.buffer).getUint32(22, true)) this.dispatchEvent(new CustomEvent('update', { detail: update }));
    return state;
  }
  coalesce_history() { this.request(32); return this.snapshot; }
  reorder(table, axis, targets, before = null) {
    if (!['row','column'].includes(axis)) throw new TypeError('Invalid table axis');
    return this.request(31, concat(id_bytes(table), Uint8Array.of(axis === 'column' ? 1 : 0), u32(targets.length), ...targets.map(id_bytes), Uint8Array.of(before ? 1 : 0), ...(before ? [id_bytes(before)] : [])));
  }
  table_action(table, action, row, column, range = [row,row,column,column]) {
    const actions = ['row_before','row_after','column_before','column_after','delete_rows','delete_columns','clear','align_left','align_center','align_right','delete_table'];
    const index = actions.indexOf(action); if (index < 0) throw new Error('Unknown table action');
    return this.request(26, concat(id_bytes(table), u32(row), u32(column), ...range.map(u32), Uint8Array.of(index)));
  }
  import_markdown(source) { return this.request(20, encoder.encode(source.replace(/\r\n?/gu, '\n'))); }
  replace_projected_text(start,end,text) { return this.request(30,encoder.encode(text.replace(/\r\n?/gu,'\n')),start,end); }
  replace_markdown(start, end, text) { return this.request(21, encoder.encode(text.replace(/\r\n?/gu, '\n')), start, end); }
  projected_anchor(offset, bias = 'after') { return this.request(22, new Uint8Array(), offset, bias === 'after' ? 1 : 0); }
  resolve_projected_anchor(anchor) { const bytes = this.request(23, anchor); return new DataView(bytes.buffer).getUint32(0, true); }
  projected_capture(start, end) { return this.request(24, new Uint8Array(), start, end); }
  replace_text(start, end, text, scope = null) {
    const bytes = encoder.encode(text.replace(/\r\n?/gu, '\n'));
    return scope ? this.request(9, concat(id_bytes(scope.table), id_bytes(scope.row), id_bytes(scope.column), bytes), start, end) : this.request(2, bytes, start, end);
  }
  capture_range(start, end, scope = null) { return this.request(18, scope_bytes(scope), start, end); }
  replace_capture(capture, text) { return this.request(19, concat(u32(capture.length), capture, encoder.encode(text.replace(/\r\n?/gu, '\n')))); }
  anchor_at(offset, bias = 'after', scope = null) {
    if (!['before', 'after'].includes(bias)) throw new TypeError('Invalid bias');
    return this.request(16, scope_bytes(scope), offset, bias === 'after' ? 1 : 0);
  }
  resolve_anchor(anchor) { const bytes = this.request(17, anchor); return new DataView(bytes.buffer).getUint32(0, true); }
  merge(bytes) { return this.request(3, bytes); }
  export_state() { return this.request(4); }
  undo() { return this.request(6); }
  redo() { return this.request(7); }
  create_table(offset, rows = 2, columns = 2) { return this.request(8, concat(u32(rows), u32(columns)), offset); }
  insert_row(table, after = null) { return this.request(10, concat(id_bytes(table), Uint8Array.of(after ? 1 : 0), ...(after ? [id_bytes(after)] : []))); }
  insert_column(table, after = null) { return this.request(11, concat(id_bytes(table), Uint8Array.of(after ? 1 : 0), ...(after ? [id_bytes(after)] : []))); }
  delete_row(table, row) { return this.request(12, concat(id_bytes(table), id_bytes(row))); }
  delete_column(table, column) { return this.request(13, concat(id_bytes(table), id_bytes(column))); }
  set_alignment(table, column, alignment) {
    const value = ['left', 'center', 'right'].indexOf(alignment);
    if (value < 0) throw new TypeError('Invalid alignment');
    return this.request(14, concat(id_bytes(table), id_bytes(column), Uint8Array.of(value)));
  }
  clear_local_history() { return this.request(28); }
  destroy() { this.request(1); }
}
