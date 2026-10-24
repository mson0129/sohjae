import type { Editor, EditorOptions, EditorEventMap } from './editor.js';
import type { Replica, ReplicaOptions } from './collab/core.js';
import type { TransportOptions, WebRTCTransport } from './collab/webrtc.js';
export interface CollaborationSession {
  readonly replica: Replica;
  connect(channel: RTCDataChannel, options: TransportOptions): WebRTCTransport;
}
export interface InitializedEditor extends Editor { readonly collaboration: CollaborationSession | null; }
export type InitOptions = EditorOptions & {
  plugins?: readonly 'collaboration'[];
  collaboration?: Partial<ReplicaOptions>;
} & (
  | { selector: string; target?: never }
  | { target: HTMLElement; selector?: never }
);
export interface SohjaeEventMap extends EditorEventMap { ready: Event; }
export interface SohjaeHandle extends InitializedEditor {
  /** Resolves to this handle after DOM, modules, CSS and WASM are ready. */
  readonly ready: Promise<SohjaeHandle>;
  addEventListener<K extends keyof SohjaeEventMap>(type: K, listener: (this: SohjaeHandle, event: SohjaeEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof SohjaeEventMap>(type: K, listener: (this: SohjaeHandle, event: SohjaeEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
}
export interface SohjaeAPI {
  new(options: string | InitOptions): SohjaeHandle;
  /** Waits for DOM readiness; one selector match; textarea values integrate with forms. */
  init(options: string | InitOptions): Promise<InitializedEditor>;
  /** Original element ID (without #) or element; null while loading or after teardown. */
  get(target: string | HTMLElement): InitializedEditor | null;
}
declare global {
  const Sohjae: SohjaeAPI;
  interface Window { readonly Sohjae: SohjaeAPI; }
}
