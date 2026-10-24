import { load_core, byte_length, byte_slice, utf16_to_byte, byte_to_utf16 } from './core.js';
import { html_to_markdown, safe_url, read_file, file_markdown } from './clipboard.js';

const COMMANDS = new Set(['undo', 'redo', ...Array.from({length:6}, (_,i)=>`heading_${i+1}`), 'paragraph', 'bold', 'italic', 'strikethrough', 'highlight', 'inline_code', 'code_block', 'quote', 'list', 'ordered_list', 'task', 'indent', 'outdent', 'hard_break', 'link', 'unlink', 'open_link', 'table', 'table_tools', 'attachment', 'footnote', 'alert', 'details', 'comment', 'line_numbers', 'heading_levels', 'paragraph_marks', 'copy_markdown', 'open', 'save']);
const is_record = value => value !== null && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const initializing = new WeakSet();
const DEFAULTS = {
  mode: 'hybrid', elements: {}, read_only: false, announce_changes: false, show_code_line_numbers: false, show_heading_levels: false, show_paragraph_marks: false,
  auto_close: { enabled: true, pairs: { bold: true, italic: true, strikethrough: true, highlight: true, inline_code: true, link_brackets: true, html_comment: true }, wrap_selection: true, skip_closing: true, delete_empty_pair: true },
  attachments: { enabled: true, storage: 'embedded', max_file_size: 4 * 1024 * 1024, max_total_size: 16 * 1024 * 1024 },
  images: { enabled: true, storage: 'embedded' }, layout: { name: 'default' }, layouts: {}, keybindings: {},
};
// Compare content independently of source coordinates, then patch offsets atomically.
// This preserves text nodes, native selection and unchanged suffix blocks after insertion.
function patch_coordinates(old, incoming) {
  const changes = [], coordinates = ['data-start','data-end','data-task'];
  const compare = (a,b) => {
    if(a.nodeType !== b.nodeType || a.nodeName !== b.nodeName)return false;
    if(a.nodeType !== 1)return a.nodeValue === b.nodeValue;
    const attributes = node => [...node.attributes].filter(attr=>!coordinates.includes(attr.name));
    const attrs=attributes(a),other=attributes(b);
    if(attrs.length!==other.length || attrs.some(attr=>b.getAttribute(attr.name)!==attr.value) || a.childNodes.length!==b.childNodes.length)return false;
    for(const key of coordinates)if(a.getAttribute(key)!==b.getAttribute(key))changes.push([a,key,b.getAttribute(key)]);
    return [...a.childNodes].every((child,index)=>compare(child,b.childNodes[index]));
  };
  if(!compare(old,incoming))return false;
  for(const [node,key,value]of changes)if(value===null)node.removeAttribute(key);else node.setAttribute(key,value);
  return true;
}
function merge(base, value) {
  const result = { ...base };
  for (const [key, item] of Object.entries(value || {})) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    result[key] = is_record(item) ? merge(is_record(base?.[key]) ? base[key] : {}, item) : item instanceof URL ? new URL(item.href) : Array.isArray(item) ? item.slice() : item;
  }
  return result;
}
function validate_options(options) {
  if (options.replica !== undefined && (!options.replica || typeof options.replica !== 'object')) throw new TypeError('A live replica is required');
  if (!['hybrid', 'rich', 'markdown'].includes(options.mode)) throw new TypeError('Unknown editing mode');
  for (const key of ['read_only', 'announce_changes', 'show_code_line_numbers', 'show_heading_levels', 'show_paragraph_marks']) if (typeof options[key] !== 'boolean') throw new TypeError(`${key} must be boolean`);
  for (const key of ['auto_close','elements','attachments','images','layout','layouts','keybindings']) if (!is_record(options[key])) throw new TypeError(`${key} must be an object`);
  if (!is_record(options.auto_close.pairs)) throw new TypeError('auto_close.pairs must be an object');
  for (const key of ['markdown','filename','css_text']) if (options[key] !== undefined && typeof options[key] !== 'string') throw new TypeError(`${key} must be a string`);
  for (const key of ['wasm_url', 'config_url']) if (options[key] !== undefined && typeof options[key] !== 'string' && !(options[key] instanceof URL)) throw new TypeError(`${key} must be a string or URL`);
  for (const config of [options.layout, ...Object.values(options.layouts)]) {
    if (!is_record(config) || (config.css_url !== undefined && typeof config.css_url !== 'string')) throw new TypeError('Layout must be an object with an optional css_url string');
    if (config.css_url) new URL(config.css_url, document.baseURI);
  }
  for (const command of Object.values(options.keybindings)) if (typeof command !== 'string' || !COMMANDS.has(command)) throw new TypeError('Unknown keybinding command');
  for (const [element, config] of Object.entries(options.elements)) if (typeof config?.reveal_markdown !== 'boolean') throw new TypeError(`elements.${element}.reveal_markdown must be boolean`);
  for (const key of ['enabled', 'wrap_selection', 'skip_closing', 'delete_empty_pair']) if (typeof options.auto_close[key] !== 'boolean') throw new TypeError(`auto_close.${key} must be boolean`);
  for (const [key, value] of Object.entries(options.auto_close.pairs)) if (typeof value !== 'boolean') throw new TypeError(`auto_close.pairs.${key} must be boolean`);
  for (const key of ['attachments', 'images']) {
    if (typeof options[key].enabled !== 'boolean' || options[key].storage !== 'embedded') throw new TypeError(`${key} only supports embedded storage`);
  }
  for (const key of ['max_file_size', 'max_total_size']) if (!Number.isSafeInteger(options.attachments[key]) || options.attachments[key] < 1) throw new TypeError(`attachments.${key} must be a positive integer`);
  if (typeof options.layout.name !== 'string') throw new TypeError('layout.name must be a string');
}
const escape_html = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
export function grapheme_range(source, offset, backwards) {
  const utf16 = byte_to_utf16(source, offset);
  const segments = [...segmenter.segment(source)];
  if (backwards) {
    const previous = segments.findLast(segment => segment.index < utf16);
    return [previous ? utf16_to_byte(source, previous.index) : 0, offset];
  }
  const next = segments.find(segment => segment.index + segment.segment.length > utf16);
  return [offset, next ? utf16_to_byte(source, next.index + next.segment.length) : offset];
}

export async function create_editor(container, options = {}) {
  if (!(container instanceof Element)) throw new TypeError('Container must be an Element');
  if (!is_record(options)) throw new TypeError('Options must be an object');
  if (initializing.has(container) || container.shadowRoot?.childNodes.length) throw new Error('Container already has an active or initializing editor');
  options = merge({}, options);
  initializing.add(container);
  let core;
  try {
    validate_options(merge(DEFAULTS, options));
    if (options.config_url) {
      const response = await fetch(options.config_url);
      if (!response.ok) throw new Error('Unable to load editor configuration');
      const config = await response.json();
      if (!is_record(config)) throw new TypeError('Configuration file must contain an object');
      const { replica, ...instance_options } = options;
      // Replica instances cannot be supplied by JSON configuration.
      const { replica: _ignored_replica, ...file_options } = config;
      options = {...merge(file_options, instance_options), ...(replica ? {replica} : {})};
    }
    validate_options(merge(DEFAULTS, options));
    core = options.replica ? await (await import('./collab/editor_core.js')).create_editor_core(options.replica, options) : await load_core(options.wasm_url);
    const css = options.css_text ?? await fetch(new URL('./editor.css', import.meta.url)).then(response => {
      if (!response.ok) throw new Error('Unable to load editor styles'); return response.text();
    });
    return new MarkdownEditor(container, core, css, options);
  } catch (error) { if (core?.snapshot) core.request(1); throw error; }
  finally { initializing.delete(container); }
}

class MarkdownEditor extends EventTarget {
  constructor(container, core, css, options) {
    super();
    this.core = core;
    const {replica: _shared_replica, ...editor_options} = options;
    this.options = merge(DEFAULTS, editor_options);
    validate_options(this.options);
    if (container.shadowRoot?.childNodes.length) throw new Error('Container already has an active shadow root');
    this.root = container.shadowRoot || container.attachShadow({ mode: 'open' });
    this.container = container;
    this.composing = false;
    this.source_view = false;
    this.reading = false;
    this.selection = { anchor: 0, focus: 0 };
    this.pairs = [];
    this.listeners = new AbortController();
    this.root.innerHTML = `<style>${css}</style><link class="layout_link" rel="stylesheet" disabled>
      <div class="markdown_editor"><header><div class="toolbar" role="toolbar" aria-label="문서 편집 도구"></div>
      <div class="view_bar"><label>편집 방식 <select aria-label="편집 방식"><option value="hybrid">하이브리드</option><option value="rich">리치</option><option value="markdown">Markdown</option></select></label>
      <button data-view="source" aria-pressed="false">원본</button><button data-view="reading" aria-pressed="false">읽기</button><span class="state"></span><button data-draft-discard hidden>원본 초안 되돌리기</button></div></header>
      <div class="surface" contenteditable="true" role="textbox" aria-label="Markdown 문서" aria-describedby="editor_help" aria-multiline="true" spellcheck="false"></div>
      <textarea class="source" aria-label="Markdown 원본" aria-describedby="editor_help" spellcheck="false" hidden></textarea>
      <footer><span class="position"></span><span>Esc · 편집 영역 나가기</span></footer>
      <p id="editor_help" class="sr_only">문서에서 Esc를 누르면 편집 영역을 나갑니다. 도구 모음은 방향키와 Home·End로 이동합니다. 모든 명령은 Control 또는 Command와 Shift와 P로 열 수 있습니다. 표 핸들은 Alt와 방향키로 이동합니다.</p>
      <div class="errors sr_only" role="alert" aria-atomic="true"></div>
      <div class="announce" role="status" aria-live="polite"></div>
      <dialog aria-labelledby="command_title"><form method="dialog"><h2 id="command_title"></h2><div class="fields"></div><div class="dialog_actions"><button value="cancel">취소</button><button value="apply">적용</button></div></form></dialog>
      <input class="file_input" type="file" multiple hidden></div>`;
    this.surface = this.root.querySelector('.surface');
    this.source_input = this.root.querySelector('.source');
    this.toolbar = this.root.querySelector('.toolbar');
    this.dialog = this.root.querySelector('dialog');
    const tools = [
      ['undo', '↶', '실행 취소'], ['redo', '↷', '다시 실행'],
      ...Array.from({ length: 6 }, (_, i) => [`heading_${i + 1}`, `H${i + 1}`, `제목 ${i + 1}`]),
      ['paragraph', 'P', '일반 문단'], ['bold', 'B', '굵게'], ['italic', 'I', '기울임'], ['strikethrough', 'S̶', '취소선'], ['highlight', '형광', '하이라이트'],
      ['inline_code', '<>', '인라인 코드'], ['code_block', '{ }', '코드 블록'], ['quote', '❞', '인용문'],
      ['list', '•', '목록'], ['ordered_list', '1.', '순서 목록'], ['task', '☑', '작업 목록'],
      ['indent', '→', '들여쓰기'], ['outdent', '←', '내어쓰기'], ['hard_break', '↵', '줄바꿈'],
      ['link', '↗', '링크 추가·수정'], ['unlink', '⊘', '링크 제거'], ['open_link', '열기', '링크 열기'],
      ['table', '▦', '표 삽입'], ['table_tools', '표 도구', '표 행·열 편집'], ['attachment', '＋파일', '파일·이미지 첨부'],
      ['footnote', '각주', '각주 삽입'], ['alert', '알림', '알림 블록'], ['details', '접기', '접기 영역'],
      ['comment', '<!-- -->', '주석'], ['line_numbers', '줄 번호', '코드 줄 번호 표시'], ['heading_levels', '제목 단계', '제목 단계 표시'], ['paragraph_marks', '문단 표시', '문단 기호 표시'], ['copy_markdown', 'MD 복사', 'Markdown 복사'], ['open', '불러오기', 'Markdown 불러오기'], ['save', '저장', 'Markdown 저장'],
    ];
    tools.forEach(([command, label, title]) => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.command = command;
      button.textContent = label; button.title = title; button.setAttribute('aria-label', title); this.toolbar.append(button);
    });
    this.on(this.toolbar, 'keydown', event => {
      const buttons=[...this.toolbar.querySelectorAll('button:not(:disabled)')];
      const current=buttons.indexOf(this.root.activeElement);
      const target=event.key==='Home'?0:event.key==='End'?buttons.length-1:['ArrowRight','ArrowDown'].includes(event.key)?(current+1)%buttons.length:['ArrowLeft','ArrowUp'].includes(event.key)?(current-1+buttons.length)%buttons.length:null;
      if(target!==null&&buttons.length){event.preventDefault();this.typing_group=null;buttons.forEach((button,index)=>button.tabIndex=index===target?0:-1);buttons[target].focus();}
      if(event.key==='Escape'){event.preventDefault();this.focus();}
    });
    this.on(this.toolbar,'focusin',event=>{if(event.target.matches('button'))this.toolbar.querySelectorAll('button').forEach(button=>button.tabIndex=button===event.target?0:-1);});
    this.on(this.toolbar, 'pointerdown' , event => { if (event.target.closest('button')) event.preventDefault(); });
    this.on(this.toolbar, 'click', event => { const command = event.target.closest('[data-command]')?.dataset.command; if (command) this.run(command); });
    this.on(this.root.querySelector('[data-draft-discard]'), 'click', () => {
      this.discard_pending_draft();
    });
    this.on(this.root.querySelector('select'), 'change', event => this.set_options({ mode: event.target.value }));
    this.root.querySelectorAll('[data-view]').forEach(button => this.on(button, 'click', () => this.set_view(button.dataset.view)));
    for(const input of [this.surface,this.source_input])this.on(input,'blur',()=>{this.typing_group=null;});
    this.on(this.source_input,'pointerdown',()=>{this.typing_group=null;});
    this.on(this.surface, 'focus', () => { this.keep_active_syntax = true; this.refresh_syntax(); });
    this.on(this.surface, 'beforeinput', event => this.input_event(event, () => this.before_input(event)));
    this.on(this.surface, 'compositionstart', () => {
      this.typing_group = null;
      this.capture_selection(); this.composing = true; this.composition_selection = { ...this.selection };
      this.composition_visible = this.surface.textContent;
      this.core.begin_composition?.(Math.min(this.selection.anchor,this.selection.focus),Math.max(this.selection.anchor,this.selection.focus));
    });
    this.on(this.surface, 'compositionend', event => {
      this.composing = false;
      if (this.options.read_only || this.reading) { this.render(); return; }
      let text = event.data ?? '';
      if (!text && this.surface.textContent !== this.composition_visible) {
        const before = this.composition_visible, after = this.surface.textContent;
        let prefix = 0, suffix = 0;
        while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
        while (suffix < before.length - prefix && suffix < after.length - prefix && before.at(-suffix - 1) === after.at(-suffix - 1)) suffix++;
        text = after.slice(prefix, after.length - suffix);
      }
      this.selection = this.composition_selection;
      if (this.core.commit_composition) {
        this.state = this.core.commit_composition(text); this.selection = {anchor:this.state.anchor,focus:this.state.focus}; this.render(); if (text) this.emit_change();
      } else if (text) this.replace(text); else this.render();
      if (this.pending_options) { const pending = this.pending_options; this.pending_options = null; this.set_options(pending); }
      this.composition_commit = text;
      setTimeout(() => { this.composition_commit = null; }, 0);
    });
    this.on(this.surface, 'input', () => { if (!this.composing) this.render(); });
    this.on(this.source_input, 'compositionstart', () => {
      if (!this.core.begin_composition) return;
      this.capture_selection(); this.composing = true;
      this.core.begin_composition(Math.min(this.selection.anchor,this.selection.focus),Math.max(this.selection.anchor,this.selection.focus));
    });
    this.on(this.source_input, 'input', event => { if (!event.isComposing && !this.composing && !(this.composition_commit != null && event.data === this.composition_commit)) this.input_event(event, () => this.source_changed()); });
    this.on(this.source_input, 'compositionend', event => {
      if (!this.core.commit_composition) { this.source_changed(); return; }
      this.composing = false; this.state = this.core.commit_composition(event.data ?? ''); this.selection = {anchor:this.state.anchor,focus:this.state.focus};
      this.composition_commit = event.data; setTimeout(() => { this.composition_commit = null; },0); this.render(); this.emit_change();
    });
    for (const element of [this.surface, this.source_input]) {
      this.on(element, 'keydown', event => this.keydown(event));
      this.on(element, 'paste', event => this.paste(event));
      this.on(element, 'copy', event => this.copy(event));
      this.on(element, 'cut', event => { if (!this.options.read_only && !this.reading) { this.copy(event); this.replace(''); } });
      this.on(element, 'dragover', event => event.preventDefault());
      this.on(element, 'drop', event => { event.preventDefault(); this.capture_selection(); this.add_files([...event.dataTransfer.files]); });
    }
    this.on(document, 'selectionchange', () => {
      if (this.composing || this.rendering || this.dialog.open) return;
      if (!this.has_focus()) return;
      this.capture_selection();
      // Avoid changing DOM during a pointer drag; expose syntax on pointerup instead.
      if (!this.dragging) this.refresh_syntax();
    });
    this.on(this.surface, 'pointerdown', event => {
      this.typing_group = null;
      if (this.options.read_only || this.reading || this.composing || event.button !== 0) return;
      this.projected_selection = null;
      this.dragging = true;
      const cell = event.target.closest('[data-cell]');
      this.drag_cell = cell;
      this.drag_axis = event.target.closest('[data-row-handle]') ? 'row' : event.target.closest('[data-column-handle]') ? 'column' : null;
      if (this.drag_axis && cell) {
        event.preventDefault(); this.set_selection(Number(cell.dataset.start));
        const axis=this.drag_axis,from=axis==='row'?+cell.dataset.row:+cell.dataset.column;
        const selected=this.cell_selection;
        const range=selected&&selected.first.closest('table')===cell.closest('table') ? (axis==='row'?[+selected.first.dataset.row,+selected.last.dataset.row]:[+selected.first.dataset.column,+selected.last.dataset.column]).sort((a,b)=>a-b):null;
        this.handle_drag={axis,from:range&&from>=range[0]&&from<=range[1]?range[0]:from,to:range&&from>=range[0]&&from<=range[1]?range[1]:from,x:event.clientX,y:event.clientY,select:event.shiftKey,moved:false};
        if(!range||from<range[0]||from>range[1]||event.shiftKey)this.select_cell_rectangle(cell,cell);
      }
      if (event.shiftKey && cell) { event.preventDefault(); this.cell_selection = { first: cell, last: cell }; this.paint_cells(); }
    });
    this.on(this.surface, 'pointermove', event => {
      if (!this.dragging || !this.drag_cell) return;
      const cell = (this.handle_drag&&!this.handle_drag.select&&this.root.elementFromPoint ? this.root.elementFromPoint(event.clientX,event.clientY) : event.target)?.closest('[data-cell]');
      if(this.handle_drag&&!this.handle_drag.select){
        const drag=this.handle_drag;
        if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<6)return;
        drag.moved=true;this.clear_table_drop();drag.slot=null;
        if(cell&&cell.closest('table')===this.drag_cell.closest('table')){
          const rect=cell.getBoundingClientRect(),after=drag.axis==='row'?event.clientY>rect.top+rect.height/2:event.clientX>rect.left+rect.width/2;
          drag.slot=(drag.axis==='row'?+cell.dataset.row:+cell.dataset.column)+(after?1:0);
          cell.dataset.drop=drag.axis+(after?'-after':'-before');
        }
        return;
      }
      if (cell && cell !== this.drag_cell && cell.closest('table') === this.drag_cell.closest('table')) {
        this.select_cell_rectangle(this.drag_cell, cell);
      }
    });
    this.on(document, 'pointerup', event => {
      if(!this.dragging)return;
      const drag=this.handle_drag,cell=this.drag_cell;
      const hit=this.root.elementFromPoint?.(event.clientX,event.clientY);
      const target=this.root.elementFromPoint?hit?.closest('[data-cell]'):event.composedPath().find(node=>node?.matches?.('[data-cell]'));
      this.cancel_table_drag();
      if(drag&&!drag.select&&drag.moved&&drag.slot!==null&&target?.closest('table')===cell?.closest('table')){
        try{this.move_table_axis(cell,drag.axis,drag.from,drag.to,drag.slot);}catch(error){this.report(error);}return;
      }
      this.capture_selection();this.refresh_syntax();
    });
    this.on(document,'pointercancel',()=>this.cancel_table_drag());
    this.on(this.surface,'keydown',event=>{if(event.key==='Escape'&&this.dragging){event.preventDefault();this.cancel_table_drag();}});
    this.on(this.surface, 'contextmenu', event => { const cell = event.target.closest('[data-cell]'); if (cell) { event.preventDefault(); this.set_selection(Number(cell.dataset.start)); this.table_dialog(); } });
    this.on(this.surface, 'click', event => {
      if (event.target.closest('.table_handle')) { event.preventDefault(); return; }
      const anchor = event.target.closest('a');
      if (anchor) { event.preventDefault(); if (this.reading) this.open_anchor(anchor); }
      const task = event.target.closest('[data-task]');
      if (task && !this.options.read_only && !this.reading) {
        const start = Number(task.dataset.task);
        const line_end = this.state.source.indexOf('\n', byte_to_utf16(this.state.source, start));
        const line = byte_slice(this.state.source, start, line_end < 0 ? undefined : utf16_to_byte(this.state.source, line_end));
        const index = line.search(/\[[ xX]\]/u);
        if (index >= 0) this.replace(task.checked ? '[x]' : '[ ]', start + byte_length(line.slice(0, index)), start + byte_length(line.slice(0, index + 3)));
      }
    });
    this.on(this.root.querySelector('.file_input'), 'change', event => { this.add_files([...event.target.files]); event.target.value = ''; });
    this.on(this.dialog, 'close', () => {
      const callback = this.dialog_callback; this.dialog_callback = null;
      this.selection = this.dialog_selection || this.selection;
      if (this.dialog.returnValue === 'apply' && callback) callback(new FormData(this.dialog.querySelector('form')));
      this.focus(); this.surface.scrollTop = this.dialog_scroll ?? this.surface.scrollTop; this.dialog_range = null;
    });
    if (window.visualViewport) this.on(window.visualViewport, 'resize', () => this.ensure_caret_visible());
    this.state = this.core.request(0, options.markdown || '');
    this.selection = { anchor: this.state.anchor, focus: this.state.focus };
    this.render();
    if (this.core.replica) this.on(this.core, 'remotechange', () => {
      if (this.composing) return;
      this.cancel_table_drag();
      const previous = this.state.source;
      this.state = this.core.snapshot; this.selection = { anchor:this.state.anchor, focus:this.state.focus };
      this.map_dialog_from_sources(previous,this.state.source); this.pairs = []; this.auto_transform = null; this.cell_selection = null;
      this.render(); this.emit_change('remote');
    });
  }
  on(target, name, listener) { target.addEventListener(name, listener, { signal: this.listeners.signal }); }
  has_focus() { return this.root.activeElement === this.surface || this.root.activeElement === this.source_input; }
  assert_active() { if (!this.core) throw new Error('Editor has been destroyed'); }
  get_markdown(options = {}) {
    this.assert_active();
    if (!is_record(options) || (options.normalize !== undefined && typeof options.normalize !== 'boolean')) throw new TypeError('normalize must be boolean');
    return (options.normalize ?? true) ? this.core.request(8) : this.state.source;
  }
  get_selection() { this.assert_active(); return { ...this.selection, revision: this.state.revision }; }
  get_pending_draft() { this.assert_active(); return this.core.draft?.source ?? null; }
  discard_pending_draft() {
    this.assert_active();
    const source=this.core.discard_draft?.(); if(source===undefined)return null;
    this.last_source_draft=source;this.state=this.core.snapshot;this.selection={anchor:this.state.anchor,focus:this.state.focus};this.render();return source;
  }
  mark_saved() { this.assert_active(); this.state = this.core.request(9); this.render(); }
  get_options() { this.assert_active(); return merge({}, this.options); }
  set_markdown(source) {
    this.assert_active();
    if (typeof source !== 'string') throw new TypeError('Markdown must be a string');
    this.typing_group = null;
    if (this.composing) throw new Error('Finish composition before replacing the document');
    if (this.dialog.open) { this.dialog_callback = null; this.dialog_selection = { anchor: 0, focus: 0 }; this.dialog.close('cancel'); }
    this.state = this.core.request(2, source); this.auto_transform = null; this.pairs = []; this.selection = { anchor: 0, focus: 0 }; this.render();
  }
  set_options(options) {
    this.assert_active();
    this.typing_group = null;
    if (!is_record(options)) throw new TypeError('Options must be an object');
    if (['replica','markdown','config_url','wasm_url','css_text'].some(key => key in options)) throw new TypeError('Creation options require a new editor');
    const next = merge(merge(this.options, this.pending_options), options);
    validate_options(next);
    if (this.composing) { this.pending_options = merge(this.pending_options || {}, options); return; }
    this.options = next; this.render();
  }
  destroy() { if (!this.core) return; this.listeners.abort(); this.core.request(1); this.core = null; this.state = null; this.pairs = []; this.root.replaceChildren(); }
  focus() { this.assert_active(); (this.source_view ? this.source_input : this.surface).focus(); this.core.request(4, '', this.selection.anchor, this.selection.focus); this.restore_selection(); }
  set_selection(anchor, focus = anchor, finalize = false) {
    this.assert_active();
    this.typing_group = null;
    this.state = this.core.request(finalize ? 11 : 4, '', anchor, focus); this.selection = { anchor, focus }; this.restore_selection(); this.sync_accessibility();
  }
  set_view(view) {
    this.typing_group = null;
    if (this.composing) return;
    this.capture_selection();
    if (view === 'source') { this.source_view = !this.source_view; this.reading = false; }
    else { this.reading = !this.reading; this.source_view = false; }
    if(this.core.replica)this.core.source_mode=this.source_view;
    this.render(); this.focus();
  }
  replace(text, start, end, caret) {
    this.assert_active();
    if (typeof text !== 'string') throw new TypeError('Replacement must be a string');
    text = text.replace(/\r\n?/gu, '\n');
    if (this.options.read_only || this.reading || this.composing) return;
    const before = this.state;
    start ??= Math.min(this.selection.anchor, this.selection.focus);
    end ??= Math.max(this.selection.anchor, this.selection.focus);
    const size = byte_length(text);
    if (caret !== undefined && !this.core.replica) {
      const result = byte_slice(before.source, 0, start) + text + byte_slice(before.source, end);
      if (!Number.isInteger(caret) || caret < 0 || caret > byte_length(result)) throw new RangeError('Invalid UTF-8 caret');
      byte_to_utf16(result, caret); // Validate before editing so an invalid caret cannot partially apply.
    }
    const kind = this.typing_input;
    const eligible = !this.state.draft && (kind === 'insertText' && start === end && !!text && !/[\r\n*_~`\[\]#>\\=]/u.test(text)
      || ['deleteContentBackward','deleteContentForward'].includes(kind) && !text && this.selection.anchor === this.selection.focus && !byte_slice(before.source,start,end).includes('\n'));
    const now = performance.now(), context = `${this.source_view}:${this.active_kind()}`;
    const previous = this.typing_group;
    const join = eligible && previous && previous.kind === kind && previous.revision === before.revision && previous.focus === this.selection.focus && previous.context === context && now - previous.time <= 750;
    this.state = this.core.request(3, text, start, end);
    if (join && before.revision !== this.state.revision) this.state = this.core.request(12);
    this.typing_group = eligible && !this.state.draft && before.revision !== this.state.revision ? { kind, context, time:now, revision:this.state.revision, focus:this.state.focus } : null;
    const linear=byte_slice(before.source,0,start)+text+byte_slice(before.source,end)===this.state.source;
    if(this.core.replica)this.map_dialog_from_sources(before.source,this.state.source);else this.map_dialog_positions(start,end,size);
    this.pairs = this.pairs.filter(pair => !(start < pair.start + byte_length(pair.close) && end > pair.start)).map(pair => pair.start >= end ? { ...pair, start: pair.start + size - (end - start) } : pair);
    if(!linear)this.pairs=[];
    this.selection = { anchor: this.state.anchor, focus: this.state.focus };
    if (caret !== undefined && (!this.core.replica || linear)) { this.state = this.core.request(11, '', caret, caret); this.selection = { anchor: caret, focus: caret }; }
    this.render();
    if (this.pending_options) { const pending = this.pending_options; this.pending_options = null; this.set_options(pending); }
    if (before.revision !== this.state.revision) this.emit_change();
  }
  emit_change(origin = 'local') {
    this.dispatchEvent(new CustomEvent('change', { detail: { revision: this.state.revision, dirty: this.state.dirty, origin, shared: !this.state.draft } }));
    const announce = this.root.querySelector('.announce');
    if (this.options.announce_changes && announce) announce.textContent = '문서가 변경되었습니다.';
  }
  render() {
    if (this.composing) return;
    this.rendering = true;
    const focused = this.has_focus();
    const scroll = this.surface.scrollTop;
    const template = document.createElement('template'); template.innerHTML = this.state.html;
    if (this.reading) template.content.querySelectorAll('.comment,.front_matter,.reference_definition,[data-kind="comment"]').forEach(element => element.remove());
    template.content.querySelectorAll('[data-task]').forEach(input => { input.disabled = this.reading || this.options.read_only; });
    const incoming = [...template.content.children];
    const old_nodes = [...this.surface.children];
    let prefix=0,suffix=0;
    while(prefix<Math.min(old_nodes.length,incoming.length)&&patch_coordinates(old_nodes[prefix],incoming[prefix]))prefix++;
    while(suffix<Math.min(old_nodes.length,incoming.length)-prefix&&patch_coordinates(old_nodes.at(-suffix-1),incoming.at(-suffix-1)))suffix++;
    const retained = suffix ? old_nodes[old_nodes.length-suffix] : null;
    const old_middle = old_nodes.slice(prefix,old_nodes.length-suffix);
    const new_middle = incoming.slice(prefix,incoming.length-suffix);
    new_middle.forEach((node,index)=>{
      const old=old_middle[index];
      if(old){if(!patch_coordinates(old,node))old.replaceWith(node);}
      else this.surface.insertBefore(node,retained);
    });
    old_middle.slice(new_middle.length).forEach(node=>node.remove());
    this.source_input.value = this.state.source;
    this.source_input.hidden = !this.source_view;
    this.surface.hidden = this.source_view;
    this.surface.contentEditable = String(!this.options.read_only && !this.reading);
    this.source_input.readOnly = this.options.read_only;
    this.root.querySelector('select').value = this.options.mode;
    this.root.querySelector('[data-view="source"]').setAttribute('aria-pressed', String(this.source_view));
    this.root.querySelector('[data-view="reading"]').setAttribute('aria-pressed', String(this.reading));
    this.root.querySelector('.state').textContent = this.options.read_only ? '읽기 전용' : this.state.draft_conflict ? '원격 변경 도착 · 공유되지 않은 원본 초안' : this.state.draft ? '표 문법 편집 중 · 아직 공유되지 않음' : this.state.dirty ? '수정됨' : '저장됨';
    this.root.querySelector('[data-draft-discard]').hidden = !this.state.draft;
    this.toolbar.querySelectorAll('button').forEach(button => {
      const command = button.dataset.command;
      button.disabled = ((this.options.read_only || this.reading) && !['copy_markdown', 'save', 'open_link', 'open'].includes(command)) || command === 'undo' && !this.state.can_undo || command === 'redo' && !this.state.can_redo;
    });
    this.add_table_handles();
    this.sync_accessibility();
    this.refresh_syntax(false);
    this.apply_layout();
    const shell = this.root.querySelector('.markdown_editor');
    for (const key of ['show_code_line_numbers', 'show_heading_levels', 'show_paragraph_marks']) shell.classList.toggle(key, this.options[key]);
    this.surface.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(heading => { heading.dataset.level = heading.tagName; });
    if (focused) this.restore_selection();
    this.surface.scrollTop = scroll;
    this.root.querySelector('.position').textContent = `${byte_length(this.state.source)} bytes · ${this.state.source.split('\n').length}줄`;
    this.rendering = false;
    requestAnimationFrame(() => this.ensure_caret_visible());
  }
  apply_layout() {
    const name = this.state.layout && this.options.layouts[this.state.layout] ? this.state.layout : this.options.layout.name;
    const config = this.options.layouts[name] || this.options.layout;
    const link = this.root.querySelector('.layout_link');
    if (config?.css_url) { link.href = new URL(config.css_url, document.baseURI); link.disabled = false; } else link.disabled = true;
    this.root.querySelector('.markdown_editor').dataset.layout = name || 'default';
  }
  should_reveal(kind) {
    if (this.options.elements[kind]?.reveal_markdown !== undefined) return this.options.elements[kind].reveal_markdown;
    return this.options.mode === 'markdown' || this.options.mode === 'hybrid' && ['bold', 'italic', 'strikethrough', 'highlight', 'inline_code', 'link', 'heading', 'list', 'quote'].includes(kind);
  }
  refresh_syntax(restore = true) {
    if (this.composing || this.dragging || this.source_view || this.reading || (!this.keep_active_syntax && !this.has_focus())) return;
    const focus = this.selection.focus;
    const reveal = [...this.surface.querySelectorAll('[data-kind]')].filter(element => this.should_reveal(element.dataset.kind) && focus >= Number(element.dataset.start) && focus <= Number(element.dataset.end));
    // Restore only if the active syntax region changed; never rebuild on caret movement inside it.
    const desired = reveal.find(element => !reveal.some(other => other !== element && other.contains(element)));
    const current = this.surface.querySelector('[data-revealed]');
    if (current && (!desired || current !== desired)) { this.render(); return; }
    if (!desired || desired.dataset.revealed) return;
    const start = Number(desired.dataset.start), end = Number(desired.dataset.end);
    const span = document.createElement('span'); span.dataset.text = '1'; span.dataset.start = start; span.dataset.end = end;
    span.textContent = byte_slice(this.state.source, start, end);
    desired.replaceChildren(span); desired.dataset.revealed = '1'; desired.classList.add('syntax');
    if (restore && this.has_focus()) this.restore_selection();
  }
  dom_selection() { return this.root.getSelection?.() || document.getSelection(); }
  capture_selection() {
    if (this.source_view) {
      const input = this.source_input;
      const start = utf16_to_byte(input.value, input.selectionStart), end = utf16_to_byte(input.value, input.selectionEnd);
      this.selection = input.selectionDirection === 'backward' ? { anchor: end, focus: start } : { anchor: start, focus: end };
    } else {
      const selection = this.dom_selection();
      if (!selection?.anchorNode || !this.surface.contains(selection.anchorNode) || !this.surface.contains(selection.focusNode)) return;
      const projected = this.projected_selection;
      if (projected && selection.anchorNode === projected.anchorNode && selection.anchorOffset === projected.anchorOffset && selection.focusNode === projected.focusNode && selection.focusOffset === projected.focusOffset) return;
      this.projected_selection = null;
      this.selection = { anchor: this.dom_to_source(selection.anchorNode, selection.anchorOffset), focus: this.dom_to_source(selection.focusNode, selection.focusOffset) };
    }
    this.core.request(4, '', this.selection.anchor, this.selection.focus);
  }
  dom_to_source(node, offset) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    const text = element.closest('[data-text]');
    if (text) {
      const range = document.createRange(); range.setStart(text, 0); range.setEnd(node, offset);
      const displayed = text.textContent, before = range.toString();
      const start = Number(text.dataset.start), end = Number(text.dataset.end), raw = byte_slice(this.state.source, start, end);
      if (raw === displayed) return start + byte_length(before);
      if (raw.startsWith('\\') && raw.slice(1) === displayed) return start + 1 + byte_length(before);
      return before.length ? end : start;
    }
    if (node.nodeType === 1) {
      const after = node.childNodes[offset];
      const target = after?.nodeType === 1 ? (after.matches('[data-text]') ? after : after.querySelector('[data-text]')) : null;
      if (target) return Number(target.dataset.start);
      const previous = node.childNodes[offset - 1];
      if (previous?.nodeType === 1 && previous.matches('[data-break]')) return Number(previous.dataset.end);
      if (after?.nodeType === 1 && after.matches('[data-break]')) return Number(after.dataset.start);
      const spans = previous?.nodeType === 1 ? [...previous.querySelectorAll('[data-text]')] : [];
      if (previous?.nodeType === 1 && previous.matches('[data-text]')) spans.push(previous);
      if (spans.length) return Number(spans.at(-1).dataset.end);
    }
    const owner = element.closest('[data-cell],[data-block]');
    return Number(owner?.dataset.start || 0);
  }
  source_to_dom(position) {
    const spans = [...this.surface.querySelectorAll('[data-text]')];
    let nearest;
    for (const span of spans) {
      const start = Number(span.dataset.start), end = Number(span.dataset.end);
      if (start <= position && position <= end) {
        const raw = byte_slice(this.state.source, start, end), displayed = span.textContent;
        let offset = position === end ? displayed.length : 0;
        if (raw === displayed) offset = byte_to_utf16(raw, position - start);
        else if (raw.startsWith('\\') && raw.slice(1) === displayed) offset = byte_to_utf16(raw, Math.max(1, position - start)) - 1;
        if (!span.firstChild) span.append(document.createTextNode(''));
        return [span.firstChild, Math.max(0, offset)];
      }
      const distance = Math.min(Math.abs(position - start), Math.abs(position - end));
      if (!nearest || distance < nearest.distance) nearest = { span, distance, end: position > end };
    }
    const cell = [...this.surface.querySelectorAll('[data-cell]')].find(cell => Number(cell.dataset.start) === position && Number(cell.dataset.end) === position);
    if (cell) return [cell, 0];
    const empty = [...this.surface.children].find(block => Number(block.dataset.start) === position && Number(block.dataset.end) === position);
    if (empty) return [empty.firstChild || empty, 0];
    if (nearest) {
      if (!nearest.span.firstChild) nearest.span.append(document.createTextNode(''));
      return [nearest.span.firstChild, nearest.end ? nearest.span.textContent.length : 0];
    }
    return [this.surface, 0];
  }
  restore_selection() {
    const { anchor, focus } = this.selection;
    if (this.source_view) {
      this.source_input.setSelectionRange(byte_to_utf16(this.state.source, Math.min(anchor, focus)), byte_to_utf16(this.state.source, Math.max(anchor, focus)), anchor > focus ? 'backward' : 'forward'); return;
    }
    const [a_node, a_offset] = this.source_to_dom(anchor), [f_node, f_offset] = this.source_to_dom(focus);
    this.projected_selection = { anchorNode: a_node, anchorOffset: a_offset, focusNode: f_node, focusOffset: f_offset };
    this.dom_selection()?.setBaseAndExtent(a_node, a_offset, f_node, f_offset);
  }
  sync_accessibility() {
    this.surface.setAttribute('role',this.reading?'document':'textbox');
    if(this.reading){this.surface.removeAttribute('aria-readonly');this.surface.removeAttribute('aria-multiline');}
    else {this.surface.setAttribute('aria-readonly',String(this.options.read_only));this.surface.setAttribute('aria-multiline','true');}
    this.surface.tabIndex=0;
    this.source_input.setAttribute('aria-readonly',String(this.options.read_only));
    const buttons=[...this.toolbar.querySelectorAll('button')];
    const active=buttons.find(button=>!button.disabled&&button.tabIndex===0)||buttons.find(button=>!button.disabled);
    buttons.forEach(button=>button.tabIndex=button===active?0:-1);
    const kinds=new Set([...this.surface.querySelectorAll('[data-kind]')].filter(element=>+element.dataset.start<=this.selection.focus&&+element.dataset.end>=this.selection.focus).map(element=>element.dataset.kind));
    const formats={bold:'bold',italic:'italic',strikethrough:'strikethrough',highlight:'highlight',inline_code:'inline_code'};
    const display={line_numbers:'show_code_line_numbers',heading_levels:'show_heading_levels',paragraph_marks:'show_paragraph_marks'};
    for(const button of buttons){const command=button.dataset.command;if(formats[command]||display[command])button.setAttribute('aria-pressed',String(display[command]?this.options[display[command]]:kinds.has(formats[command])));}
  }
  input_event(event, run) {
    this.typing_input = event.inputType;
    try { return run(); } finally { this.typing_input = null; }
  }
  before_input(event) {
    if (this.options.read_only || this.reading) { event.preventDefault(); return; }
    if (event.isComposing || this.composing || event.inputType === 'insertCompositionText') return;
    if (this.composition_commit != null && event.data === this.composition_commit) { event.preventDefault(); return; }
    event.preventDefault(); this.capture_selection();
    if (event.inputType === 'historyUndo') return this.run('undo');
    if (event.inputType === 'historyRedo') return this.run('redo');
    if (event.inputType.startsWith('delete')) {
      if (this.selection.anchor !== this.selection.focus) return this.replace('');
      const backwards = !event.inputType.includes('Forward');
      const pair = this.pairs.find(pair => pair.start === this.selection.focus);
      if (backwards && pair && this.options.auto_close.delete_empty_pair && byte_slice(this.state.source, pair.start - byte_length(pair.open), pair.start) === pair.open) {
        return this.replace('', pair.start - byte_length(pair.open), pair.start + byte_length(pair.close));
      }
      const [start, end] = grapheme_range(this.state.source, this.selection.focus, backwards);
      return this.replace('', start, end);
    }
    if (event.inputType === 'insertParagraph') return this.enter();
    if (event.inputType === 'insertLineBreak') return this.run('hard_break');
    if (event.inputType === 'insertText' || event.inputType === 'insertReplacementText') return this.type_text(event.data || '');
    if (event.inputType.startsWith('format')) {
      const map = { formatBold: 'bold', formatItalic: 'italic', formatStrikeThrough: 'strikethrough' }; if (map[event.inputType]) this.run(map[event.inputType]);
    }
  }
  source_changed() {
    const input = this.source_input, value = input.value;
    const start_selection = input.selectionStart, end_selection = input.selectionEnd, direction = input.selectionDirection;
    let start = 0;
    while (start < value.length && start < this.state.source.length && value[start] === this.state.source[start]) start++;
    if (start > 0 && /[\uD800-\uDBFF]/u.test(value[start - 1])) start--;
    let old_end = this.state.source.length, new_end = value.length;
    while (old_end > start && new_end > start && this.state.source[old_end - 1] === value[new_end - 1]) { old_end--; new_end--; }
    if (old_end < this.state.source.length && /[\uDC00-\uDFFF]/u.test(this.state.source[old_end])) { old_end++; new_end++; }
    if (value !== this.state.source) this.replace(value.slice(start, new_end), utf16_to_byte(this.state.source, start), utf16_to_byte(this.state.source, old_end));
    if (this.core.replica && value !== this.state.source) { this.set_selection(this.state.anchor,this.state.focus); return; }
    const a = utf16_to_byte(value, start_selection), f = utf16_to_byte(value, end_selection);
    const group=this.typing_group;
    this.set_selection(direction === 'backward' ? f : a, direction === 'backward' ? a : f);
    this.typing_group=group;
  }
  type_text(text) {
    const start = Math.min(this.selection.anchor, this.selection.focus), end = Math.max(this.selection.anchor, this.selection.focus);
    const auto = this.options.auto_close;
    const context = this.active_kind();
    const tracked = this.pairs.find(pair => pair.start === start && pair.close.startsWith(text));
    if (auto.enabled && tracked && start === end && ['*', '_'].includes(text) && tracked.open === text && auto.pairs.bold) {
      this.pairs = this.pairs.filter(pair => pair !== tracked);
      this.replace(text.repeat(3), start, start + 1, start + 1);
      this.pairs.push({ start: start + 1, open: text.repeat(2), close: text.repeat(2) }); return;
    }
    if (auto.enabled && tracked && start === end && auto.skip_closing) {
      tracked.start += byte_length(text); tracked.close = tracked.close.slice(text.length);
      this.pairs = this.pairs.filter(pair => pair.close); this.set_selection(start + byte_length(text)); return;
    }
    if (auto.enabled && !['code_block', 'inline_code', 'comment', 'front_matter'].includes(context)) {
      const before = byte_slice(this.state.source, 0, start);
      const candidates = [['<!--', '-->', 'html_comment'], ['**', '**', 'bold'], ['~~', '~~', 'strikethrough'], ['==', '==', 'highlight'], ['`', '`', 'inline_code'], ['[', ']', 'link_brackets'], ['*', '*', 'italic'], ['_', '_', 'italic']];
      if (auto.wrap_selection && start !== end && ['*', '_', '~', '`', '['].includes(text)) {
        const closer = text === '[' ? ']' : text;
        this.replace(text + byte_slice(this.state.source, start, end) + closer, start, end, end + byte_length(text)); return;
      }
      for (const [open, close, key] of candidates) {
        if (auto.pairs[key] && (before + text).endsWith(open)) {
          const previous = this.state;
          this.replace(text + close, start, end, start + byte_length(text));
          this.detect_autoformat(previous);
          this.pairs.push({ start: start + byte_length(text), open, close }); return;
        }
      }
    }
    const previous = this.state;
    this.replace(text);
    this.detect_autoformat(previous);
  }
  detect_autoformat(previous) {
    const focus = this.selection.focus;
    const element = [...this.surface.querySelectorAll('[data-kind]')].find(element => ['bold', 'italic', 'strikethrough', 'highlight', 'heading', 'list', 'quote'].includes(element.dataset.kind) && Number(element.dataset.start) <= focus && Number(element.dataset.end) >= focus);
    if (!element) { this.auto_transform = null; return; }
    const start = Number(element.dataset.start), end = Number(element.dataset.end);
    if (!previous.html.includes(`data-kind="${element.dataset.kind}" data-start="${start}"`)) this.auto_transform = { revision: this.state.revision, start, end };
  }
  active_kind() {
    const position = this.selection.focus;
    return [...this.surface.querySelectorAll('[data-kind]')].filter(element => Number(element.dataset.start) <= position && Number(element.dataset.end) >= position).at(-1)?.dataset.kind;
  }
  line_range() {
    const source = this.state.source, focus = byte_to_utf16(source, this.selection.focus);
    const start = source.lastIndexOf('\n', focus - 1) + 1, next = source.indexOf('\n', focus);
    const end = next < 0 ? source.length : next;
    return { start: utf16_to_byte(source, start), end: utf16_to_byte(source, end), text: source.slice(start, end) };
  }
  enter() {
    if (this.active_cell()) return this.run('hard_break');
    const line = this.line_range();
    if (this.active_kind() === 'code_block' || this.active_kind() === 'front_matter') return this.replace('\n');
    const list = line.text.match(/^(\s*)([-+*]|\d+[.)]) (\[[ xX]\] )?/u);
    if (list) {
      if (line.text.slice(list[0].length).trim() === '') return this.replace('', line.start, line.end);
      const marker = /^\d/u.test(list[2]) ? `${parseInt(list[2]) + 1}.` : '-';
      return this.replace(`\n${list[1]}${marker} ${list[3] ? '[ ] ' : ''}`);
    }
    if (line.text.startsWith('> ')) return this.replace('\n> ');
    this.replace('\n\n');
  }
  keydown(event) {
    if (/^(Arrow|Home|End|Page|Escape)/u.test(event.key)) this.typing_group=null;
    if (event.isComposing || this.composing) return;
    this.capture_selection();
    const modifier = event.ctrlKey || event.metaKey;
    const key = `${modifier ? 'mod+' : ''}${event.shiftKey ? 'shift+' : ''}${event.altKey ? 'alt+' : ''}${event.key.toLowerCase()}`;
    const bindings = { 'mod+b': 'bold', 'mod+i': 'italic', 'mod+k': 'link', 'mod+z': 'undo', 'mod+shift+z': 'redo', 'mod+y': 'redo',
      'mod+shift+c': 'copy_markdown', 'mod+s': 'save', 'mod+shift+u': 'unlink', 'mod+shift+x': 'strikethrough',
      ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`mod+alt+${i + 1}`, `heading_${i + 1}`])),
      ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`mod+${i + 1}`, `heading_${i + 1}`])), ...this.options.keybindings };
    if (bindings[key]) { event.preventDefault(); this.run(bindings[key]); return; }
    // Command palette makes every toolbar command keyboard reachable without reserved shortcuts.
    if (modifier && event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); this.command_palette(); return; }
    if (event.key === 'Escape') { event.preventDefault(); this.cell_selection = null; this.paint_cells(); this.root.querySelector('select').focus(); return; }
    if (event.key === 'Tab' && !this.source_view) {
      if (this.active_cell()) { event.preventDefault(); this.move_cell(event.shiftKey ? -1 : 1); }
      else if (/^\s*(?:[-+*]|\d+[.)]) /u.test(this.line_range().text)) { event.preventDefault(); this.run(event.shiftKey ? 'outdent' : 'indent'); }
    }
    if (!this.source_view && !event.shiftKey && !modifier && event.key.startsWith('Arrow')) this.cell_arrow(event);
  }
  async run(command) {
    try { await this.execute_command(command); } catch (error) { this.report(error); }
  }
  async execute_command(command) {
    this.assert_active();
    if (typeof command !== 'string' || !COMMANDS.has(command)) throw new TypeError('Unknown editor command');
    this.typing_group = null;
    this.root.querySelector('.errors').textContent = '';
    if (this.composing) return;
    const read_command = ['save', 'open', 'open_link', 'copy_markdown'].includes(command);
    if ((this.options.read_only || this.reading) && !read_command) return;
    const display_options = { line_numbers: 'show_code_line_numbers', heading_levels: 'show_heading_levels', paragraph_marks: 'show_paragraph_marks' };
    if (display_options[command]) { this.set_options({ [display_options[command]]: !this.options[display_options[command]] }); return; }
    if (command === 'undo' || command === 'redo') {
      if (!this.state[command === 'undo' ? 'can_undo' : 'can_redo']) return;
      const previous_source = this.state.source;
      if (command === 'undo' && this.auto_transform?.revision === this.state.revision) {
        const { start, end } = this.auto_transform;
        const literal = byte_slice(this.state.source, start, end).replace(/([\\`*_~=#>\[\]!.+-])/gu, '\\$1');
        this.state = this.core.request(10, literal, start, end);
      } else this.state = this.core.request(command === 'undo' ? 5 : 6);
      this.map_dialog_from_sources(previous_source, this.state.source);
      this.auto_transform = null; this.selection = { anchor: this.state.anchor, focus: this.state.focus }; this.pairs = []; this.render(); this.focus(); this.emit_change(); return;
    }
    const wrappers = { bold: ['**', '**'], italic: ['*', '*'], strikethrough: ['~~', '~~'], highlight: ['==', '=='], inline_code: ['`', '`'], comment: ['<!--', '-->'], details: ['<details>\n<summary>제목</summary>\n\n', '\n</details>'], code_block: ['```\n', '\n```'] };
    if (wrappers[command]) {
      const [open, close] = wrappers[command], start = Math.min(this.selection.anchor, this.selection.focus), end = Math.max(this.selection.anchor, this.selection.focus);
      const selected = byte_slice(this.state.source, start, end);
      if (start === end) {
        const active = [...this.surface.querySelectorAll('[data-kind]')].find(element => element.dataset.kind === command && Number(element.dataset.start) <= start && Number(element.dataset.end) >= end);
        if (active) {
          const from = Number(active.dataset.start), to = Number(active.dataset.end), raw = byte_slice(this.state.source, from, to);
          if (raw.startsWith(open) && raw.endsWith(close)) { this.replace(raw.slice(open.length, -close.length), from, to, Math.max(from, Math.min(to - byte_length(open + close), start - byte_length(open)))); this.focus(); return; }
        }
      }
      if (selected.startsWith(open) && selected.endsWith(close) && selected.length >= open.length + close.length) this.replace(selected.slice(open.length, -close.length));
      else this.replace(open + selected + close, start, end, start + byte_length(open + selected));
      this.focus(); return;
    }
    if (command.startsWith('heading_') || ['paragraph', 'quote', 'list', 'ordered_list', 'task', 'indent', 'outdent', 'alert'].includes(command)) {
      const line = this.line_range();
      if (command === 'indent') { this.replace('    ' + line.text, line.start, line.end); }
      else if (command === 'outdent') this.replace(line.text.replace(/^( {1,4}|\t)/u, ''), line.start, line.end);
      else {
        const prefix = command.startsWith('heading_') ? '#'.repeat(Number(command.slice(-1))) + ' ' : ({ paragraph: '', quote: '> ', list: '- ', ordered_list: '1. ', task: '- [ ] ', alert: '> [!NOTE]\n> ' })[command];
        this.replace(prefix + line.text.replace(/^(#{1,6} |> |(?:[-+*]|\d+[.)]) (?:\[[ xX]\] )?)/u, ''), line.start, line.end);
      }
      this.focus(); return;
    }
    if (command === 'hard_break') { this.replace(['code_block', 'comment', 'front_matter'].includes(this.active_kind()) ? '\n' : '<br>'); this.focus(); return; }
    if (command === 'link') return this.link_dialog();
    if (command === 'unlink') {
      const link = this.active_link(); if (!link) return;
      const start = Number(link.dataset.start), end = Number(link.dataset.end), raw = byte_slice(this.state.source, start, end);
      const label = raw.match(/^\[((?:\\.|[^\]])*)\]/u)?.[1] || raw;
      this.replace(label, start, end); return;
    }
    if (command === 'open_link') { const link = this.active_link(); if (link) this.open_anchor(link); return; }
    if (command === 'footnote') {
      const name = `note-${this.state.revision + 1n}`;
      const start = Math.min(this.selection.anchor, this.selection.focus);
      const text = byte_slice(this.state.source, 0, start) + `[^${name}]` + byte_slice(this.state.source, Math.max(this.selection.anchor, this.selection.focus)) + `\n\n[^${name}]: 각주 내용`;
      this.replace(text, 0, byte_length(this.state.source), start + byte_length(`[^${name}]`)); return;
    }
    if (command === 'table') { this.replace('\n| 제목 | 제목 |\n| --- | --- |\n|  |  |\n\n'); this.focus(); return; }
    if (command === 'table_tools') return this.table_dialog();
    if (command === 'attachment') { this.root.querySelector('.file_input').click(); return; }
    if (command === 'copy_markdown') { await navigator.clipboard.writeText(byte_slice(this.state.source, Math.min(this.selection.anchor, this.selection.focus), Math.max(this.selection.anchor, this.selection.focus)) || this.get_markdown()); return; }
    if (command === 'save') {
      const markdown = this.get_markdown({normalize:!this.state.draft}); const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = this.options.filename || 'document.md'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.mark_saved(); this.dispatchEvent(new CustomEvent('save', { detail: { markdown } })); return;
    }
    if (command === 'open') {
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.md,.markdown,.txt,text/markdown,text/plain';
      const revision = this.state.revision;
      input.onchange = async () => {
        try {
          if (!this.core || !input.files[0]) return;
          const source = await input.files[0].text();
          if (!this.core) return;
          if (this.state.revision !== revision) throw new Error('Document changed while opening the file');
          this.set_markdown(source);
        } catch (error) { this.report(error); }
      }; input.click();
    }
  }
  command_palette() {
    const commands = [...this.toolbar.querySelectorAll('button')];
    this.show_dialog('명령 실행', `<label>명령<select name="command">${commands.map(button => `<option value="${button.dataset.command}">${button.title}</option>`).join('')}</select></label>`, data => this.run(data.get('command')));
  }
  map_dialog_from_sources(before, after) {
    if (!this.dialog.open || before === after) return;
    let start = 0, suffix = 0;
    while (start < before.length && start < after.length && before[start] === after[start]) start++;
    if (start && /[\uD800-\uDBFF]/u.test(before[start - 1])) start--;
    while (suffix < before.length - start && suffix < after.length - start && before.at(-suffix - 1) === after.at(-suffix - 1)) suffix++;
    if (suffix && /[\uDC00-\uDFFF]/u.test(before[before.length - suffix])) suffix--;
    this.map_dialog_positions(utf16_to_byte(before, start), utf16_to_byte(before, before.length - suffix), byte_length(after.slice(start, after.length - suffix)));
  }
  map_dialog_positions(start, end, inserted) {
    if (!this.dialog.open) return;
    const map = position => position < start ? position : position > end ? position - (end - start) + inserted : start + inserted;
    if (this.dialog_selection) this.dialog_selection = { anchor: map(this.dialog_selection.anchor), focus: map(this.dialog_selection.focus) };
    if (this.dialog_range) this.dialog_range = { start: map(this.dialog_range.start), end: map(this.dialog_range.end) };
  }
  show_dialog(title, fields, callback) {
    this.dialog_selection = { ...this.selection }; this.dialog_scroll = this.surface.scrollTop; this.dialog_range = null;
    this.dialog.querySelector('h2').textContent = title;
    this.dialog.querySelector('.fields').innerHTML = fields;
    this.dialog_callback = callback; this.dialog.returnValue = 'cancel'; this.dialog.showModal(); this.dialog.querySelector('input,select')?.focus();
  }
  active_link() { const focus = this.selection.focus; return [...this.surface.querySelectorAll('a[data-kind="link"]')].find(link => Number(link.dataset.start) <= focus && Number(link.dataset.end) >= focus); }
  link_dialog() {
    const link = this.active_link();
    const start = link ? Number(link.dataset.start) : Math.min(this.selection.anchor, this.selection.focus), end = link ? Number(link.dataset.end) : Math.max(this.selection.anchor, this.selection.focus);
    const raw = byte_slice(this.state.source, start, end);
    const label = link ? raw.match(/^\[((?:\\.|[^\]])*)\]/u)?.[1] || raw : raw;
    this.show_dialog('링크', `<label>표시 텍스트<input name="label" value="${escape_html(label)}"></label><label>주소<input name="url" type="text" value="${escape_html(link?.getAttribute('href') || '')}" required></label>`, data => {
      const url = data.get('url'); if (!safe_url(url)) { this.report(new Error('허용하지 않는 링크 주소입니다.')); return; }
      const range = this.dialog_range || { start, end };
      this.replace(`[${data.get('label').replace(/[\[\]\\]/gu, '\\$&')}](${url.replace(/\(/gu, '%28').replace(/\)/gu, '%29')})`, range.start, range.end);
    });
    this.dialog_range = { start, end };
  }
  open_anchor(anchor) {
    const url = anchor.getAttribute('href');
    if (anchor.hasAttribute('download') && url?.startsWith('data:')) {
      const [prefix, body] = url.split(',');
      const binary = atob(body), bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      const object_url = URL.createObjectURL(new Blob([bytes], { type: prefix.slice(5).split(';')[0] }));
      const download = document.createElement('a'); download.href = object_url; download.download = anchor.getAttribute('download') || 'attachment'; download.click(); setTimeout(() => URL.revokeObjectURL(object_url), 1000); return;
    }
    if (!url || !safe_url(url)) return;
    if (url.startsWith('#')) {
      const name = decodeURIComponent(url.slice(1)); const target = this.root.getElementById(name) || this.root.querySelector(`[name="${CSS.escape(name)}"]`); target?.scrollIntoView({ block: 'center' }); return;
    }
    window.open(new URL(url, document.baseURI), '_blank', 'noopener,noreferrer');
  }
  active_cell() { const focus = this.selection.focus; return [...this.surface.querySelectorAll('[data-cell]')].find(cell => Number(cell.dataset.start) <= focus && Number(cell.dataset.end) >= focus); }
  move_cell(direction) {
    const cell = this.active_cell(); if (!cell) return;
    const cells = [...cell.closest('table').querySelectorAll('[data-cell]')], index = cells.indexOf(cell), next = cells[index + direction];
    if (next) { this.set_selection(Number(next.dataset.start)); this.focus(); return; }
    if (direction > 0) { this.table_action('row_after'); this.move_to_cell(Number(cell.dataset.row) + 1, 0); }
    else this.exit_table(-1);
  }
  move_to_cell(row, column) {
    const cells = [...this.surface.querySelectorAll('[data-cell]')];
    const cell = cells.find(cell => Number(cell.dataset.row) === row && Number(cell.dataset.column) === column && Number(cell.dataset.start) >= (this.table_start || 0));
    if (cell) { this.set_selection(Number(cell.dataset.start), Number(cell.dataset.start), true); this.focus(); }
  }
  cell_arrow(event) {
    const cell = this.active_cell(); if (!cell || this.selection.anchor !== this.selection.focus) return;
    const focus = this.selection.focus;
    const at_start = focus === Number(cell.dataset.start), at_end = focus === Number(cell.dataset.end);
    if (event.key === 'ArrowLeft' && at_start || event.key === 'ArrowRight' && at_end) { event.preventDefault(); this.move_cell(event.key === 'ArrowLeft' ? -1 : 1); }
    if (event.key === 'ArrowUp' && at_start || event.key === 'ArrowDown' && at_end) {
      event.preventDefault();
      const row = Number(cell.dataset.row) + (event.key === 'ArrowUp' ? -1 : 1), column = Number(cell.dataset.column);
      const target = cell.closest('table').querySelector(`[data-row="${row}"][data-column="${column}"]`);
      if (target) this.set_selection(Number(target.dataset.start));
      else this.exit_table(event.key === 'ArrowUp' ? -1 : 1);
    }
  }
  exit_table(direction) {
    const cell = this.active_cell(); if (!cell) return;
    const block = cell.closest('[data-block]');
    const position = Number(block.dataset[direction < 0 ? 'start' : 'end']);
    if (direction < 0 && position === 0) this.replace('\n', 0, 0, 0);
    else if (direction > 0 && position === byte_length(this.state.source)) this.replace('\n\n', position, position, position + 2);
    else this.set_selection(position + direction);
    this.focus();
  }
  table_dialog() {
    if (!this.active_cell()) return;
    this.show_dialog('표 도구', `<label>작업<select name="action"><option value="row_before">위에 행 삽입</option><option value="row_after">아래에 행 삽입</option><option value="column_before">왼쪽에 열 삽입</option><option value="column_after">오른쪽에 열 삽입</option><option value="move_row_up">선택 행 위로 이동</option><option value="move_row_down">선택 행 아래로 이동</option><option value="move_column_left">선택 열 왼쪽으로 이동</option><option value="move_column_right">선택 열 오른쪽으로 이동</option><option value="delete_rows">선택 행 삭제</option><option value="delete_columns">선택 열 삭제</option><option value="select_row">행 선택</option><option value="select_column">열 선택</option><option value="clear">선택 셀 비우기</option><option value="align_left">왼쪽 정렬</option><option value="align_center">가운데 정렬</option><option value="align_right">오른쪽 정렬</option><option value="exit_before">표 앞으로 이동</option><option value="exit_after">표 뒤로 이동</option><option value="delete_table">표 삭제</option></select></label>`, data => this.table_action(data.get('action')));
  }
  add_table_handles() {
    if (this.reading || this.options.read_only) return;
    for (const table of this.surface.querySelectorAll('table')) {
      for (const row of table.rows) for (const cell of row.cells) {
        if (cell.querySelector('.table_handle')) continue;
        const handle = (axis, index) => {
          const button = document.createElement('button'); button.type = 'button'; button.className = `table_handle ${axis}_handle`;
          button.dataset[axis === 'row' ? 'rowHandle' : 'columnHandle'] = index;
          button.contentEditable = 'false'; button.tabIndex = 0;
          const label=`${index+1}${axis==='row'?'행':'열'}`;
          button.setAttribute('aria-label',`${label} 선택 및 이동`);button.title=axis==='row'&&index===0?'머리행: 클릭 선택 · 이동 고정':`${label}: 클릭 선택 · 드래그 이동 · Shift+드래그 범위 선택 · Alt+방향키 이동`;
          button.addEventListener('keydown',event=>{
            if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();this.drag_axis=axis;this.set_selection(+cell.dataset.start);this.select_cell_rectangle(cell,cell);return;}
            const backward=axis==='row'?'ArrowUp':'ArrowLeft',forward=axis==='row'?'ArrowDown':'ArrowRight';
            if(!event.altKey||![backward,forward].includes(event.key))return;
            event.preventDefault();event.stopPropagation();
            try{this.move_table_axis(cell,axis,index,index,index+(event.key===backward?-1:2));}catch(error){this.report(error);}
          });cell.prepend(button);
        };
        if (cell.cellIndex === 0) handle('row', row.rowIndex);
        if (row.rowIndex === 0) handle('column', cell.cellIndex);
      }
    }
  }
  clear_table_drop(){this.surface.querySelectorAll('[data-drop]').forEach(cell=>delete cell.dataset.drop);}
  cancel_table_drag(){this.dragging=false;this.handle_drag=null;this.drag_cell=null;this.clear_table_drop();}
  move_table_axis(cell,axis,from,to,slot){
    if(this.options.read_only||this.reading||this.composing||!cell?.isConnected)return;
    if(!['row','column'].includes(axis))throw new Error('Invalid table axis');
    const table=cell.closest('table'),block=cell.closest('[data-block]'),start=+block.dataset.start,end=+block.dataset.end;
    const length=axis==='row'?table.rows.length:table.rows[0].cells.length;
    if(from<0||to<from||to>=length||slot<0||slot>length)return;
    if(axis==='row'&&(from===0||slot===0))return; // Markdown header stays pinned.
    const indices=Array.from({length},(_,i)=>i),targets=indices.slice(from,to+1),before=indices.slice(slot).find(i=>!targets.includes(i));
    const order=indices.filter(i=>!targets.includes(i)),at=before===undefined?order.length:order.indexOf(before);order.splice(at,0,...targets);
    if(order.every((value,index)=>value===index))return;
    this.table_start=start;this.set_selection(+cell.dataset.start);
    if(this.core.reorder_table){
      const projection=this.core.replica.snapshot.projection.find(table=>start>=table.start&&start<=table.end);
      const view=this.core.replica.snapshot.tables.find(table=>table.id===projection?.id);
      if(!view)throw new Error('원본 표의 열 수를 맞춘 뒤 이동해 주세요.');
      const ids=axis==='row'?view.rows:view.columns;
      this.state=this.core.reorder_table(view.id,axis,targets.map(i=>ids[i]),before===undefined?null:ids[before]);
      this.selection={anchor:this.state.anchor,focus:this.state.focus};this.cell_selection=null;this.pairs=[];this.render();this.emit_change();
    }else{
      const rows=[...table.rows].map(row=>[...row.cells].map(cell=>byte_slice(this.state.source,+cell.dataset.start,+cell.dataset.end)));
      let align=[...table.rows[0].cells].map(cell=>cell.classList.contains('align_right')?'---:':cell.classList.contains('align_center')?':---:':'---');
      const arranged=axis==='row'?order.map(i=>rows[i]):rows.map(row=>order.map(i=>row[i]));
      if(axis==='column')align=order.map(i=>align[i]);
      const format=row=>'| '+row.join(' | ')+' |';this.cell_selection=null;
      this.replace([format(arranged[0]),format(align),...arranged.slice(1).map(format)].join('\n'),start,end,start);
    }
    const row=axis==='row'?at:+cell.dataset.row,column=axis==='column'?at:+cell.dataset.column;
    this.move_to_cell(row,column);this.core.request(11,'',this.selection.anchor,this.selection.focus);
    const moved=[...this.surface.querySelectorAll(`[data-${axis}-handle="${axis==='row'?row:column}"]`)].find(handle=>+handle.closest('[data-block]').dataset.start===start);moved?.focus();
    this.root.querySelector('.announce').textContent=`${axis==='row'?'행':'열'}을 ${at+1}번째 위치로 이동했습니다.`;
  }
  select_cell_rectangle(first, last) {
    const table = first.closest('table');
    if (this.drag_axis === 'row') this.cell_selection = { first: table.rows[+first.dataset.row].cells[0], last: table.rows[+last.dataset.row].cells[table.rows[+last.dataset.row].cells.length - 1] };
    else if (this.drag_axis === 'column') this.cell_selection = { first: table.rows[0].cells[+first.dataset.column], last: table.rows[table.rows.length - 1].cells[+last.dataset.column] };
    else this.cell_selection = { first, last };
    this.paint_cells();
  }
  paint_cells() {
    this.surface.querySelectorAll('[data-selected]').forEach(cell => cell.removeAttribute('data-selected'));
    if (!this.cell_selection) return;
    const { first, last } = this.cell_selection;
    for (const cell of first.closest('table').querySelectorAll('[data-cell]')) {
      const row = Number(cell.dataset.row), column = Number(cell.dataset.column);
      if (row >= Math.min(+first.dataset.row, +last.dataset.row) && row <= Math.max(+first.dataset.row, +last.dataset.row) && column >= Math.min(+first.dataset.column, +last.dataset.column) && column <= Math.max(+first.dataset.column, +last.dataset.column)) cell.dataset.selected = '1';
    }
  }
  table_action(action) {
    const cell = this.active_cell(); if (!cell) return;
    if (action === 'exit_before' || action === 'exit_after') return this.exit_table(action === 'exit_before' ? -1 : 1);
    const block = cell.closest('[data-block]'), start = Number(block.dataset.start), end = Number(block.dataset.end), row = Number(cell.dataset.row), column = Number(cell.dataset.column);
    this.table_start = start;
    const rows = [...cell.closest('table').rows].map(row => [...row.cells].map(cell => byte_slice(this.state.source, Number(cell.dataset.start), Number(cell.dataset.end))));
    const selected = this.cell_selection;
    const r1 = selected ? Math.min(+selected.first.dataset.row, +selected.last.dataset.row) : row, r2 = selected ? Math.max(+selected.first.dataset.row, +selected.last.dataset.row) : row;
    const c1 = selected ? Math.min(+selected.first.dataset.column, +selected.last.dataset.column) : column, c2 = selected ? Math.max(+selected.first.dataset.column, +selected.last.dataset.column) : column;
    if(action.startsWith('move_')){
      const axis=action.startsWith('move_row')?'row':'column',from=axis==='row'?r1:c1,to=axis==='row'?r2:c2;
      return this.move_table_axis(cell,axis,from,to,action.endsWith('up')||action.endsWith('left')?from-1:to+2);
    }
    let align = [...cell.closest('table').rows[0].cells].map(cell => cell.classList.contains('align_right') ? '---:' : cell.classList.contains('align_center') ? ':---:' : '---');
    if (action === 'select_row' || action === 'select_column') {
      const table = cell.closest('table');
      this.cell_selection = action === 'select_row' ? { first: table.rows[row].cells[0], last: table.rows[row].cells[rows[row].length - 1] } : { first: table.rows[0].cells[column], last: table.rows[rows.length - 1].cells[column] };
      this.paint_cells(); return;
    }
    if (this.core.table_action) {
      this.state = this.core.table_action(start, action, row, column, [r1,r2,c1,c2]);
      this.selection = {anchor:this.state.anchor,focus:this.state.focus}; this.cell_selection = null; this.pairs = []; this.render();
      const view = this.core.replica.snapshot.projection.find(table => start >= table.start && start <= table.end);
      if (view?.cells.length) this.move_to_cell(Math.min(row, this.core.replica.snapshot.tables.find(table => table.id === view.id).rows.length-1),Math.min(column,this.core.replica.snapshot.tables.find(table => table.id === view.id).columns.length-1));
      this.emit_change(); return;
    }
    if (action === 'delete_table') { this.cell_selection = null; this.replace('', start, end); return; }
    if (action === 'row_before' || action === 'row_after') rows.splice(action === 'row_before' ? Math.max(1, row) : row + 1, 0, Array(align.length).fill(''));
    if (action === 'column_before' || action === 'column_after') { const at = column + (action === 'column_after' ? 1 : 0); rows.forEach(row => row.splice(at, 0, '')); align.splice(at, 0, '---'); }
    if (action === 'delete_rows') { rows.splice(r1, r2 - r1 + 1); }
    if (action === 'delete_columns') { rows.forEach(row => row.splice(c1, c2 - c1 + 1)); align.splice(c1, c2 - c1 + 1); }
    if (action === 'clear') for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) rows[r][c] = '';
    if (action.startsWith('align_')) for (let c = c1; c <= c2; c++) align[c] = action === 'align_center' ? ':---:' : action === 'align_right' ? '---:' : '---';
    this.cell_selection = null;
    if (!rows.length || !align.length) { this.replace('', start, end); return; }
    const format = row => '| ' + row.join(' | ') + ' |';
    const text = [format(rows[0]), format(align), ...rows.slice(1).map(format)].join('\n');
    this.replace(text, start, end, start);
    this.move_to_cell(Math.min(row, rows.length - 1), Math.min(column, align.length - 1));
  }
  async paste(event) {
    event.preventDefault(); if (this.options.read_only || this.reading || this.composing) return;
    this.capture_selection();
    try {
      const files = [...event.clipboardData.files]; if (files.length) return await this.add_files(files);
      const html = event.clipboardData.getData('text/html');
      const text = html && !this.source_view ? html_to_markdown(html) : event.clipboardData.getData('text/plain').replace(/\t/gu, ' ');
      this.replace(text);
    } catch (error) { this.report(error); }
  }
  copy(event) {
    this.capture_selection();
    if (this.selection.anchor === this.selection.focus) return;
    event.preventDefault();
    const raw = byte_slice(this.state.source, Math.min(this.selection.anchor, this.selection.focus), Math.max(this.selection.anchor, this.selection.focus));
    let plain = raw;
    if (!this.source_view && this.dom_selection()?.rangeCount) {
      const copy = this.dom_selection().getRangeAt(0).cloneContents();
      copy.querySelectorAll('[contenteditable="false"]').forEach(element => element.remove());
      const wrapper = document.createElement('div'); wrapper.append(copy);
      plain = wrapper.textContent;
      wrapper.querySelectorAll('*').forEach(element => { for (const attribute of [...element.attributes]) if (!['href','src','alt','title','width','height'].includes(attribute.name)) element.removeAttribute(attribute.name); });
      event.clipboardData.setData('text/html', wrapper.innerHTML);
    }
    event.clipboardData.setData('text/plain', plain);
    event.clipboardData.setData('text/markdown', raw);
  }
  async add_files(files) {
    if (this.options.read_only || this.reading || this.composing || !files.length) return;
    try {
      const selection = { ...this.selection }, revision = this.state.revision;
      const max = this.options.attachments.max_file_size, total = this.options.attachments.max_total_size;
      const embedded = [...this.state.source.matchAll(/data:[^,\s]*;base64,([A-Za-z0-9+/=]+)/gu)].reduce((sum, match) => sum + Math.floor(match[1].length * 3 / 4) - (match[1].endsWith('==') ? 2 : match[1].endsWith('=') ? 1 : 0), 0);
      if (files.some(file => file.size > max) || embedded + files.reduce((sum, file) => sum + file.size, 0) > total) throw new Error('첨부 용량 제한을 초과했습니다.');
      for (const file of files) {
        if (/^image\/(png|jpeg|gif|webp|avif)$/iu.test(file.type) ? !this.options.images.enabled : !this.options.attachments.enabled) throw new Error('첨부가 비활성화되어 있습니다.');
      }
      const markdown = await Promise.all(files.map(async file => file_markdown(file, await read_file(file))));
      if (this.state.revision !== revision) throw new Error('첨부를 읽는 동안 문서가 변경되었습니다. 다시 삽입해 주세요.');
      this.selection = selection; this.replace('\n' + markdown.join('\n') + '\n'); this.focus();
    } catch (error) { this.report(error); }
  }
  ensure_caret_visible() {
    if (!this.has_focus()) return;
    const viewport = window.visualViewport;
    const range = this.dom_selection()?.rangeCount ? this.dom_selection().getRangeAt(0) : null;
    const rect = range?.getBoundingClientRect();
    if (rect && viewport && rect.bottom > viewport.height + viewport.offsetTop - 32) this.surface.scrollTop += rect.bottom - viewport.height - viewport.offsetTop + 48;
    this.active_cell()?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  report(error) { const errors = this.root.querySelector('.errors'), state = this.root.querySelector('.state'); if (errors) errors.textContent = error.message; if (state) state.textContent = error.message; this.dispatchEvent(new CustomEvent('error', { detail: error })); }
}
