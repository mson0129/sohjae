import { COLLABORATION_PROFILE } from './core.js';
// Transport only. Signaling, room authorization and TURN credentials belong to the host.
const max_frame = 16 * 1024 * 1024, chunk_size = 12 * 1024;
const magic = 0x32564353, header_size = 20;
export class TransportError extends Error {
  constructor(code, message) { super(message); this.name = 'TransportError'; Object.defineProperty(this, 'code', {value:code, enumerable:true}); }
}
export class WebRTCTransport extends EventTarget {
  get ready() { return this._ready; }
  get closed() { return this._closed; }
  constructor(replica, channel, { authorize_peer, handshake_timeout_ms = 15000 } = {}) {
    super();
    if (!replica?.handle) throw new TypeError('A live replica is required');
    if (!Number.isInteger(handshake_timeout_ms) || handshake_timeout_ms < 1 || handshake_timeout_ms > 2147483647) throw new RangeError('Invalid handshake timeout');
    if (!channel || !['open','connecting'].includes(channel.readyState)) throw new TypeError('An open or connecting channel is required');
    if (typeof authorize_peer !== 'function') throw new TypeError('authorize_peer is required');
    if (!channel.ordered || channel.maxRetransmits !== null || channel.maxPacketLifeTime !== null) throw new TypeError('A reliable ordered RTCDataChannel is required');
    this.replica = replica; this.channel = channel; this.authorize_peer = authorize_peer;
    this._ready = false; this._closed = false; this.queue = []; this.queued_bytes = 0; this.transfer_id = 0;
    this.incoming_bytes = 0; this.incoming_chain = Promise.resolve(); this.assembly = null;
    channel.binaryType = 'arraybuffer'; channel.bufferedAmountLowThreshold = 128 * 1024;
    this.on_update = event => { if (this.ready) this.send_update(event.detail); };
    this.on_open = () => { try { this.send_hello(); } catch (error) { this.fail(error); } };
    this.on_destroy = () => this.close();
    this.on_low = () => this.flush();
    this.on_close = () => this.close();
    this.on_error = () => this.fail(new TransportError('CHANNEL_ERROR', 'RTCDataChannel error'));
    this.on_message = event => {
      if (typeof event.data !== 'string' && !(event.data instanceof ArrayBuffer)) return this.fail(new TransportError('INVALID_FRAME', 'Expected a text or ArrayBuffer message'));
      const size = typeof event.data === 'string' ? event.data.length * 2 : event.data.byteLength;
      if (!Number.isFinite(size) || size > chunk_size + header_size || this.incoming_bytes + size > max_frame * 2) return this.fail(new TransportError('RESOURCE_LIMIT', 'Incoming transport limit exceeded'));
      this.incoming_bytes += size;
      this.incoming_chain = this.incoming_chain.then(() => this.receive(event.data)).catch(error => this.fail(error)).finally(() => { this.incoming_bytes -= size; });
    };
    replica.addEventListener('update', this.on_update);
    replica.addEventListener('destroy', this.on_destroy);
    channel.addEventListener('open', this.on_open);
    channel.addEventListener('bufferedamountlow', this.on_low);
    channel.addEventListener('message', this.on_message);
    channel.addEventListener('close', this.on_close);
    channel.addEventListener('error', this.on_error);
    this.handshake_timer = setTimeout(() => this.fail(new TransportError('TIMEOUT', 'Peer handshake timeout')), handshake_timeout_ms);
    if (channel.readyState === 'open') queueMicrotask(this.on_open);
  }
  send_hello() {
    if (this.closed || this.hello_sent) return;
    this.hello_sent = true;
    this.channel.send(JSON.stringify({ type: 'hello', protocol: COLLABORATION_PROFILE.protocol, codec: COLLABORATION_PROFILE.codec, schema: COLLABORATION_PROFILE.schema, document_id: this.replica.snapshot.document_id, actor_id: this.replica.snapshot.actor_id }));
  }
  async receive(data) {
    if (this.closed) return;
    if (typeof data === 'string') {
      if (this.hello_received) throw new TransportError('INVALID_FRAME', 'Duplicate handshake');
      let hello;
      try { hello = JSON.parse(data); } catch { throw new TransportError('INVALID_FRAME', 'Invalid handshake JSON'); }
      const state = this.replica.snapshot;
      if (!hello || typeof hello !== 'object' || Array.isArray(hello)) throw new TransportError('INVALID_FRAME', 'Invalid handshake');
      if (hello.protocol !== COLLABORATION_PROFILE.protocol || hello.codec !== COLLABORATION_PROFILE.codec || hello.schema !== COLLABORATION_PROFILE.schema) throw new TransportError('UNSUPPORTED_PROTOCOL', 'Incompatible collaboration protocol or operation schema');
      if (hello.type !== 'hello' || hello.document_id !== state.document_id || typeof hello.actor_id !== 'string' || !/^[0-9a-f]{32}$/u.test(hello.actor_id) || /^0+$/u.test(hello.actor_id) || hello.actor_id === state.actor_id) throw new TransportError('IDENTITY_MISMATCH', 'Invalid peer identity or document');
      this.hello_received = true;
      let authorized;
      try { authorized = await this.authorize_peer(Object.freeze({ ...hello })); } catch { throw new TransportError('UNAUTHORIZED', 'Peer authorization failed'); }
      if (authorized !== true) throw new TransportError('UNAUTHORIZED', 'Peer authorization rejected');
      if (this.closed) return;
      this.peer_actor_id = hello.actor_id; this._ready = true; clearTimeout(this.handshake_timer);
      let exported;
      try { exported = this.replica.export_state(); } catch { throw new TransportError('SYNC_FAILED', 'Cannot export document for synchronization'); }
      this.send_update(exported);
      if (!this.closed) this.dispatchEvent(new Event('ready'));
      return;
    }
    if (!this.ready || !(data instanceof ArrayBuffer) || data.byteLength < header_size) throw new TransportError('INVALID_FRAME', 'Unexpected binary message');
    const view = new DataView(data), transfer_id = view.getUint32(4, true), index = view.getUint32(8, true), count = view.getUint32(12, true), total = view.getUint32(16, true);
    if (view.getUint32(0, true) !== magic || total < 26 || total > max_frame || count !== Math.ceil(total / chunk_size) || index >= count) throw new TransportError('INVALID_FRAME', 'Invalid fragment header');
    if (index === 0) {
      if (this.assembly) throw new TransportError('INVALID_FRAME', 'Overlapping fragment transfer');
      this.assembly = { transfer_id, count, total, next: 0, bytes: new Uint8Array(total), timer: setTimeout(() => this.fail(new TransportError('TIMEOUT', 'Fragment timeout')), 30000) };
    }
    const assembly = this.assembly;
    const expected_length = Math.min(chunk_size, total - index * chunk_size);
    if (!assembly || assembly.transfer_id !== transfer_id || assembly.count !== count || assembly.total !== total || assembly.next !== index || data.byteLength !== header_size + expected_length) throw new TransportError('INVALID_FRAME', 'Invalid fragment sequence');
    assembly.bytes.set(new Uint8Array(data, header_size), index * chunk_size); assembly.next++;
    if (assembly.next === count) {
      clearTimeout(assembly.timer); this.assembly = null;
      let snapshot;
      try { snapshot = this.replica.merge(assembly.bytes); } catch { throw new TransportError('INVALID_FRAME', 'Invalid collaboration update'); }
      if (snapshot.rejected) throw new TransportError('INVALID_OPERATIONS', 'Peer sent invalid operations');
      this.dispatchEvent(new CustomEvent('sync', { detail: snapshot }));
    }
  }
  send_update(bytes) {
    if (this.closed || !this.ready) return;
    try {
      if (!(bytes instanceof Uint8Array) || bytes.length < 26 || bytes.length > max_frame) throw new TransportError('INVALID_FRAME', 'Invalid update length');
      const count = Math.ceil(bytes.length / chunk_size), cost = bytes.length + count * header_size;
      if (this.queued_bytes + cost > max_frame * 2) throw new TransportError('RESOURCE_LIMIT', 'Outgoing transport limit exceeded; reconnect to resync');
      const transfer_id = this.transfer_id = (this.transfer_id + 1) >>> 0;
      for (let index = 0; index < count; index++) {
        const part = bytes.subarray(index * chunk_size, (index + 1) * chunk_size), frame = new Uint8Array(header_size + part.length), view = new DataView(frame.buffer);
        [magic, transfer_id, index, count, bytes.length].forEach((value, offset) => view.setUint32(offset * 4, value, true));
        frame.set(part, header_size); this.queue.push(frame); this.queued_bytes += frame.length;
      }
      this.flush();
    } catch (error) { this.fail(error); }
  }
  flush() {
    if (this.closed || this.channel.readyState !== 'open') return;
    try {
      while (this.queue.length && this.channel.bufferedAmount < 512 * 1024) {
        const frame = this.queue.shift(); this.channel.send(frame); this.queued_bytes -= frame.length;
      }
    } catch (error) { this.fail(error); }
  }
  fail(error) {
    if (this.closed) return;
    const failure = error instanceof TransportError ? error : new TransportError('CHANNEL_ERROR', error instanceof Error ? error.message : String(error));
    this.close(); this.dispatchEvent(new CustomEvent('error', { detail: failure }));
  }
  close() {
    if (this.closed) return;
    this._closed = true; this._ready = false; clearTimeout(this.handshake_timer);
    if (this.assembly) clearTimeout(this.assembly.timer);
    this.assembly = null; this.queue = []; this.queued_bytes = 0;
    this.replica.removeEventListener('update', this.on_update);
    this.replica.removeEventListener('destroy', this.on_destroy);
    for (const [type, listener] of [['open', this.on_open], ['bufferedamountlow', this.on_low], ['message', this.on_message], ['close', this.on_close], ['error', this.on_error]]) this.channel.removeEventListener(type, listener);
    try { this.channel.close(); } finally { this.dispatchEvent(new Event('close')); }
  }
}

// Same-page verification helper: SDP/ICE are exchanged in memory. A production
// host exchanges them through its authenticated signaling service instead.
export async function connect_local_pair(a, b, { ice_servers = [], timeout_ms = 20000 } = {}) {
  if (!a?.handle || !b?.handle || a.snapshot.document_id !== b.snapshot.document_id || a.snapshot.actor_id === b.snapshot.actor_id) throw new TypeError('Distinct live replicas of the same document are required');
  if (!Number.isInteger(timeout_ms) || timeout_ms < 1 || timeout_ms > 2147483647) throw new RangeError('Invalid connection timeout');
  const left = new RTCPeerConnection({ iceServers: ice_servers }), right = new RTCPeerConnection({ iceServers: ice_servers });
  const transports = [], pending_left = [], pending_right = [];
  let closed = false, timer;
  const close = () => { if (closed) return; closed = true; clearTimeout(timer); transports.forEach(transport => transport.close()); left.close(); right.close(); };
  const ice = (target, pending) => event => {
    if (!event.candidate || closed) return;
    if (!target.remoteDescription) pending.push(event.candidate);
    else target.addIceCandidate(event.candidate).catch(error => { if (!closed) reject_ready(error); });
  };
  let resolve_ready, reject_ready;
  const ready = new Promise((resolve, reject) => { resolve_ready = resolve; reject_ready = reject; });
  // Capture early rejection while SDP awaits are still in progress.
  ready.catch(() => {});
  timer = setTimeout(() => reject_ready(new Error('WebRTC connection timeout')), timeout_ms);
  const attach = (replica, channel, expected_actor) => {
    const transport = new WebRTCTransport(replica, channel, { authorize_peer: hello => hello.actor_id === expected_actor });
    transports.push(transport);
    transport.addEventListener('close', () => { reject_ready(new Error('WebRTC channel closed')); close(); });
    transport.addEventListener('error', event => { reject_ready(event.detail); close(); });
    transport.addEventListener('ready', () => { if (transports.length === 2 && transports.every(item => item.ready)) resolve_ready(); });
  };
  left.onicecandidate = ice(right, pending_right); right.onicecandidate = ice(left, pending_left);
  right.ondatachannel = event => attach(b, event.channel, a.snapshot.actor_id);
  attach(a, left.createDataChannel('sohjae-v2', { ordered: true }), b.snapshot.actor_id);
  try {
    await left.setLocalDescription(await left.createOffer());
    await right.setRemoteDescription(left.localDescription);
    for (const candidate of pending_right.splice(0)) await right.addIceCandidate(candidate);
    await right.setLocalDescription(await right.createAnswer());
    await left.setRemoteDescription(right.localDescription);
    for (const candidate of pending_left.splice(0)) await left.addIceCandidate(candidate);
    await ready; clearTimeout(timer);
    return { close, transports, peer_connections: [left, right] };
  } catch (error) { close(); throw error; }
}
