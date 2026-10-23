import { create_editor, grapheme_range } from './editor.js';
import { byte_length, byte_slice } from './core.js';
import { html_to_markdown, file_markdown } from './clipboard.js';

const results = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (a, b) => { if (a !== b) throw new Error(`${String(a)} !== ${String(b)}`); };
async function test(name, action) {
  const item = document.createElement('li');
  try { await action(); item.textContent = `PASS ${name}`; item.className = 'pass'; results.push(true); }
  catch (error) { item.textContent = `FAIL ${name}: ${error.stack}`; item.className = 'fail'; results.push(false); }
  document.querySelector('#results').append(item);
}
async function fixture(markdown = '', options = {}) {
  const container = document.createElement('div'); document.querySelector('#fixtures').append(container);
  return create_editor(container, { markdown, mode: 'rich', auto_close: { enabled: false }, ...options });
}

await test('WASM create, edit, undo, redo and independent instances', async () => {
  const first = await fixture('한😀'), second = await fixture('second');
  first.set_selection(3, 7); first.replace('글'); equal(first.get_markdown(), '한글');
  await first.execute_command('undo'); equal(first.get_markdown(), '한😀');
  await first.execute_command('redo'); equal(first.get_markdown(), '한글'); equal(second.get_markdown(), 'second');
  first.destroy(); second.destroy();
});
await test('Mode and source view transitions preserve document, history and reversed selection', async () => {
  const editor = await fixture('a **한😀** z'); editor.set_selection(11, 4);
  const revision = editor.state.revision;
  for (const mode of ['hybrid', 'markdown', 'rich']) { editor.set_options({ mode }); equal(editor.selection.anchor, 11); equal(editor.selection.focus, 4); }
  editor.set_view('source'); editor.set_view('source'); equal(editor.state.revision, revision); equal(editor.get_markdown(), 'a **한😀** z'); editor.destroy();
});
await test('Every displayed scalar boundary maps to UTF-8 and back', async () => {
  const editor = await fixture('한😀 é **굵게**');
  for (const span of editor.surface.querySelectorAll('[data-text]')) {
    const start = Number(span.dataset.start);
    let offset = 0;
    for (const char of span.textContent) {
      const position = start + byte_length(span.textContent.slice(0, offset));
      equal(editor.dom_to_source(span.firstChild, offset), position);
      const [node, index] = editor.source_to_dom(position); equal(editor.dom_to_source(node, index), position); offset += char.length;
    }
  }
  editor.destroy();
});
await test('Grapheme deletion handles Korean, combining marks, ZWJ families and flags', () => {
  for (const grapheme of ['한', 'é', '👨‍👩‍👧‍👦', '🇰🇷', '👍🏽']) {
    const source = 'a' + grapheme + 'b', end = byte_length('a' + grapheme);
    const [start, stop] = grapheme_range(source, end, true); equal(byte_slice(source, start, stop), grapheme);
  }
});
await test('Rich input routes through WASM with selection restoration', async () => {
  const editor = await fixture('한😀'); editor.focus(); editor.set_selection(3, 7);
  editor.surface.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: '글', bubbles: true, cancelable: true }));
  equal(editor.get_markdown(), '한글'); equal(editor.selection.focus, 6);
  await editor.execute_command('undo'); equal(editor.get_markdown(), '한😀'); editor.destroy();
});
await test('Composition commits once without modifying the composing DOM', async () => {
  const editor = await fixture(''); editor.focus();
  editor.surface.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  const original = editor.surface.firstChild;
  editor.surface.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertCompositionText', data: 'ㅎ', isComposing: true, bubbles: true }));
  equal(editor.surface.firstChild, original); equal(editor.state.source, '');
  editor.surface.dispatchEvent(new CompositionEvent('compositionend', { data: '한', bubbles: true }));
  editor.surface.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: '한', bubbles: true, cancelable: true }));
  equal(editor.state.source, '한'); await editor.execute_command('undo'); equal(editor.state.source, ''); editor.destroy();
});
await test('Table Tab adds row, navigation, row/column edits and exit', async () => {
  const editor = await fixture('| a | b |\n| --- | :---: |\n| c | d |');
  let cells = [...editor.surface.querySelectorAll('[data-cell]')]; editor.set_selection(Number(cells.at(-1).dataset.start)); editor.move_cell(1);
  equal(editor.surface.querySelector('table').rows.length, 3); equal(editor.active_cell().dataset.column, '0');
  editor.table_action('column_after'); equal(editor.surface.querySelector('table').rows[0].cells.length, 3);
  editor.table_action('delete_columns'); equal(editor.surface.querySelector('table').rows[0].cells.length, 2);
  editor.exit_table(1); assert(editor.state.source.endsWith('\n\n'), 'exit creates editing paragraph'); editor.destroy();
});
await test('Clipboard strips unsupported styles, flattens merged cells and removes executable content', () => {
  const markdown = html_to_markdown('<p style="font-size:50px;color:red"><b>bold</b> plain</p><table><tr><td rowspan="2"><p>one</p><p>two</p></td><td>x</td></tr><tr><td><table><tr><td>nested</td></tr></table></td></tr></table><script>alert(1)</script>');
  assert(markdown.includes('**bold**'), markdown); assert(markdown.includes('one<br>two'), markdown);
  assert(!markdown.includes('font-size') && !markdown.includes('alert('), markdown); assert(markdown.includes('nested'), markdown);
});
await test('Raw unsupported attributes survive edits and sanitized rendering', async () => {
  const source = '<img src="x.png" onerror="alert(1)" width="80">\n<unknown custom="keep">raw</unknown>';
  const editor = await fixture(source); editor.set_selection(byte_length(source)); editor.replace('!');
  assert(!editor.surface.querySelector('[onerror]'), 'event handler was emitted'); equal(editor.get_markdown(), source + '!'); editor.destroy();
});
await test('Read-only rejects changes and front matter layout chooses registered layout', async () => {
  const editor = await fixture('---\nlayout: serif\n---\ntext', { read_only: true, layouts: { serif: {} } });
  editor.replace('bad'); equal(editor.state.source, '---\nlayout: serif\n---\ntext');
  equal(editor.root.querySelector('.markdown_editor').dataset.layout, 'serif'); editor.destroy();
});
await test('Attachment metadata is reversible and unsafe images remain downloads', () => {
  const file = new File(['a'], '보고서.pdf', { type: 'application/pdf' });
  assert(file_markdown(file, 'data:application/pdf;base64,YQ==').includes('"attachment-uri:' + encodeURIComponent('보고서.pdf') + '"'), 'filename missing');
  assert(file_markdown(new File(['x'], 'test.svg', { type: 'image/svg+xml' }), 'data:image/svg+xml;base64,eA==').startsWith('['), 'active SVG must download');
});
await test('Source textarea edits use the same undo stack', async () => {
  const editor = await fixture('한😀'); editor.set_view('source'); editor.source_input.value = '한글😀'; editor.source_input.setSelectionRange(2, 2); editor.source_changed();
  equal(editor.state.source, '한글😀'); await editor.execute_command('undo'); equal(editor.state.source, '한😀'); editor.destroy();
});

await test('Automatic pair tracking expands bold and skips only generated closers', async () => {
  const editor = await fixture('', { auto_close: { enabled: true } }); editor.focus();
  for (const text of ['*', '*', '한', '*', '*']) editor.type_text(text);
  equal(editor.state.source, '**한**'); equal(editor.selection.focus, 7);
  editor.set_markdown(''); editor.focus(); editor.type_text('`'); editor.type_text('x'); editor.type_text('`');
  equal(editor.state.source, '`x`'); editor.destroy();
});
await test('Automatic conversion undo escapes Markdown and redo restores formatting', async () => {
  const editor = await fixture('**text*'); editor.focus(); editor.set_selection(7); editor.type_text('*');
  equal(editor.state.source, '**text**'); assert(editor.auto_transform, 'conversion not recorded');
  await editor.execute_command('undo'); equal(editor.state.source, '\\*\\*text\\*\\*');
  await editor.execute_command('redo'); equal(editor.state.source, '**text**'); editor.destroy();
});
await test('Clipboard files embed and reopen with original names; limits reject oversized input', async () => {
  const editor = await fixture('');
  await editor.add_files([new File(['hello'], '보고서.txt', { type: 'text/plain' })]);
  assert(editor.state.source.includes('data:text/plain;base64,aGVsbG8='), 'file data missing');
  equal(editor.surface.querySelector('a').getAttribute('download'), '보고서.txt');
  const source = editor.get_markdown(); editor.set_markdown(source); equal(editor.surface.querySelector('a').getAttribute('download'), '보고서.txt');
  editor.set_options({ attachments: { max_file_size: 1 } }); await editor.add_files([new File(['large'], 'x.txt')]); equal(editor.get_markdown(), source); editor.destroy();
});
await test('Table rectangle selection clears cells and preserves other cells and alignment', async () => {
  const editor = await fixture('| a | b |\n| --- | :---: |\n| c | d |\n| e | f |');
  const cells = [...editor.surface.querySelectorAll('[data-cell]')]; editor.set_selection(Number(cells[2].dataset.start));
  editor.cell_selection = { first: cells[2], last: cells[5] }; editor.paint_cells(); equal(editor.surface.querySelectorAll('[data-selected]').length, 4);
  editor.table_action('clear'); assert(editor.state.source.includes('| a | b |'), 'header lost'); assert(editor.state.source.includes(':---:'), 'alignment lost');
  equal([...editor.surface.querySelector('table').rows[1].cells].map(cell => cell.textContent).join(''), ''); editor.destroy();
});

await test('Loading replaces revision and cancels stale asynchronous insertion', async () => {
  const editor = await fixture('old'); const revision = editor.state.revision;
  editor.set_markdown('new'); assert(editor.state.revision > revision, 'revision was reset');
  const old_revision = editor.core.revision; editor.core.revision = revision;
  let rejected = false; try { editor.core.request(3, 'stale', 0, 0); } catch { rejected = true; }
  editor.core.revision = old_revision; assert(rejected, 'stale edit accepted'); equal(editor.state.source, 'new'); editor.destroy();
});
await test('Element override and runtime options validation are atomic', async () => {
  const editor = await fixture('**text**', { mode: 'rich', elements: { bold: { reveal_markdown: true } } }); editor.focus(); editor.set_selection(3); editor.render();
  assert(editor.surface.querySelector('[data-revealed]'), 'rich override did not reveal');
  let rejected = false; try { editor.set_options({ mode: 'invalid' }); } catch { rejected = true; }
  assert(rejected, 'bad mode accepted'); equal(editor.options.mode, 'rich'); equal(editor.state.source, '**text**'); editor.destroy();
});
await test('Row and column drag handles select rectangular rows and columns', async () => {
  const editor = await fixture('| a | b |\n| --- | --- |\n| c | d |\n| e | f |');
  const table = editor.surface.querySelector('table'); assert(table.querySelector('[data-row-handle]'), 'missing row handles');
  editor.drag_axis = 'row'; editor.select_cell_rectangle(table.rows[1].cells[0], table.rows[2].cells[0]); equal(editor.surface.querySelectorAll('[data-selected]').length, 4);
  editor.drag_axis = 'column'; editor.select_cell_rectangle(table.rows[0].cells[1], table.rows[1].cells[1]); equal(editor.surface.querySelectorAll('[data-selected]').length, 3); editor.destroy();
});

await test('Hidden link destination and delimiter positions survive DOM projection and mode changes', async () => {
  const editor = await fixture('[label](https://example.test/path) **bold**'); editor.focus();
  for (const position of [1, 10, 20, 35]) {
    editor.set_selection(position); editor.capture_selection(); equal(editor.selection.focus, position);
    editor.set_view('source'); editor.set_view('source'); editor.capture_selection(); equal(editor.selection.focus, position);
    editor.set_options({ mode: 'markdown' }); editor.set_options({ mode: 'rich' }); editor.capture_selection(); equal(editor.selection.focus, position);
  }
  editor.destroy();
});

await test('Dialog bookmarks map through edits and close restores focus and selection', async () => {
  const editor = await fixture('before [label](https://example.test) after'); editor.focus(); editor.set_selection(10);
  editor.link_dialog(); assert(editor.dialog.open, 'dialog did not open');
  const original = { ...editor.dialog_range }; editor.replace('한', 0, 0);
  equal(editor.dialog_range.start, original.start + 3); equal(editor.dialog_range.end, original.end + 3);
  const closed = new Promise(resolve => editor.dialog.addEventListener('close', resolve, { once: true }));
  editor.dialog.close('cancel'); await closed;
  equal(editor.selection.focus, 13); assert(editor.has_focus(), 'focus not restored'); editor.destroy();
});
await test('Read-only checkboxes and toolbar cannot mutate the document', async () => {
  const editor = await fixture('- [ ] task', { read_only: true });
  assert(editor.surface.querySelector('input').disabled, 'checkbox is interactive');
  equal(editor.surface.getAttribute('contenteditable'), 'false');
  await editor.execute_command('bold'); equal(editor.state.source, '- [ ] task'); editor.destroy();
});
await test('Details and picture retain a single composed HTML block', async () => {
  const editor = await fixture('<details>\n<summary>Title</summary>\nText **bold**\n</details>');
  assert(editor.surface.querySelector('details summary'), 'summary detached');
  assert(editor.surface.querySelector('details strong'), 'details body not rendered');
  equal(editor.get_markdown(), '<details>\n<summary>Title</summary>\nText **bold**\n</details>'); editor.destroy();
});

await test('Destroy releases instance and allows reusing the host container', async () => {
  const first = await fixture('first'); const container = first.container; first.destroy(); first.destroy();
  equal(first.core, null); const second = await create_editor(container, { markdown: 'second' }); equal(second.get_markdown(), 'second'); second.destroy();
});
await test('Links can be unlinked without corrupting references or automatic URLs', async () => {
  for (const [source, expected, position] of [['[label](https://example.test)', 'label', 2], ['[label][ref]\n\n[ref]: https://example.test', 'label\n\n[ref]: https://example.test', 2], ['https://example.test', 'https://example.test', 5]]) {
    const editor = await fixture(source); editor.set_selection(position); await editor.execute_command('unlink'); equal(editor.state.source, expected); editor.destroy();
  }
});
await test('Bold toolbar toggles the active formatting while preserving text', async () => {
  const editor = await fixture('**한글**'); editor.set_selection(5); await editor.execute_command('bold'); equal(editor.state.source, '한글'); equal(editor.selection.focus, 3); editor.destroy();
});

await test('Undo and redo table commands restore original cell and final new-row caret', async () => {
  const editor = await fixture('| a | b |\n| --- | --- |\n| c | d |');
  const last = [...editor.surface.querySelectorAll('[data-cell]')].at(-1); const before = Number(last.dataset.start);
  editor.set_selection(before); editor.move_cell(1); const after = editor.selection.focus;
  await editor.execute_command('undo'); equal(editor.selection.focus, before);
  await editor.execute_command('redo'); equal(editor.selection.focus, after); equal(editor.active_cell().dataset.row, '2'); editor.destroy();
});
await test('Formatting command redo restores the caret inside its delimiters', async () => {
  const editor = await fixture('text'); editor.set_selection(4); await editor.execute_command('bold'); const caret = editor.selection.focus;
  await editor.execute_command('undo'); equal(editor.state.source, 'text'); equal(editor.selection.focus, 4);
  await editor.execute_command('redo'); equal(editor.selection.focus, caret); equal(editor.state.source, 'text****'); editor.destroy();
});

await test('CRLF import and paste normalize before interpreting UTF-8 selections', async () => {
  const editor = await fixture('---\r\nlayout: serif\r\n---\r\n한글');
  equal(editor.state.layout, 'serif'); assert(!editor.state.source.includes('\r'), 'CRLF remained');
  editor.set_selection(byte_length(editor.state.source)); editor.replace('\r\n😀'); assert(editor.state.source.endsWith('\n😀'), 'paste newline was not normalized'); editor.destroy();
});

await test('Highlight toolbar, toggling, mode projection and undo preserve Unicode selections', async () => {
  const editor = await fixture('한글😀');
  editor.set_selection(0, byte_length(editor.state.source)); await editor.execute_command('highlight');
  equal(editor.state.source, '==한글😀=='); equal(editor.surface.querySelector('mark').textContent, '한글😀');
  const saved = editor.state.source;
  for (const mode of ['hybrid', 'markdown', 'rich']) { editor.set_options({ mode }); equal(editor.state.source, saved); }
  await editor.execute_command('undo'); equal(editor.state.source, '한글😀');
  await editor.execute_command('redo'); equal(editor.state.source, saved);
  editor.set_selection(5); await editor.execute_command('highlight'); equal(editor.state.source, '한글😀'); editor.destroy();
});
await test('Highlight automatic closing and conversion undo escape equals signs', async () => {
  const editor = await fixture('', { auto_close: { enabled: true } }); editor.focus();
  for (const text of ['=', '=', 'h', 'i', '=', '=']) editor.surface.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: text, bubbles: true, cancelable: true }));
  equal(editor.state.source, '==hi==');
  editor.destroy();
  const plain = await fixture('==hi='); plain.set_selection(5); plain.focus();
  plain.surface.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: '=', bubbles: true, cancelable: true }));
  assert(plain.auto_transform, 'highlight conversion not recorded');
  await plain.execute_command('undo'); equal(plain.state.source, '\\=\\=hi\\=\\=');
  assert(!plain.surface.querySelector('mark'), 'undo still highlighted');
  await plain.execute_command('redo'); equal(plain.state.source, '==hi=='); plain.destroy();
});
await test('Extended blocks, explicit heading links, colored code and excluded script syntax render safely', async () => {
  const source = '# Heading {#custom-id}\n\n[Go](#custom-id)\n\nTerm\n: ==Definition==\n: second\n\n```json\n{"name":"한😀", "ok":true}\n```\n\nH~2~O X^2^ :tent: :joy:';
  const editor = await fixture(source);
  equal(editor.surface.querySelector('h1').id, 'custom-id');
  assert(!editor.surface.querySelector('h1').textContent.includes('{#'));
  equal(editor.surface.querySelectorAll('dt').length, 1); equal(editor.surface.querySelectorAll('dd').length, 2);
  assert(editor.surface.querySelector('.syntax_key') && editor.surface.querySelector('.syntax_literal'), 'code colors missing');
  assert(!editor.surface.querySelector('sub,sup'), 'excluded Markdown script syntax was enabled');
  assert(editor.surface.textContent.includes('H~2~O X^2^'));
  assert(editor.surface.textContent.includes('⛺') && editor.surface.textContent.includes('😂'));
  editor.set_options({ mode: 'markdown' }); editor.set_options({ mode: 'rich' });
  equal(editor.state.source, source); editor.destroy();
});
await test('HTML paste preserves mark and definition semantics without importing styles', async () => {
  const result = html_to_markdown('<p>plain ==literal== <mark style="background:red" onclick="bad()">한글</mark></p><dl><dt>Term</dt><dd>Definition</dd><dd>Other</dd></dl>');
  assert(result.includes('==한글==') && result.includes(': Definition') && !result.includes('onclick'));
  const editor = await fixture(result); equal(editor.surface.querySelectorAll('mark').length, 1);
  equal(editor.surface.querySelectorAll('dd').length, 2); editor.destroy();
});

await test('Normalized code-span spaces and newlines retain exact visible UTF-8 caret positions',async()=>{
 const editor=await fixture('` foo 한글 ` and `a\nb`');
 const spans=[...editor.surface.querySelectorAll('code [data-text]')];
 equal(editor.surface.querySelectorAll('code')[0].textContent,'foo 한글');equal(editor.surface.querySelectorAll('code')[1].textContent,'a b');
 for(const span of spans){const start=Number(span.dataset.start),end=Number(span.dataset.end);for(let offset=start;offset<=end;offset++){try{byte_slice(editor.state.source,0,offset);}catch{continue;}const[node,index]=editor.source_to_dom(offset);equal(editor.dom_to_source(node,index),offset);}}
 editor.destroy();
});

await test('Hierarchical list/quote spans round-trip Korean and emoji to original UTF-8 positions', async()=>{
 const source='> - 한😀\n>   - **세계**\n>     continued\n\n- parent\n  - child';const editor=await fixture(source);
 try{assert(editor.surface.querySelector('blockquote ul ul'),'nested structure missing');
 for(const span of editor.surface.querySelectorAll('[data-text]')){const start=+span.dataset.start,end=+span.dataset.end;equal(byte_slice(source,start,end),span.textContent);
 let position=start;for(const scalar of span.textContent){const [node,offset]=editor.source_to_dom(position);equal(editor.dom_to_source(node,offset),position);position+=byte_length(scalar);}}
 const start=byte_length(source.slice(0,source.indexOf('세계')));editor.set_selection(start,start+byte_length('세계'));await editor.execute_command('italic');assert(editor.state.source.includes('세계'));await editor.execute_command('undo');equal(editor.state.source,source);
 for(const mode of ['markdown','hybrid','rich']){editor.set_options({mode});equal(editor.state.source,source);}
 }finally{editor.destroy();}
});
await test('Bracket links do not create nested anchors and container definitions resolve in reading view',async()=>{
 const editor=await fixture('[https://example.test](/outer)\n\n[ref]\n\n> [ref]: /target');try{
 equal(editor.surface.querySelectorAll('a').length,2);assert(!editor.surface.querySelector('a a'),'nested anchor');assert(editor.surface.querySelector('a[href="/target"]'));
 const source=editor.state.source;editor.set_view('reading');assert(editor.surface.querySelector('a[href="/target"]'));equal(editor.state.source,source);editor.set_view('reading');
 }finally{editor.destroy();}
});
await test('GFM tab-expanded code and multiline headings preserve glyph carets and undo', async()=>{
 const source='>\t\t한😀\n\n첫째\n둘째\n---';const editor=await fixture(source);
 try{equal(editor.surface.querySelector('blockquote code').textContent,'  한😀\n');equal(editor.surface.querySelector('h2').textContent,'첫째\n둘째');
 const at=byte_length(source.slice(0,source.indexOf('한')));const [node,offset]=editor.source_to_dom(at);equal(editor.dom_to_source(node,offset),at);
 editor.set_selection(at,at+byte_length('한😀'));editor.replace('변경😀');equal(editor.surface.querySelector('blockquote code').textContent,'  변경😀\n');
 await editor.execute_command('undo');equal(editor.state.source,source);
 for(const mode of ['markdown','hybrid','rich']){editor.set_options({mode});equal(editor.state.source,source);}
 }finally{editor.destroy();}
});
await test('Typing and deletion group by time and caret while paste, commands and IME remain separate',async()=>{
 const editor=await fixture('',{mode:'rich',auto_close:{enabled:false}});
 const type=text=>editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertText',data:text,bubbles:true,cancelable:true}));
 try{editor.focus();for(const c of 'hello😀')type(c);equal(editor.state.source,'hello😀');await editor.execute_command('undo');equal(editor.state.source,'');await editor.execute_command('redo');equal(editor.state.source,'hello😀');
 type('a');await new Promise(resolve=>setTimeout(resolve,800));type('b');await editor.execute_command('undo');equal(editor.state.source,'hello😀a');await editor.execute_command('undo');equal(editor.state.source,'hello😀');
 editor.set_selection(0);type('X');editor.set_selection(byte_length(editor.state.source));type('Y');await editor.execute_command('undo');equal(editor.state.source,'Xhello😀');
 for(let i=0;i<2;i++)editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));
 await editor.execute_command('undo');equal(editor.state.source,'Xhello😀');
 editor.set_view('source');editor.source_input.focus();editor.set_selection(byte_length(editor.state.source));
 for(const c of ['한','😀']){const input=editor.source_input;input.value+=c;input.setSelectionRange(input.value.length,input.value.length);input.dispatchEvent(new InputEvent('input',{inputType:'insertText',data:c,bubbles:true}));}
 await editor.execute_command('undo');equal(editor.state.source,'Xhello😀');
 }finally{editor.destroy();}
});
await test('Inserting before unchanged blocks retains DOM text nodes and patches UTF-8 coordinates',async()=>{
 const source='첫째\n\n둘째😀\n\n셋째';const editor=await fixture(source,{mode:'rich'});
 try{const old=[...editor.surface.children],text=old[2].querySelector('[data-text]').firstChild;
 editor.set_selection(0);editor.replace('앞😀\n\n');equal(editor.surface.children[4],old[2]);equal(old[2].querySelector('[data-text]').firstChild,text);
 const offset=byte_length('앞😀\n\n첫째\n\n');equal(+old[2].dataset.start,offset);
 const [node,index]=editor.source_to_dom(offset);equal(editor.dom_to_source(node,index),offset);
 await editor.execute_command('undo');equal(editor.state.source,source);
 }finally{editor.destroy();}
});
await test('Accessibility toolbar has one Tab stop, arrow navigation, named dialogs and read-only semantics',async()=>{
 const editor=await fixture('**한글**\n\n| A | B |\n| --- | --- |\n| x | y |',{mode:'rich'});
 try{const enabled=()=>[...editor.toolbar.querySelectorAll('button:not(:disabled)')];equal(enabled().filter(button=>button.tabIndex===0).length,1);
 let buttons=enabled();buttons[0].focus();buttons[0].dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));equal(editor.root.activeElement,buttons.at(-1));
 buttons.at(-1).dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}));equal(editor.root.activeElement,buttons[0]);
 editor.set_selection(2);equal(editor.toolbar.querySelector('[data-command="bold"]').getAttribute('aria-pressed'),'true');
 editor.link_dialog();equal(editor.dialog.getAttribute('aria-labelledby'),'command_title');equal(editor.root.querySelector('#command_title').textContent,'링크');editor.dialog.close('cancel');
 editor.set_options({read_only:true});equal(editor.surface.getAttribute('aria-readonly'),'true');equal(editor.surface.querySelector('th').getAttribute('scope'),'col');
 equal(enabled().filter(button=>button.tabIndex===0).length,1);
 editor.set_view('reading');equal(editor.surface.getAttribute('role'),'document');assert(!editor.surface.hasAttribute('aria-multiline'));
 editor.report(new Error('검사 오류'));equal(editor.root.querySelector('[role="alert"]').textContent,'검사 오류');
 }finally{editor.destroy();}
});
document.querySelector('#summary').textContent = `${results.filter(Boolean).length}/${results.length} passed`;
document.body.dataset.passed = results.every(Boolean) ? 'true' : 'false';
const environment = document.createElement('p'); environment.textContent = navigator.userAgent; environment.id = 'environment'; document.querySelector('#summary').after(environment);
