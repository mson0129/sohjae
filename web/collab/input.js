// Textarea binding for the separate collaboration verification UI.
import { utf16_to_byte, byte_to_utf16 } from './core.js';
export function bind_field(replica, field, scope = null, on_error = console.error, on_settled = () => {}) {
  let anchors = null, composition = null, before = null, finishing = false;
  const read_text = () => scope ? replica.snapshot.tables.find(table => table.id === scope.table)?.cells.find(cell => cell.row === scope.row && cell.column === scope.column)?.text ?? '' : replica.snapshot.text;
  const remember = () => {
    if (composition || field.value !== read_text()) return;
    anchors = [replica.anchor_at(utf16_to_byte(field.value, field.selectionStart), 'before', scope), replica.anchor_at(utf16_to_byte(field.value, field.selectionEnd), 'after', scope)];
  };
  const refresh = () => {
    if (composition || finishing) return;
    const text = read_text();
    if (field.value === text) return;
    const focused = document.activeElement === field;
    field.value = text;
    if (focused && anchors) {
      try { field.setSelectionRange(...anchors.map(anchor => byte_to_utf16(text, replica.resolve_anchor(anchor)))); } catch { field.setSelectionRange(text.length, text.length); }
    }
  };
  for (const type of ['select', 'keyup', 'pointerup', 'focus']) field.addEventListener(type, remember);
  field.addEventListener('compositionstart', () => {
    const start = utf16_to_byte(field.value, field.selectionStart);
    composition = {
      capture: replica.capture_range(start, utf16_to_byte(field.value, field.selectionEnd), scope),
      caret: replica.anchor_at(start, 'after', scope)
    };
  });
  field.addEventListener('compositionend', event => {
    const capture = composition; composition = null; finishing = true;
    try { if (capture && event.data) replica.replace_capture(capture.capture, event.data); } catch (error) { on_error(error); }
    queueMicrotask(() => {
      finishing = false; field.value = read_text();
      if (capture && event.data) {
        try { const offset = byte_to_utf16(field.value, replica.resolve_anchor(capture.caret)); field.setSelectionRange(offset, offset); } catch { field.setSelectionRange(field.value.length, field.value.length); }
      }
      remember(); on_settled();
    });
  });
  field.addEventListener('beforeinput', event => {
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault();
      try { event.inputType === 'historyUndo' ? replica.undo() : replica.redo(); } catch (error) { on_error(error); }
      return;
    }
    if (!composition && !finishing) before = read_text();
  });
  field.addEventListener('input', event => {
    if (composition || finishing || event.isComposing) return;
    const old_text = before ?? read_text(), new_text = field.value, selection = field.selectionStart;
    before = null;
    let prefix = 0, old_end = old_text.length, new_end = new_text.length;
    while (prefix < Math.min(old_end, new_end) && old_text[prefix] === new_text[prefix]) prefix++;
    // A diff boundary must never split a surrogate pair.
    if (prefix && /[\uD800-\uDBFF]/u.test(old_text[prefix - 1])) prefix--;
    while (old_end > prefix && new_end > prefix && old_text[old_end - 1] === new_text[new_end - 1]) { old_end--; new_end--; }
    if (old_end < old_text.length && /[\uDC00-\uDFFF]/u.test(old_text[old_end])) { old_end++; new_end++; }
    try {
      replica.replace_text(utf16_to_byte(old_text, prefix), utf16_to_byte(old_text, old_end), new_text.slice(prefix, new_end), scope);
      field.value = read_text(); field.setSelectionRange(selection, selection); remember();
    } catch (error) { field.value = read_text(); on_error(error); }
  });
  field.value = read_text();
  return { refresh, composing: () => !!composition || finishing, field };
}
