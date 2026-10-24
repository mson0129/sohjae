/** Stable single-user editor API v1. Coordinates are LF-normalized UTF-8 bytes. */
export type EditorMode = 'rich' | 'hybrid' | 'markdown';
export type EditorCommand =
  | 'undo' | 'redo' | 'heading_1' | 'heading_2' | 'heading_3' | 'heading_4' | 'heading_5' | 'heading_6'
  | 'paragraph' | 'bold' | 'italic' | 'strikethrough' | 'highlight' | 'inline_code' | 'code_block'
  | 'quote' | 'list' | 'ordered_list' | 'task' | 'indent' | 'outdent' | 'hard_break'
  | 'link' | 'unlink' | 'open_link' | 'table' | 'table_tools' | 'attachment' | 'footnote'
  | 'alert' | 'details' | 'comment' | 'line_numbers' | 'heading_levels' | 'paragraph_marks'
  | 'copy_markdown' | 'open' | 'save';
export type ElementKind = 'bold' | 'bold_italic' | 'italic' | 'strikethrough' | 'highlight'
  | 'inline_code' | 'code_block' | 'link' | 'image' | 'heading' | 'list' | 'quote' | 'table'
  | 'footnote' | 'rule' | 'html' | 'comment' | 'definition_list' | 'definition_term' | 'definition';
export type AutoClosePair = 'bold' | 'italic' | 'strikethrough' | 'highlight' | 'inline_code' | 'link_brackets' | 'html_comment';
export interface Layout { name?: string; css_url?: string; }
export interface AutoCloseOptions {
  enabled: boolean; pairs: Record<AutoClosePair, boolean>;
  wrap_selection: boolean; skip_closing: boolean; delete_empty_pair: boolean;
}
export interface AttachmentOptions {
  enabled: boolean; storage: 'embedded'; max_file_size: number; max_total_size: number;
}
export interface ImageOptions { enabled: boolean; storage: 'embedded'; }
/** Defaults are filled in by the editor; changes to this snapshot do not update it. */
export interface EditorSettings {
  mode: EditorMode; elements: Partial<Record<ElementKind, { reveal_markdown: boolean }>>;
  read_only: boolean; announce_changes: boolean; show_code_line_numbers: boolean;
  show_heading_levels: boolean; show_paragraph_marks: boolean;
  auto_close: AutoCloseOptions; attachments: AttachmentOptions; images: ImageOptions;
  layout: Layout & { name: string }; layouts: Record<string, Layout>;
  keybindings: Record<string, EditorCommand>; filename?: string;
}
/** Settings accepted by set_options; nested groups are merged. */
export interface EditorOptionsPatch {
  mode?: EditorMode; elements?: EditorSettings['elements']; read_only?: boolean;
  announce_changes?: boolean; show_code_line_numbers?: boolean;
  show_heading_levels?: boolean; show_paragraph_marks?: boolean;
  auto_close?: Partial<Omit<AutoCloseOptions, 'pairs'>> & { pairs?: Partial<Record<AutoClosePair, boolean>> };
  attachments?: Partial<AttachmentOptions>; images?: Partial<ImageOptions>;
  layout?: Layout; layouts?: Record<string, Layout>; keybindings?: Record<string, EditorCommand>;
  filename?: string;
}
export interface EditorOptions extends EditorOptionsPatch {
  markdown?: string; config_url?: string | URL; wasm_url?: string | URL; css_text?: string;
  /** Live Replica created by the optional collaboration SDK. */
  replica?: unknown;
}
export interface EditorSelection { anchor: number; focus: number; revision: bigint; }
export interface EditorChangeDetail {
  revision: bigint; dirty: boolean;
  /** Fields describing shared-document projection and local drafts. */
  origin: 'local' | 'remote'; shared: boolean;
}
export interface EditorEventMap {
  change: CustomEvent<EditorChangeDetail>;
  error: CustomEvent<Error>;
  /** Download was requested; this is not confirmation of server persistence. */
  save: CustomEvent<{ markdown: string }>;
}
export interface Editor extends EventTarget {
  get_markdown(options?: { normalize?: boolean }): string;
  set_markdown(source: string): void;
  get_selection(): EditorSelection;
  set_selection(anchor: number, focus?: number): void;
  replace(text: string, start?: number, end?: number, caret?: number): void;
  execute_command(command: EditorCommand): Promise<void>;
  /** Reports failures through the error event rather than rejecting for command failure. */
  run(command: EditorCommand): Promise<void>;
  set_options(options: EditorOptionsPatch): void;
  get_options(): EditorSettings;
  mark_saved(): void;
  /** Null for single-user editors; local unpublished Markdown for shared editors. */
  get_pending_draft(): string | null;
  /** Returns discarded text, or null when no shared draft exists. */
  discard_pending_draft(): string | null;
  focus(): void;
  /** Idempotent. All other stable methods reject after destruction (run reports error). */
  destroy(): void;
  addEventListener<K extends keyof EditorEventMap>(type: K, listener: (this: Editor, event: EditorEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof EditorEventMap>(type: K, listener: (this: Editor, event: EditorEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
}
export function create_editor(container: Element, options?: EditorOptions): Promise<Editor>;
/** Internal helper; not part of the stable embedding API. */
export function grapheme_range(source: string, offset: number, backwards: boolean): [number, number];
