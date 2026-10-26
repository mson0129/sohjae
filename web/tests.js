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
 try{const old=[...editor.surface.children],text=old[1].querySelector('[data-text]').firstChild;
 editor.set_selection(0);editor.replace('앞😀\n\n');equal(editor.surface.children[2],old[1]);equal(old[1].querySelector('[data-text]').firstChild,text);
 const offset=byte_length('앞😀\n\n첫째\n\n');equal(+old[1].dataset.start,offset);
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
await test('Paragraph and hard-break marks preserve empty-line height and source selection', async () => {
 const source='첫 문단\n\n\n다음 줄<br>마지막 줄';
 const editor=await fixture(source,{show_paragraph_marks:false});
 try {
  const empty=editor.surface.querySelector('[data-gap-start]');assert(empty,'empty paragraph fixture');
  const height=empty.getBoundingClientRect().height;
  editor.set_options({show_paragraph_marks:true});
  const current=editor.surface.querySelector('[data-gap-start]');
  equal(current.getBoundingClientRect().height,height);
  assert(!current.hasAttribute('data-paragraph-end'),'separator placeholder is not a paragraph end');
  assert(getComputedStyle(editor.surface.querySelector('p[data-paragraph-end]'),'::after').content.includes('↵'),'paragraph arrow');
  const marker=editor.surface.querySelector('.break_mark');assert(marker,'hard-break decoration');
  assert(getComputedStyle(marker,'::before').content.includes('↓'),'line arrow');
  equal(marker.getAttribute('aria-hidden'),'true');
  equal(editor.get_markdown({normalize:false}),source);
  editor.set_selection(0,3);editor.replace('새');assert(editor.get_markdown({normalize:false}).startsWith('새 문단'),'selection survives decoration');
  editor.set_options({show_paragraph_marks:false});equal(getComputedStyle(editor.surface.querySelector('.break_mark')).display,'none');
 }finally{editor.destroy();}
});
await test('Shift+Enter at paragraph end places caret after BR without a duplicate container-boundary paragraph', async () => {
 for(const marks of [false,true]) {
  const editor=await fixture('확인하세요.\n\n- [x] WASM으로 렌더링',{show_paragraph_marks:marks});
  try {
   editor.focus();editor.set_selection(byte_length('확인하세요.'));await editor.execute_command('hard_break');
   equal(editor.get_markdown({normalize:false}),'확인하세요.<br>\n\n- [x] WASM으로 렌더링');
   equal(editor.surface.querySelectorAll('p').length,1);
   const br=editor.surface.querySelector('br[data-break]'),selection=editor.dom_selection();
   equal(selection.focusNode,br.parentNode);equal(selection.focusOffset,[...br.parentNode.childNodes].indexOf(br)+1);
   equal(editor.dom_to_source(selection.focusNode,selection.focusOffset),byte_length('확인하세요.<br>'));
   assert(br.nextElementSibling?.matches('br[data-caret]'),'trailing BR needs a caret line');
   editor.replace('다음');equal(editor.get_markdown({normalize:false}),'확인하세요.<br>다음\n\n- [x] WASM으로 렌더링');
   assert(!editor.surface.querySelector('br[data-caret]'),'text replaces visual placeholder');
  }finally{editor.destroy();}
 }
});
await test('Rich and hybrid Delete/Backspace remove complete rendered line breaks, leaving literal code intact', async () => {
 for(const mode of ['rich','hybrid'])for(const token of ['<br>','<br/>','<br />','  \n','\\\n']) {
  const source='앞'+token+'뒤',editor=await fixture(source,{mode,show_paragraph_marks:true});
  try {
   editor.focus();editor.set_selection(byte_length('앞'));
   editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentForward',bubbles:true,cancelable:true}));
   equal(editor.get_markdown({normalize:false}),'앞뒤');
   await editor.execute_command('undo');editor.set_selection(byte_length('앞'+token));
   editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));
   equal(editor.get_markdown({normalize:false}),'앞뒤');
  }finally{editor.destroy();}
 }
 const editor=await fixture('`<br>`');
 try{editor.focus();editor.set_selection(1);editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentForward',bubbles:true,cancelable:true}));equal(editor.get_markdown({normalize:false}),'`br>`');}finally{editor.destroy();}
});
await test('Task labels stay beside checkboxes in tight, loose and nested lists without changing source', async () => {
 for(const source of ['- [x] 한글 라벨\n- [ ] 다음 라벨','- [x] **굵은 라벨**\n\n- [ ] 다음 라벨','- [x] 부모\n  - [ ] 자식'])for(const mode of ['rich','hybrid']) {
  const editor=await fixture(source,{mode});
  try {
   for(const reading of [false,true]) {
    editor.set_view(reading?'reading':'rich');
    for(const input of editor.surface.querySelectorAll('input[data-task]')) {
     const label=input.nextElementSibling;
     assert(label,'task label exists');
     const range=document.createRange();range.selectNodeContents(label.querySelector('[data-text]')||label);
     const rect=range.getClientRects()[0],box=input.getBoundingClientRect();assert(rect&&Math.abs((rect.top+rect.bottom-box.top-box.bottom)/2)<12,'checkbox and label share a line');
    }
    equal(editor.get_markdown({normalize:false}),source);
   }
  }finally{editor.destroy();}
 }
});
await test('Soft newlines have no BR mark and semantic block endings carry paragraph marks', async () => {
 for(const mode of ['rich','hybrid']) {
  const editor=await fixture('연결했습니다.\n가나다',{mode,show_paragraph_marks:true});
  try {
   editor.focus();editor.set_selection(byte_length('연결했습니다.'));
   equal(editor.get_markdown({normalize:false}),'연결했습니다.\n가나다');
   equal(editor.surface.querySelectorAll('p').length,1);const marker=[...editor.surface.querySelectorAll('[data-text]')].find(span=>span.textContent==='\n');assert(marker,'source newline retained');
   assert(!editor.surface.querySelector('.soft_break,.break_mark'),'no BR for soft newline');
   const start=byte_length('연결했습니다.');equal(editor.dom_to_source(marker.firstChild,0),start);equal(editor.dom_to_source(marker.firstChild,1),start+1);
   editor.set_options({show_paragraph_marks:false});equal(getComputedStyle(editor.surface.querySelector('[data-paragraph-end]'),'::after').content,'none');
   editor.set_selection(start);editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentForward',bubbles:true,cancelable:true}));equal(editor.get_markdown({normalize:false}),'연결했습니다.가나다');
  }finally{editor.destroy();}
 }
 const editor=await fixture('```\na\nb\n```',{show_paragraph_marks:true});try{assert(!editor.surface.querySelector('.soft_break'),'code newlines are not paragraph soft breaks');}finally{editor.destroy();}
});
await test('Rich and hybrid leading spaces become nbsp entities with atomic deletion and unchanged middle/code spaces', async () => {
 const type=(editor,data)=>editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertText',data,bubbles:true,cancelable:true}));
 for(const mode of ['rich','hybrid']) {
  const editor=await fixture('한글',{mode});
  try {
   editor.focus();editor.set_selection(0);type(editor,' ');type(editor,' ');equal(editor.get_markdown({normalize:false}),'&nbsp;&nbsp;한글');equal(editor.get_selection().focus,12);
   editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));equal(editor.get_markdown({normalize:false}),'&nbsp;한글');
   editor.set_selection(0);editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentForward',bubbles:true,cancelable:true}));equal(editor.get_markdown({normalize:false}),'한글');
   editor.set_selection(3);type(editor,' ');equal(editor.get_markdown({normalize:false}),'한 글');
   for(const separator of ['\n','<br>']){editor.set_markdown('앞'+separator+'뒤');editor.set_selection(byte_length('앞'+separator));type(editor,' ');equal(editor.get_markdown({normalize:false}),'앞'+separator+'&nbsp;뒤');}
   editor.set_markdown('```\ncode\n```');editor.set_selection(byte_length('```\n'));type(editor,' ');equal(editor.get_markdown({normalize:false}),'```\n code\n```');
  }finally{editor.destroy();}
 }
 const editor=await fixture('text',{mode:'markdown'});try{editor.focus();editor.set_selection(0);type(editor,' ');equal(editor.get_markdown({normalize:false}),' text');}finally{editor.destroy();}
});
await test('Enter at task label start splits sibling tasks, including a caret in the checkbox gap', async () => {
 for(const mode of ['rich','hybrid'])for(const gap of [false,true]) {
  const editor=await fixture('- [ ] 확인할 작업',{mode,elements:{list:{reveal_markdown:false}}});
  try {
   editor.focus();editor.set_selection(6);
   if(gap){const input=editor.surface.querySelector('input[data-task]');assert(input.nextSibling.nodeType===1);editor.dom_selection().collapse(input.parentNode,[...input.parentNode.childNodes].indexOf(input)+1);}
   editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true}));
   equal(editor.get_markdown({normalize:false}),'- [ ]\n- [ ] 확인할 작업');
   // Hybrid may reveal the active item's Markdown; the inactive empty item must remain a checkbox.
   assert(editor.state.html.match(/type="checkbox"/g).length===2,'both siblings render checkboxes');
   assert(!editor.state.html.includes('data-depth="1"'),'no accidental nested list');
   equal(editor.get_selection().focus,12);
   await editor.execute_command('undo');equal(editor.get_markdown({normalize:false}),'- [ ] 확인할 작업');
  }finally{editor.destroy();}
 }
});
await test('HTML block markers cover headings, paragraphs and list items without coordinate wrapper duplicates',async()=>{
 const editor=await fixture('# 제목\n\n본문<br>다음\n줄\n\n- 목록',{show_paragraph_marks:true});
 try {
  for(const selector of ['h1','p','li']){const block=editor.surface.querySelector(selector+'[data-paragraph-end]');assert(block,selector+' block end');assert(getComputedStyle(block,'::after').content.includes('↵'));}
  equal(editor.surface.querySelectorAll('.break_mark').length,1);assert(!editor.surface.querySelector('section[data-paragraph-end]'));
  assert(!editor.surface.querySelector('.soft_break'));equal(editor.surface.querySelectorAll('br[data-break]').length,1);
 }finally{editor.destroy();}
});
await test('Separator blanks have no marks and empty task markers sit after checkboxes without editable gaps',async()=>{
 const source='# 제목\n\n본문\n\n| A | B |\n| --- | --- |\n| a | b |\n\n- [ ]\n- [ ] 확인할 작업';
 const editor=await fixture(source,{show_paragraph_marks:true});
 try {
  equal(editor.surface.querySelectorAll('h1[data-paragraph-end],p[data-paragraph-end]').length,2);
  for(const p of editor.surface.querySelectorAll('p'))if(!p.textContent)assert(!p.hasAttribute('data-paragraph-end'),'no separator marks');
  const tasks=[...editor.surface.querySelectorAll('input[data-task]')];equal(tasks.length,2);
  for(const input of tasks){assert(input.nextSibling.nodeType===1,'no editable checkbox gap');const span=input.parentNode.querySelector('[data-text]');assert(span);const pos=+span.dataset.start;equal(editor.dom_to_source(input.parentNode,[...input.parentNode.childNodes].indexOf(input)+1),pos);}
  const item=tasks[0].parentElement;assert(item.querySelector('.empty_task_caret'));equal(getComputedStyle(item,'::after').position,'static');
  assert(item.querySelector('.empty_task_caret').getBoundingClientRect().left>=tasks[0].getBoundingClientRect().right,'mark anchor follows checkbox');
  equal(editor.get_markdown({normalize:false}),source);
  editor.focus();editor.set_selection(+item.querySelector('.empty_task_caret').dataset.start);
  editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertText',data:'새',bubbles:true,cancelable:true}));
  equal(editor.get_markdown({normalize:false}),source.replace('- [ ]\n','- [ ] 새\n'));
 }finally{editor.destroy();}
});
await test('Multiple blank source lines collapse to one paragraph separator while source and code stay intact',async()=>{
 for(const mode of ['rich','hybrid']) {
  const source='앞\n\n\n\n\n뒤',editor=await fixture(source,{mode});
  try {
   equal(editor.surface.querySelectorAll('[data-gap-start]').length,1);equal(editor.surface.querySelectorAll('p').length,2);
   const gap=getComputedStyle(editor.surface.querySelector('[data-gap-start]')).marginBlockStart;
   editor.set_markdown('앞\n\n뒤');equal(getComputedStyle(editor.surface.querySelector('[data-gap-start]')).marginBlockStart,gap);
   editor.set_markdown(source);equal(editor.get_markdown({normalize:false}),source);
   editor.focus();editor.set_selection(byte_length('앞\n\n\n'));equal(editor.get_selection().focus,byte_length('앞\n\n\n\n\n'));editor.replace('중간');equal(editor.get_markdown({normalize:false}),'앞\n\n\n\n\n중간뒤');
   editor.set_markdown('```\na\n\n\n\nb\n```');assert(!editor.surface.querySelector('[data-gap-start]'));assert(editor.surface.querySelector('code').textContent.includes('a\n\n\n\nb'));
  }finally{editor.destroy();}
 }
});
await test('Paragraph separators are noneditable spacing and visual caret skips to content',async()=>{
 for(const mode of ['rich','hybrid']) {
  const source='# 제목\n\n\n본문',editor=await fixture(source,{mode,elements:{heading:{reveal_markdown:false}}});
  try {
   const gap=editor.surface.querySelector('[data-gap-start]');assert(gap);assert(!editor.surface.querySelector('.paragraph_separator'),'no spacer DOM');
   editor.focus();editor.set_selection(+gap.dataset.gapStart);equal(editor.get_selection().focus,byte_length('# 제목\n\n\n'));assert(!editor.dom_selection().focusNode.parentElement.closest('.paragraph_separator'));
   const index=[...editor.surface.childNodes].indexOf(gap);editor.dom_selection().collapse(editor.surface,index);
   document.dispatchEvent(new Event('selectionchange'));assert(!editor.at_paragraph_gap(editor.dom_selection().focusNode,editor.dom_selection().focusOffset));
   editor.set_view('source');editor.set_selection(byte_length('# 제목\n\n'));equal(editor.get_selection().focus,byte_length('# 제목\n\n'));equal(editor.get_markdown({normalize:false}),source);
  }finally{editor.destroy();}
 }
});
await test('HTML view is a read-only renderer output after Source and preserves editing state',async()=>{
 const source='# 제목\n\n**본문**',editor=await fixture(source);
 try {
  const buttons=[...editor.root.querySelectorAll('[data-view]')].map(button=>button.textContent);equal(buttons.join(','),'원본,HTML,읽기');
  editor.set_selection(byte_length('# 제목\n\n**'),byte_length('# 제목\n\n**본문'));const before=editor.get_selection();
  editor.root.querySelector('[data-view="html"]').click();assert(editor.html_view&&editor.html_output.readOnly&&!editor.html_output.hidden);assert(editor.surface.hidden&&editor.source_input.hidden);
  equal(editor.html_output.value,'<h1>제목</h1>\n<p><strong>본문</strong></p>');assert(editor.html_output.value.includes('<h1'));assert(!editor.html_output.value.includes('data-paragraph-end'),'not decorated live DOM');
  await editor.execute_command('bold');equal(editor.get_markdown({normalize:false}),source);equal(editor.get_selection().anchor,before.anchor);equal(editor.get_selection().focus,before.focus);
  editor.root.querySelector('[data-view="html"]').click();assert(!editor.html_view&&!editor.surface.hidden);equal(editor.get_selection().focus,before.focus);
  editor.set_view('source');editor.set_view('html');assert(!editor.source_view&&editor.html_view);editor.set_view('reading');assert(editor.reading&&!editor.html_view);
  editor.set_view('html');editor.set_markdown('**updated**');equal(editor.html_output.value,'<p><strong>updated</strong></p>');
 }finally{editor.destroy();}
});
await test('Right/Left cross heading-paragraph boundaries and no gap DOM remains',async()=>{
 const source='# 함께 쓰는 문서\n\n==리치 화면==과 **원본 화면**을 같은 문서에 연결했습니다.';
 for(const mode of ['rich','hybrid']) {
  const editor=await fixture(source,{mode,elements:{heading:{reveal_markdown:false},highlight:{reveal_markdown:false}}});
  try {
   const heading=[...editor.surface.querySelectorAll('h1 [data-text]')].at(-1),paragraph=editor.surface.querySelector('p [data-text]');
   const end=+heading.dataset.end,start=+paragraph.dataset.start;editor.focus();editor.set_selection(end);
   editor.surface.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));equal(editor.get_selection().focus,start);
   editor.surface.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));equal(editor.get_selection().focus,end);
   assert(!editor.surface.querySelector('.paragraph_separator'));equal(editor.surface.children.length,2);
   editor.dom_selection().collapse(editor.surface,1);document.dispatchEvent(new Event('selectionchange'));
   assert(editor.dom_selection().focusNode!==editor.surface,'gap click snaps into content');equal(editor.get_markdown({normalize:false}),source);
  }finally{editor.destroy();}
 }
});
await test('Delete/Backspace join body paragraphs by deleting the entire blank separator',async()=>{
 const left='==리치 화면==과 **원본 화면**을 같은',right='문서에 연결했습니다.';
 const prefix='# 함께 쓰는 문서\n\n',suffix='\n\n| 항목 | 상태 |\n| --- | --- |\n| 공동 편집 | 준비 |\n\n- [ ] 확인할 작업';
 for(const mode of ['rich','hybrid'])for(const separator of ['\n\n','\n\n\n\n'])for(const backwards of [false,true]) {
  const source=prefix+left+separator+right+suffix,editor=await fixture(source,{mode,show_paragraph_marks:true});
  try {
   editor.focus();editor.set_selection(byte_length(prefix+left+(backwards?separator:'')));
   editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:backwards?'deleteContentBackward':'deleteContentForward',bubbles:true,cancelable:true}));
   equal(editor.get_markdown({normalize:false}),prefix+left+right+suffix);equal(editor.get_selection().focus,byte_length(prefix+left));
   await editor.execute_command('undo');equal(editor.get_markdown({normalize:false}),source);
  }finally{editor.destroy();}
 }
});
await test('Horizontal arrows cross an entire rendered BR, never stopping on its decoration',async()=>{
 for(const mode of ['rich','hybrid'])for(const marks of [false,true])for(const token of ['<br>','<br/>','<br />','  \n','\\\n']) {
  const source='앞'+token+'뒤',editor=await fixture(source,{mode,show_paragraph_marks:marks});
  try {
   const start=byte_length('앞'),end=byte_length('앞'+token);editor.focus();editor.set_selection(start);
   editor.surface.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));equal(editor.get_selection().focus,end);
   const br=editor.surface.querySelector('br[data-break]'),selection=editor.dom_selection();equal(editor.dom_to_source(selection.focusNode,selection.focusOffset),end);assert(!selection.focusNode.parentElement?.closest('.break_mark'));
   editor.surface.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));equal(editor.get_selection().focus,start);
   const marker=editor.surface.querySelector('.break_mark');equal(editor.dom_to_source(marker,0),start);equal(editor.get_markdown({normalize:false}),source);
  }finally{editor.destroy();}
 }
 const editor=await fixture('끝<br>',{show_paragraph_marks:true});try{editor.focus();editor.set_selection(byte_length('끝'));editor.surface.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));equal(editor.get_selection().focus,byte_length('끝<br>'));assert(editor.surface.querySelector('br[data-caret]'));}finally{editor.destroy();}
});
await test('Shift+Enter exits generated bold closers before inserting BR in rich and hybrid modes',async()=>{
 for(const mode of ['rich','hybrid']) {
  const editor=await fixture('',{mode,auto_close:{enabled:true}});
  try {
   editor.focus();for(const data of ['*','*','원','본'])editor.type_text(data);
   equal(editor.get_markdown({normalize:false}),'**원본**');equal(editor.get_selection().focus,byte_length('**원본'));
   await editor.execute_command('hard_break');equal(editor.get_markdown({normalize:false}),'**원본**<br>');equal(editor.get_selection().focus,byte_length('**원본**<br>'));
   editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertText',data:'다음',bubbles:true,cancelable:true}));equal(editor.get_markdown({normalize:false}),'**원본**<br>다음');
  }finally{editor.destroy();}
 }
 const editor=await fixture('**원본**',{auto_close:{enabled:true}});try{editor.focus();editor.set_selection(byte_length('**원본'));await editor.execute_command('hard_break');equal(editor.get_markdown({normalize:false}),'**원본<br>**');}finally{editor.destroy();}
});
await test('Breaks before rich inline formatting preserve opening delimiters',async()=>{
 for(const mode of ['rich','hybrid'])for(const hard of [false,true]) {
  const editor=await fixture('**굵게**',{mode});
  try {
   editor.focus();editor.set_selection(2);
   if(hard)await editor.execute_command('hard_break');else editor.enter();
   equal(editor.state.source,hard?'<br>\n**굵게**':'&nbsp;\n\n**굵게**');
   assert(editor.state.html.includes('<strong'),'bold was broken');
   if(hard){equal(editor.selection.focus,5);assert(!editor.state.html.includes('>\n</span>'),'BR newline became a second visual break');}
   await editor.execute_command('undo');equal(editor.state.source,'**굵게**');
  }finally{editor.destroy();}
 }
 const source=await fixture('**굵게**');try{source.set_view('source');source.set_selection(2);source.enter();equal(source.state.source,'**\n\n굵게**');}finally{source.destroy();}
});
await test('Enter at a rich paragraph end inserts a persistent editable paragraph before a list',async()=>{
 const text='**굵게**, *기울임*, ==하이라이트==를 확인하세요.';
 for(const mode of ['rich','hybrid'])for(const gap of ['\n\n','\n\n\n\n']) {
  const source=text+gap+'- [x] WASM으로 렌더링',editor=await fixture(source,{mode});
  try{editor.focus();editor.set_selection(byte_length(text));editor.enter();
   equal(editor.state.source,text+'\n\n&nbsp;\n\n- [x] WASM으로 렌더링');
   equal(editor.selection.focus,byte_length(text)+2);
   const [node]=editor.source_to_dom(editor.selection.focus);equal(node.textContent,'\u00a0');
   await editor.execute_command('undo');equal(editor.state.source,source);
   await editor.execute_command('redo');assert(editor.state.source.includes('\n\n&nbsp;\n\n'));
  }finally{editor.destroy();}
 }
 const last=await fixture(text);try{last.focus();last.set_selection(byte_length(text));last.enter();equal(last.state.source,text+'\n\n&nbsp;');}finally{last.destroy();}
 const raw=await fixture(text+'\n\n- 항목');try{raw.set_view('source');raw.set_selection(byte_length(text));raw.enter();equal(raw.state.source,text+'\n\n\n\n- 항목');}finally{raw.destroy();}
});
await test('Semantic inline boundaries preserve formatting across paragraph deletion and breaks',async()=>{
 const formats=[['**','**'],['__','__'],['*','*'],['~~','~~'],['==','=='],['[','](https://example.com)'],['`','`'],['***','***']];
 for(const mode of ['rich','hybrid'])for(const [open,close] of formats){
  const formatted=open+'한😀'+close,source='앞 문단\n\n'+formatted,editor=await fixture(source,{mode});
  try{
   editor.focus();editor.set_selection(byte_length('앞 문단\n\n'+open));
   editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));
   equal(editor.state.source,'앞 문단'+formatted);await editor.execute_command('undo');equal(editor.state.source,source);
   editor.set_selection(byte_length('앞 문단'));
   editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentForward',bubbles:true,cancelable:true}));equal(editor.state.source,'앞 문단'+formatted);
   editor.set_markdown(formatted);editor.focus();editor.set_selection(byte_length(open));
   editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));equal(editor.state.source,formatted);
   editor.enter();equal(editor.state.source,'&nbsp;\n\n'+formatted);await editor.execute_command('undo');editor.set_selection(byte_length(open));
   await editor.execute_command('hard_break');equal(editor.state.source,'<br>\n'+formatted);
   editor.set_markdown('앞 '+formatted);editor.focus();editor.set_selection(byte_length('앞 '+open));
   await editor.execute_command('hard_break');equal(editor.state.source,'앞 <br>'+formatted);
   editor.set_markdown('앞 '+formatted);editor.focus();editor.set_selection(byte_length('앞 '+open));editor.enter();equal(editor.state.source,'앞 \n\n'+formatted);
   editor.set_markdown('앞 '+formatted);editor.focus();editor.set_selection(byte_length('앞 '+open));
   editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));equal(editor.state.source,'앞'+formatted);
  }finally{editor.destroy();}
 }
});
await test('Heading end Enter creates a paragraph before the following text and preserves title formatting',async()=>{
 for(const mode of ['rich','hybrid'])for(const title of ['# 제목','## **한😀**','### ==제목=='])for(const gap of ['\n','\n\n','\n\n\n\n']){
  const editor=await fixture(title+gap+'기존 문단',{mode});
  try{editor.focus();editor.set_selection(byte_length(title));editor.enter();equal(editor.state.source,title+'\n\n&nbsp;\n\n기존 문단');equal(editor.selection.focus,byte_length(title)+2);
   const [node]=editor.source_to_dom(editor.selection.focus);equal(node.textContent,'\u00a0');
   await editor.execute_command('undo');equal(editor.state.source,title+gap+'기존 문단');
  }finally{editor.destroy();}
 }
});
await test('Visible deletion skips inline closers and removes empty constructs atomically',async()=>{
 for(const mode of ['rich','hybrid']){
  const editor=await fixture('**한글**끝',{mode});try{editor.focus();editor.set_selection(byte_length('**한글'));editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentForward',bubbles:true,cancelable:true}));equal(editor.state.source,'**한글**');
   editor.set_markdown('앞 ==😀== 뒤');editor.focus();editor.set_selection(byte_length('앞 ==😀'));editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));equal(editor.state.source,'앞  뒤');
  }finally{editor.destroy();}
 }
});
await test('Visible deletion retains Unicode graphemes and escaped-text atomicity',async()=>{
 for(const grapheme of ['한','é','👨‍👩‍👧‍👦','🇰🇷','👍🏽']){
  const editor=await fixture('a'+grapheme+'b');try{editor.focus();editor.set_selection(byte_length('a'+grapheme));editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));equal(editor.state.source,'ab');}finally{editor.destroy();}
 }
 const editor=await fixture('a\\*b');try{editor.focus();editor.set_selection(3);editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));equal(editor.state.source,'ab');}finally{editor.destroy();}
});
await test('HTML view removes editor wrappers, hides source-only blocks and formats semantic output safely',async()=>{
 const source='---\ntitle: hidden\n---\n\n# 제목\n\n**굵게**, *기울임*, ==강조==, ~~취소선~~\n\n- [x] 작업\n\n```text\n  <x>\n    한글\n```\n\n<!-- 숨김 -->',editor=await fixture(source);
 try{editor.focus();editor.set_selection(0);const before=editor.get_selection();editor.set_view('html');const html=editor.html_output.value;
  assert(!/data-(?:start|end|kind|block|text|task)|contenteditable|<section/u.test(html),html);
  assert(!html.includes('hidden')&&!html.includes('숨김'));assert(html.includes('<strong>굵게</strong>'));assert(!html.includes('<b>'));
  assert(html.includes('\n  <li'));assert(html.includes('disabled'));const parsed=document.createElement('template');parsed.innerHTML=html;equal(parsed.content.querySelector('pre code').textContent,'  <x>\n    한글\n');
  equal(editor.get_selection().focus,before.focus);equal(editor.get_markdown({normalize:false}),source);
  editor.set_view('html');assert(editor.surface.querySelector('[data-text]'),'editing coordinates were lost');
 }finally{editor.destroy();}
});
await test('Pure HTML view emits tables without scroll wrappers while editing retains scrolling',async()=>{
 const editor=await fixture('| A | B |\n| --- | --- |\n| x | y |');
 try{assert(editor.surface.querySelector('.table_scroll'));editor.set_view('html');assert(editor.html_output.value.startsWith('<table '));assert(!editor.html_output.value.includes('table_scroll'));assert(editor.html_output.value.includes('\n  <tr>'));
  editor.set_view('html');assert(editor.surface.querySelector('.table_scroll'));}
 finally{editor.destroy();}
});
document.querySelector('#summary').textContent = `${results.filter(Boolean).length}/${results.length} passed`;
document.body.dataset.passed = results.every(Boolean) ? 'true' : 'false';
const environment = document.createElement('p'); environment.textContent = navigator.userAgent; environment.id = 'environment'; document.querySelector('#summary').after(environment);
