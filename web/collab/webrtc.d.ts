import type { Replica, ReplicaSnapshot, Identity } from './core.js';
export type TransportErrorCode = 'CHANNEL_ERROR' | 'RESOURCE_LIMIT' | 'TIMEOUT' | 'INVALID_FRAME'
  | 'UNSUPPORTED_PROTOCOL' | 'IDENTITY_MISMATCH' | 'UNAUTHORIZED' | 'INVALID_OPERATIONS' | 'SYNC_FAILED';
export class TransportError extends Error { readonly code: TransportErrorCode; constructor(code: TransportErrorCode, message: string); }
export interface PeerHello {
  readonly type: 'hello'; readonly protocol: 3; readonly codec: 2; readonly schema: 1;
  readonly document_id: Identity; readonly actor_id: Identity;
}
export interface TransportOptions {
  authorize_peer: (hello: Readonly<PeerHello>) => boolean | Promise<boolean>;
  handshake_timeout_ms?: number;
}
export interface TransportEventMap { ready: Event; sync: CustomEvent<ReplicaSnapshot>; close: Event; error: CustomEvent<TransportError>; }
export class WebRTCTransport extends EventTarget {
  constructor(replica: Replica, channel: RTCDataChannel, options: TransportOptions);
  readonly ready: boolean;
  readonly closed: boolean;
  /** Closes this channel and releases listeners, but never destroys the host-owned replica. */
  close(): void;
  addEventListener<K extends keyof TransportEventMap>(type: K, listener: (this: WebRTCTransport, event: TransportEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof TransportEventMap>(type: K, listener: (this: WebRTCTransport, event: TransportEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
}
/** Same-page verification helper, not a cross-device signaling service. */
export function connect_local_pair(a: Replica, b: Replica, options?: { ice_servers?: RTCIceServer[]; timeout_ms?: number }): Promise<{
  close(): void; transports: WebRTCTransport[]; peer_connections: RTCPeerConnection[];
}>;
