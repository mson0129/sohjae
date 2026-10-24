/** Stable collaboration API v2, ABI v2, transport v3, SCV2 codec v2/schema v1. */
export const COLLABORATION_PROFILE: Readonly<{ api: 2; abi: 2; protocol: 3; codec: 2; schema: 1 }>;
export type CollaborationErrorCode = 'UnsupportedABI' | 'UnsupportedSchema' | 'Destroyed' | 'ReentrantCall'
  | 'InvalidIdentity' | 'WrongDocument' | 'InvalidOperation' | 'IdCollision' | 'MissingReference'
  | 'NonCausalReference' | 'InvalidBoundary' | 'ProjectionDraft' | 'UnknownTable' | 'UnknownRow'
  | 'UnknownColumn' | 'WrongOwner' | 'CounterOverflow' | 'NoHistory' | 'ResourceLimit'
  | 'InvalidEncoding' | 'UnsupportedVersion';
export class CollaborationError extends Error { readonly code: CollaborationErrorCode; constructor(code: CollaborationErrorCode, message: string); }
export type Identity = string;
export type OperationId = string;
export type Bias = 'before' | 'after';
export type Alignment = 'left' | 'center' | 'right';
export type Axis = 'row' | 'column';
export type Scope = Readonly<{ table: OperationId; row: OperationId; column: OperationId }> | null;
export type TableAction = 'row_before' | 'row_after' | 'column_before' | 'column_after' | 'delete_rows'
  | 'delete_columns' | 'clear' | 'align_left' | 'align_center' | 'align_right' | 'delete_table';
export interface SharedCell { readonly row: OperationId; readonly column: OperationId; readonly text: string; }
export interface SharedTable {
  readonly id: OperationId; readonly rows: readonly OperationId[]; readonly columns: readonly OperationId[];
  readonly alignments: readonly Alignment[]; readonly cells: readonly SharedCell[];
}
export interface ProjectedCell { readonly row: OperationId; readonly column: OperationId; readonly start: number; readonly end: number; }
export interface ProjectedTable {
  readonly id: OperationId; readonly start: number; readonly end: number; readonly document_offset: number;
  readonly cells: readonly ProjectedCell[];
}
export interface ReplicaSnapshot {
  readonly document_id: Identity; readonly actor_id: Identity;
  readonly text: string; readonly markdown: string; readonly html: string;
  readonly can_undo: boolean; readonly can_redo: boolean; readonly pending: number; readonly rejected: number;
  readonly operation_count: number; readonly frontier: readonly OperationId[];
  readonly tables: readonly SharedTable[]; readonly projection: readonly ProjectedTable[];
}
export interface ReplicaEventMap {
  change: CustomEvent<Readonly<{ snapshot: ReplicaSnapshot; origin: 'local' | 'remote' }>>;
  /** Copy before modifying or retaining bytes for an asynchronous transport. No merge echo. */
  update: CustomEvent<Uint8Array>;
  destroy: Event;
}
export interface Replica extends EventTarget {
  /** Immutable current snapshot; last snapshot remains readable after destroy. */
  readonly snapshot: ReplicaSnapshot;
  replace_text(start: number, end: number, text: string, scope?: Scope): ReplicaSnapshot;
  capture_range(start: number, end: number, scope?: Scope): Uint8Array;
  replace_capture(capture: Uint8Array, text: string): ReplicaSnapshot;
  anchor_at(offset: number, bias?: Bias, scope?: Scope): Uint8Array;
  resolve_anchor(anchor: Uint8Array): number;
  create_table(offset: number, rows?: number, columns?: number): ReplicaSnapshot;
  insert_row(table: OperationId, after?: OperationId | null): ReplicaSnapshot;
  insert_column(table: OperationId, after?: OperationId | null): ReplicaSnapshot;
  delete_row(table: OperationId, row: OperationId): ReplicaSnapshot;
  delete_column(table: OperationId, column: OperationId): ReplicaSnapshot;
  set_alignment(table: OperationId, column: OperationId, alignment: Alignment): ReplicaSnapshot;
  reorder(table: OperationId, axis: Axis, targets: readonly OperationId[], before?: OperationId | null): ReplicaSnapshot;
  table_action(table: OperationId, action: TableAction, row: number, column: number, range?: readonly [number, number, number, number]): ReplicaSnapshot;
  import_markdown(source: string): ReplicaSnapshot;
  replace_markdown(start: number, end: number, text: string): ReplicaSnapshot;
  replace_projected_text(start: number, end: number, text: string): ReplicaSnapshot;
  projected_anchor(offset: number, bias?: Bias): Uint8Array;
  resolve_projected_anchor(anchor: Uint8Array): number;
  projected_capture(start: number, end: number): Uint8Array;
  merge(bytes: Uint8Array): ReplicaSnapshot;
  export_state(): Uint8Array;
  undo(): ReplicaSnapshot;
  redo(): ReplicaSnapshot;
  coalesce_history(): ReplicaSnapshot;
  clear_local_history(): ReplicaSnapshot;
  destroy(): void;
  addEventListener<K extends keyof ReplicaEventMap>(type: K, listener: (this: Replica, event: ReplicaEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof ReplicaEventMap>(type: K, listener: (this: Replica, event: ReplicaEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
}
export interface ReplicaOptions { document_id: Identity; actor_id?: Identity; wasm_url?: string | URL; }
export function create_replica(options: ReplicaOptions): Promise<Replica>;
export function new_identity(): Identity;
export function byte_length(text: string): number;
export function byte_to_utf16(text: string, offset: number): number;
export function utf16_to_byte(text: string, offset: number): number;
/** Direct WASM construction is internal; prefer create_replica. */
export const CollaborativeReplica: { new(exports: WebAssembly.Exports, document_id: Identity, actor_id: Identity): Replica };
