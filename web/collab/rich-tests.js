// Source-backed regression suite (hybrid/Markdown/source). Native rich contracts: /native-rich-tests.html.
import {create_editor} from '../editor.js';
import {create_replica,new_identity,byte_length,byte_to_utf16} from './core.js';
import {connect_local_pair} from './webrtc.js';
let passed=0,failed=0;
const assert=(value,message='Assertion failed')=>{if(!value)throw new Error(message);};
async function until(predicate){const end=performance.now()+10000;while(!predicate()){if(performance.now()>end)throw new Error('sync timeout');await new Promise(resolve=>setTimeout(resolve,20));}}
async function fixture(source){
 const document_id=new_identity(),a=await create_replica({document_id}),b=await create_replica({document_id});
 const left=document.createElement('div'),right=document.createElement('div');document.querySelector('#fixtures').append(left,right);
 const x=await create_editor(left,{replica:a,markdown:source,mode:'hybrid',elements:Object.fromEntries(['bold','italic','strikethrough','highlight','inline_code','link','heading','list','quote'].map(kind=>[kind,{reveal_markdown:false}])),auto_close:{enabled:false}});b.merge(a.export_state());
 const y=await create_editor(right,{replica:b,mode:'hybrid',elements:Object.fromEntries(['bold','italic','strikethrough','highlight','inline_code','link','heading','list','quote'].map(kind=>[kind,{reveal_markdown:false}])),auto_close:{enabled:false}});
 return {a,b,x,y,close(){x.destroy();y.destroy();a.destroy();b.destroy();left.remove();right.remove();}};
}
async function test(name,run){const item=document.createElement('li');document.querySelector('#results').append(item);try{await run();passed++;item.textContent=`PASS ${name}`;}catch(error){failed++;item.textContent=`FAIL ${name}: ${error.stack}`;console.error(error);}}
await test('Rich body formatting, remote source view, own undo and stable source selections',async()=>{
 const f=await fixture('한글😀 text');let connection;
 try{connection=await connect_local_pair(f.a,f.b);f.y.set_view('source');f.x.set_selection(0,6);await f.x.execute_command('highlight');
 await until(()=>f.y.state.source===f.x.state.source);assert(f.y.source_input.value===f.x.state.source);
 f.y.set_selection(byte_length(f.y.state.source));f.y.replace(' remote');await until(()=>f.x.state.source===f.y.state.source);
 await f.x.execute_command('undo');await until(()=>f.x.state.source===f.y.state.source);
 assert(f.x.state.source.includes('remote')&&!f.x.state.source.includes('=='));
 for(const mode of ['markdown','hybrid','rich'])f.x.set_options({mode});assert(f.x.state.source===f.y.state.source);
 }finally{connection?.close();f.close();}
});
await test('Stable shared tables: simultaneous cells, exact row/column commands and one-step undo',async()=>{
 const f=await fixture('| A | B |\n| --- | --- |\n| c | d |');let connection;
 try{const table=f.a.snapshot.tables[0],id=table.id;const cells=[...f.x.surface.querySelectorAll('[data-cell]')];
 f.x.set_selection(+cells[2].dataset.start,+cells[2].dataset.end);f.x.replace('==한글==');
 const other=[...f.y.surface.querySelectorAll('[data-cell]')][3];f.y.set_selection(+other.dataset.start,+other.dataset.end);f.y.replace('😀');
 connection=await connect_local_pair(f.a,f.b);await until(()=>f.x.state.source===f.y.state.source);
 assert(f.a.snapshot.tables[0].id===id&&f.b.snapshot.tables[0].id===id);
 const active=f.x.surface.querySelector('[data-cell][data-row="1"][data-column="0"]');f.x.set_selection(+active.dataset.start);f.x.table_action('column_after');
 await until(()=>f.b.snapshot.tables[0].columns.length===3);assert(f.a.snapshot.tables[0].columns[0]===table.columns[0]);
 await f.x.execute_command('undo');await until(()=>f.b.snapshot.tables[0].columns.length===2);
 assert(f.x.state.source.includes('😀')&&f.x.state.source.includes('==한글=='));
 }finally{connection?.close();f.close();}
});
await test('Full source textarea cell edits keep table identities and propagate to rich view',async()=>{
 const f=await fixture('| A | B |\n| --- | --- |\n| c | d |');let connection;
 try{connection=await connect_local_pair(f.a,f.b);const id=f.a.snapshot.tables[0].id;f.x.set_view('source');
 const source=f.x.state.source,index=source.indexOf('| c |')+2;f.x.source_input.value=source.slice(0,index)+'**변경**'+source.slice(index+1);f.x.source_input.setSelectionRange(index+6,index+6);
 f.x.source_input.dispatchEvent(new InputEvent('input',{inputType:'insertText',data:'**변경**',bubbles:true}));
 await until(()=>f.x.state.source===f.y.state.source);assert(f.a.snapshot.tables[0].id===id&&f.y.surface.querySelector('strong'));
 }finally{connection?.close();f.close();}
});
await test('Malformed table source stays local and a concurrent remote change cannot be overwritten by a draft',async()=>{
 const f=await fixture('| A | B |\n| --- | --- |\n| c | d |');
 try{const original=f.a.snapshot.markdown,offset=original.indexOf('---');f.x.replace('?',offset,offset+3);assert(f.x.state.draft&&f.a.snapshot.markdown===original);
 const scope=f.b.snapshot.tables[0],cell=scope.cells.find(cell=>cell.row===scope.rows[1]);f.b.replace_text(0,1,'remote',{table:scope.id,row:cell.row,column:cell.column});f.a.merge(f.b.export_state());
 assert(f.x.state.draft_conflict&&f.x.state.source.includes('| ? |'));
 f.x.core.discard_draft();f.x.state=f.x.core.snapshot;f.x.render();assert(f.x.state.source.includes('remote')&&!f.x.state.draft);
 }finally{f.close();}
});
await test('Rich IME intent survives a remote insertion without replacing native composition DOM',async()=>{
 const f=await fixture('abc');
 try{f.x.focus();f.x.set_selection(1,2);f.x.surface.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
 const composing=f.x.surface.innerHTML;f.b.replace_text(2,2,'😀');f.a.merge(f.b.export_state());assert(f.x.surface.innerHTML===composing);
 f.x.surface.dispatchEvent(new CompositionEvent('compositionend',{data:'한',bubbles:true}));f.b.merge(f.a.export_state());
 assert(f.x.state.source===f.b.snapshot.markdown&&f.x.state.source.includes('한')&&f.x.state.source.includes('😀'));
 }finally{f.close();}
});
await test('Source textarea IME intent survives remote text and cancellation creates no edit',async()=>{
 const f=await fixture('abc');
 try{f.x.set_view('source');f.x.source_input.focus();f.x.source_input.setSelectionRange(1,2);f.x.source_input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
 f.x.source_input.value='aㅎc';f.b.replace_text(2,2,'😀');f.a.merge(f.b.export_state());assert(f.x.source_input.value==='aㅎc');
 f.x.source_input.dispatchEvent(new CompositionEvent('compositionend',{data:'한',bubbles:true}));assert(f.x.state.source.includes('한')&&f.x.state.source.includes('😀'));
 await new Promise(resolve=>setTimeout(resolve,0));const before=f.a.snapshot.operation_count;
 f.x.source_input.setSelectionRange(1,2);f.x.source_input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
 f.x.source_input.dispatchEvent(new CompositionEvent('compositionend',{data:'',bubbles:true}));assert(f.a.snapshot.operation_count===before);
 }finally{f.close();}
});
await test('Shared command redo restores the caret relative to remote Unicode edits',async()=>{
 const f=await fixture('ab');try{
 f.x.set_selection(1);await f.x.execute_command('bold');const caret=f.x.selection.focus;assert(caret===3);
 await f.x.execute_command('undo');assert(f.x.selection.focus===1);
 f.b.replace_text(0,0,'한');f.a.merge(f.b.export_state());await f.x.execute_command('redo');
 assert(f.x.state.source==='한a****b'&&f.x.selection.focus===6);
 }finally{f.close();}
});
await test('Shared automatic-format undo and redo restore literal source and clear redo correctly',async()=>{
 const f=await fixture('==hi=');try{
 f.x.set_selection(5);f.x.focus();f.x.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertText',data:'=',bubbles:true,cancelable:true}));
 assert(f.x.auto_transform);await f.x.execute_command('undo');assert(f.x.state.source==='\\=\\=hi\\=\\=');
 await f.x.execute_command('redo');assert(f.x.state.source==='==hi=='&&!f.x.state.can_redo);
 }finally{f.close();}
});
await test('IME on table delimiters retains a local draft when remote changes arrive',async()=>{
 const f=await fixture('| A | B |\n| --- | --- |\n| c | d |');try{
 f.x.set_view('source');const position=f.x.state.source.indexOf('---');f.x.source_input.focus();f.x.source_input.setSelectionRange(position,position+3);
 f.x.source_input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
 const view=f.b.snapshot.tables[0];f.b.replace_text(0,1,'remote',{table:view.id,row:view.rows[0],column:view.columns[0]});f.a.merge(f.b.export_state());
 f.x.source_input.dispatchEvent(new CompositionEvent('compositionend',{data:'한',bubbles:true}));
 assert(f.x.state.draft_conflict&&f.x.state.source.includes('한')&&f.a.snapshot.markdown.includes('remote'));
 }finally{f.close();}
});
await test('Configured shared editor preserves replica identity and destroy leaves host-owned state alive',async()=>{
 const replica=await create_replica({document_id:new_identity()}),host=document.createElement('div');document.querySelector('#fixtures').append(host);
 let editor;try{editor=await create_editor(host,{replica,config_url:new URL('../editor.config.json',import.meta.url),markdown:'configured',mode:'hybrid'});editor.set_selection(10);editor.replace('!');assert(replica.snapshot.markdown==='configured!');
 let rejected=false;try{editor.set_options({replica});}catch{rejected=true;}assert(rejected);editor.destroy();editor=null;assert(replica.export_state().length>26);
 }finally{editor?.destroy();replica.destroy();host.remove();}
});
await test('Responsive toolbar targets and wide tables stay inside the document viewport',async()=>{
 const header='| A | B | C | D | E | F | G | H |',separator='| --- | --- | --- | --- | --- | --- | --- | --- |';
 const f=await fixture(header+'\n'+separator+'\n'+header);try{
 const width=document.documentElement.clientWidth,scroll=f.x.surface.querySelector('.table_scroll');assert(document.documentElement.scrollWidth<=width+1);
 assert(getComputedStyle(scroll).overflowX==='auto');if(width<=600)assert(scroll.scrollWidth>scroll.clientWidth);
 if(width<=950)assert([...f.x.toolbar.querySelectorAll('button')].every(button=>button.getBoundingClientRect().height>=44));
 }finally{f.close();}
});
await test('Source delimiter cursors follow a stable table after remote text insertion',async()=>{
 const f=await fixture('| A | B |\n| --- | --- |\n| c | d |');try{
 f.x.set_view('source');const position=f.x.state.source.indexOf('---');f.x.set_selection(position);f.b.replace_text(0,0,'한');f.a.merge(f.b.export_state());
 assert(f.x.selection.focus===byte_length(f.x.state.source.slice(0,f.x.state.source.indexOf('---'))));
 }finally{f.close();}
});
await test('A remotely deleted active row moves the caret outside the table instead of editing another cell',async()=>{
 const f=await fixture('| A | B |\n| --- | --- |\n| c | d |');try{
 const table=f.a.snapshot.tables[0],cell=f.x.surface.querySelector('[data-row="1"][data-column="0"]');f.x.set_selection(+cell.dataset.start);
 f.b.delete_row(table.id,table.rows[1]);f.a.merge(f.b.export_state());f.x.replace('new');
 assert(f.a.snapshot.text.startsWith('new')&&f.a.snapshot.tables[0].cells[0].text==='A');
 }finally{f.close();}
});
await test('Native cross-cell boundary selections replace the highlighted cell and keep its caret',async()=>{
 const f=await fixture('| A | B |\n| --- | --- |\n| c | d |');try{
 const cells=[...f.x.surface.querySelectorAll('[data-cell]')];f.x.set_selection(+cells[2].dataset.end,+cells[3].dataset.end);f.x.replace('new');
 const view=f.a.snapshot.tables[0],last=f.a.snapshot.projection[0].cells[3];assert(view.cells[2].text==='c'&&view.cells[3].text==='new'&&view.columns.length===2);
 assert(f.x.selection.focus===last.end);await f.x.execute_command('undo');assert(f.a.snapshot.tables[0].cells[3].text==='d');
 }finally{f.close();}
});

await test('Stable row/column moves sync through WebRTC and own undo preserves remote edits',async()=>{
 const f=await fixture('| A | B | C |\n| ---: | :---: | --- |\n| a | b | c |\n| d | e | f |\n| g | h | i |');let connection;
 try{connection=await connect_local_pair(f.a,f.b);f.y.set_view('source');const old=f.a.snapshot.tables[0];
 let cell=f.x.surface.querySelector('table').rows[1].cells[0];f.x.move_table_axis(cell,'row',1,1,4);
 await until(()=>f.y.state.source===f.x.state.source);assert(f.a.snapshot.tables[0].rows[3]===old.rows[1]);
 const scope={table:old.id,row:old.rows[1],column:old.columns[0]};f.b.replace_text(0,1,'원격😀',scope);await until(()=>f.x.state.source===f.y.state.source);
 await f.x.execute_command('undo');await until(()=>f.x.state.source===f.y.state.source);assert(f.a.snapshot.tables[0].rows.join()===old.rows.join());assert(f.x.state.source.includes('원격😀'));
 await f.x.execute_command('redo');cell=f.x.surface.querySelector('table').rows[0].cells[0];f.x.move_table_axis(cell,'column',0,0,3);
 await until(()=>f.x.state.source===f.y.state.source);assert(f.a.snapshot.tables[0].columns[2]===old.columns[0]);assert(f.a.snapshot.tables[0].alignments[2]==='right');
 assert(f.y.source_input.value===f.x.state.source);assert(!f.x.get_pending_draft());
 }finally{connection?.close();f.close();}
});
await test('Handle pointer drag, shift range selection, cancel and keyboard reorder share one undo',async()=>{
 const f=await fixture('| A | B |\n| --- | --- |\n| a | b |\n| c | d |\n| e | f |');try{
 let table=f.x.surface.querySelector('table');table.scrollIntoView();const old=f.a.snapshot.tables[0];
 const handle=table.querySelector('[data-row-handle="1"]'),target=table.rows[3].cells[0],rect=target.getBoundingClientRect();
 handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,composed:true,button:0,clientX:1,clientY:1}));
 target.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,composed:true,clientX:rect.left+rect.width/2,clientY:rect.bottom-2}));
 target.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,composed:true,clientX:rect.left+rect.width/2,clientY:rect.bottom-2}));
 assert(f.a.snapshot.tables[0].rows[3]===old.rows[1],'pointer reorder');await f.x.execute_command('undo');
 table=f.x.surface.querySelector('table');const first=table.rows[1].cells[0],last=table.rows[2].cells[0];
 first.querySelector('[data-row-handle]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,shiftKey:true}));
 last.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,shiftKey:true}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
 assert(f.x.surface.querySelectorAll('[data-selected]').length===4,'shift range');assert(f.a.snapshot.tables[0].rows.join()===old.rows.join());
 table=f.x.surface.querySelector('table');table.querySelector('[data-column-handle="0"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',altKey:true,bubbles:true}));
 assert(f.a.snapshot.tables[0].columns[1]===old.columns[0],'keyboard move');await f.x.execute_command('undo');
 table=f.x.surface.querySelector('table');table.querySelector('[data-row-handle="1"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));document.dispatchEvent(new PointerEvent('pointercancel'));
 assert(!f.x.dragging&&!f.x.handle_drag);
 table=f.x.surface.querySelector('table');table.scrollIntoView();const edge=table.rows[3].cells[0],bounds=edge.getBoundingClientRect();
 table.querySelector('[data-row-handle="1"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:1,clientY:1}));
 edge.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:bounds.left+bounds.width/2,clientY:bounds.bottom-2}));
 document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:-20,clientY:-20}));assert(f.a.snapshot.tables[0].rows.join()===old.rows.join(),'outside drop must cancel');
 const source=f.x.state.source;f.x.set_options({read_only:true});f.x.move_table_axis(f.x.surface.querySelector('table').rows[1].cells[0],'row',1,1,4);assert(f.x.state.source===source);
 }finally{f.close();}
});
await test('Multiple-table raw source edits, mode transitions and undo retain stable IDs and escapes',async()=>{
 const f=await fixture('앞😀\n\n| A | B |\n| --- | --- |\n| a\\|b | c |\n\n사이\n\n| X | Y |\n| --- | --- |\n| d | e |\n\n뒤');try{
 const old=f.a.snapshot.tables,source=f.x.state.source;f.x.set_view('source');
 const start=byte_length(source.slice(0,source.indexOf('a\\|b'))),end=byte_length(source.slice(0,source.lastIndexOf(' e ')+2));
 const chunk=new TextDecoder().decode(new TextEncoder().encode(source).slice(start,end)).replace('a\\|b','새\\|값').replace('사이','중간😀').replace(' e',' 바꿈');
 f.x.set_selection(start,end);f.x.replace(chunk);assert(!f.x.get_pending_draft(),'valid raw edit became draft');f.b.merge(f.a.export_state());
 assert(f.a.snapshot.tables.map(t=>t.id).join()===old.map(t=>t.id).join());assert(f.a.snapshot.tables[0].cells[2].text==='새\\|값');
 for(const mode of ['hybrid','markdown','rich']){f.x.set_options({mode});f.x.set_view('source');f.x.set_view('source');assert(f.x.state.source.includes('중간😀'));}
 await f.x.execute_command('undo');assert(f.x.state.source===source,'one raw edit undo');await f.x.execute_command('redo');assert(f.x.state.source.includes('새\\|값'));
 }finally{f.close();}
});
await test('Standalone table range moves preserve alignment, header and undo/redo',async()=>{
 const container=document.createElement('div');document.querySelector('#fixtures').append(container);const editor=await create_editor(container,{mode:'hybrid',markdown:'| A | B |\n| ---: | :---: |\n| a | b |\n| c | d |\n| e | f |'});try{
 const source=editor.state.source;let table=editor.surface.querySelector('table');editor.move_table_axis(table.rows[1].cells[0],'row',1,2,4);assert(editor.state.source.indexOf('| e | f |')<editor.state.source.indexOf('| a | b |'));
 await editor.execute_command('undo');assert(editor.state.source===source);await editor.execute_command('redo');
 table=editor.surface.querySelector('table');editor.move_table_axis(table.rows[0].cells[0],'column',0,0,2);assert(editor.surface.querySelector('table').rows[0].cells[1].classList.contains('align_right'));
 const before=editor.state.source;editor.move_table_axis(editor.surface.querySelector('table').rows[0].cells[0],'row',0,0,3);assert(editor.state.source===before);
 }finally{editor.destroy();container.remove();}
});
await test('Remote table change cancels a pending handle drag without applying stale indices',async()=>{
 const f=await fixture('| A | B |\n| --- | --- |\n| a | b |\n| c | d |');try{
 const table=f.x.surface.querySelector('table'),view=f.b.snapshot.tables[0];table.querySelector('[data-row-handle="1"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));
 f.b.delete_row(view.id,view.rows[1]);f.a.merge(f.b.export_state());assert(!f.x.dragging&&!f.x.handle_drag);assert(f.a.snapshot.tables[0].rows.length===2);
 document.dispatchEvent(new PointerEvent('pointerup'));assert(f.a.snapshot.tables[0].rows.length===2);
 }finally{f.close();}
});

await test('Nested GFM containers keep shared caret anchors, formatting and source undo',async()=>{
 const source='> - 한😀\n>   - **세계**\n\n- parent\n  - child';const f=await fixture(source);let connection;
 try{connection=await connect_local_pair(f.a,f.b);f.y.set_view('source');const start=byte_length(source.slice(0,source.indexOf('세계')));f.x.set_selection(start,start+byte_length('세계'));
 f.y.set_selection(0);f.y.replace('앞😀\n\n');await until(()=>f.x.state.source===f.y.state.source);assert(f.x.selection.anchor===start+byte_length('앞😀\n\n'));
 await f.x.execute_command('italic');await until(()=>f.x.state.source===f.y.state.source);assert(f.x.surface.querySelector('blockquote ul ul'));
 await f.x.execute_command('undo');await until(()=>f.x.state.source===f.y.state.source);assert(f.x.state.source==='앞😀\n\n'+source);assert(f.y.source_input.value===f.x.state.source);
 }finally{connection?.close();f.close();}
});
await test('GFM tab code, multiline heading and fallback link survive shared source edits',async()=>{
 const source='>\t\t한😀\n\n첫째\n둘째\n---\n\n[링크](not a link)\n\n[링크]: /target';const f=await fixture(source);let connection;
 try{connection=await connect_local_pair(f.a,f.b);f.y.set_view('source');assert(f.x.surface.querySelector('blockquote code').textContent==='  한😀\n');
 assert(f.x.surface.querySelector('h2').textContent==='첫째\n둘째');assert(f.x.surface.querySelector('a[href="/target"]'));
 const at=byte_length(source.slice(0,source.indexOf('한')));f.x.set_selection(at,at+byte_length('한😀'));f.x.replace('수정😀');await until(()=>f.y.state.source===f.x.state.source);
 assert(f.y.source_input.value.includes('수정😀'));await f.x.execute_command('undo');await until(()=>f.y.state.source===source);assert(f.x.state.source===source);
 }finally{connection?.close();f.close();}
});
await test('Grouped shared typing undoes one burst and preserves remote text',async()=>{
 const f=await fixture('');let connection;
 try{connection=await connect_local_pair(f.a,f.b);f.x.set_options({auto_close:{enabled:false},mode:'hybrid'});f.x.focus();
 for(const data of ['한','😀','끝'])f.x.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertText',data,bubbles:true,cancelable:true}));
 await until(()=>f.y.state.source===f.x.state.source);f.y.set_selection(0);f.y.replace('원격');await until(()=>f.x.state.source===f.y.state.source);
 await f.x.execute_command('undo');await until(()=>f.x.state.source===f.y.state.source);assert(f.x.state.source==='원격');
 await f.x.execute_command('redo');await until(()=>f.x.state.source===f.y.state.source);assert(f.x.state.source==='원격한😀끝');
 }finally{connection?.close();f.close();}
});
await test('Shared trailing line-break caret, paragraph count and atomic Delete converge',async()=>{
 const f=await fixture('확인하세요.\n\n- [x] WASM으로 렌더링');let connection;
 try {
  connection=await connect_local_pair(f.a,f.b);f.x.set_options({show_paragraph_marks:true});f.x.focus();f.x.set_selection(byte_length('확인하세요.'));await f.x.execute_command('hard_break');
  await until(()=>f.y.state.source===f.x.state.source);
  assert(f.x.surface.querySelectorAll('p').length===1&&f.y.surface.querySelectorAll('p').length===1);
  const br=f.x.surface.querySelector('br[data-break]'),selection=f.x.dom_selection();assert(selection.focusNode===br.parentNode&&selection.focusOffset===[...br.parentNode.childNodes].indexOf(br)+1);
  f.x.set_options({mode:'hybrid'});f.x.set_selection(byte_length('확인하세요.'));f.x.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentForward',bubbles:true,cancelable:true}));
  await until(()=>f.y.state.source===f.x.state.source);assert(f.x.state.source==='확인하세요.\n\n- [x] WASM으로 렌더링');
  await f.x.execute_command('undo');await until(()=>f.y.state.source===f.x.state.source);assert(f.x.state.source.includes('<br>'));
 }finally{connection?.close();f.close();}
});
await test('Shared task labels stay on the checkbox line and toggles synchronize',async()=>{
 const f=await fixture('- [ ] 한글 라벨\n- [x] 다음 라벨');let connection;
 try {
  connection=await connect_local_pair(f.a,f.b);
  for(const editor of [f.x,f.y])for(const input of editor.surface.querySelectorAll('input[data-task]')) {
   const label=input.nextElementSibling.querySelector('[data-text]')||input.nextElementSibling;
   const range=document.createRange();range.selectNodeContents(label);const r=range.getClientRects()[0],b=input.getBoundingClientRect();assert(Math.abs((r.top+r.bottom-b.top-b.bottom)/2)<12,'shared label wraps after checkbox');
  }
  const checkbox=f.x.surface.querySelector('input[data-task]');checkbox.click();
  await until(()=>f.y.state.source===f.x.state.source);assert(f.y.state.source.startsWith('- [x] 한글 라벨'));
 }finally{connection?.close();f.close();}
});
await test('Shared paragraph separator deletion follows HTML block boundaries on both peers',async()=>{
 const f=await fixture('연결했습니다.\n\n가나다');let connection;
 try {
  connection=await connect_local_pair(f.a,f.b);for(const editor of [f.x,f.y])editor.set_options({show_paragraph_marks:true});
  f.x.focus();f.x.set_selection(byte_length('연결했습니다.'));f.x.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentForward',bubbles:true,cancelable:true}));
  await until(()=>f.y.state.source===f.x.state.source);assert(f.x.state.source==='연결했습니다.가나다');
  for(const editor of [f.x,f.y]){assert(!editor.surface.querySelector('.soft_break,.break_mark'));assert(editor.surface.querySelectorAll('p[data-paragraph-end]').length===1);}
  await f.x.execute_command('undo');await until(()=>f.y.state.source===f.x.state.source);for(const editor of [f.x,f.y])assert(!editor.surface.querySelector('.soft_break'));
 }finally{connection?.close();f.close();}
});
await test('Shared leading spaces preserve nbsp entities through sync, deletion and undo',async()=>{
 const f=await fixture('한글');let connection;
 try {
  connection=await connect_local_pair(f.a,f.b);f.x.focus();f.x.set_selection(0);
  for(let i=0;i<2;i++)f.x.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertText',data:' ',bubbles:true,cancelable:true}));
  await until(()=>f.y.state.source===f.x.state.source);assert(f.y.state.source==='&nbsp;&nbsp;한글');
  f.x.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));await until(()=>f.y.state.source===f.x.state.source);assert(f.y.state.source==='&nbsp;한글');
  await f.x.execute_command('undo');await until(()=>f.y.state.source===f.x.state.source);assert(f.y.state.source==='&nbsp;&nbsp;한글');
 }finally{connection?.close();f.close();}
});
await test('Shared task-label Enter creates empty sibling and preserves label through undo',async()=>{
 const prefix='# 문서\n\n| A | B |\n| --- | --- |\n| a | b |\n\n';
 const f=await fixture(prefix+'- [ ] 확인할 작업');let connection;
 try {
  connection=await connect_local_pair(f.a,f.b);f.x.focus();f.x.set_selection(byte_length(prefix)+6);
  const input=f.x.surface.querySelector('input[data-task]');f.x.dom_selection().collapse(input.parentNode,[...input.parentNode.childNodes].indexOf(input)+1);
  f.x.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true}));
  await until(()=>f.y.state.source===f.x.state.source);assert(f.x.state.source===prefix+'- [ ]\n- [ ] 확인할 작업','shared split source');
  for(const editor of [f.x,f.y]){assert(editor.surface.querySelectorAll('input[data-task]').length===2);assert(!editor.state.html.includes('data-depth="1"'));}
  await f.x.execute_command('undo');await until(()=>f.y.state.source===f.x.state.source);assert(f.x.state.source===prefix+'- [ ] 확인할 작업');
 }finally{connection?.close();f.close();}
});
await test('Shared repeated blank lines render as one separator and preserve synchronized source',async()=>{
 const source='앞\n\n\n\n뒤',f=await fixture(source);let connection;
 try {
  connection=await connect_local_pair(f.a,f.b);
  for(const editor of [f.x,f.y]){assert(editor.surface.querySelectorAll('[data-gap-start]').length===1);assert(editor.state.source===source);}
  f.x.focus();f.x.set_selection(byte_length('앞\n\n'));f.x.replace('중간');await until(()=>f.y.state.source===f.x.state.source);assert(f.y.state.source==='앞\n\n\n\n중간뒤');
  await f.x.execute_command('undo');await until(()=>f.y.state.source===f.x.state.source);for(const editor of [f.x,f.y])assert(editor.surface.querySelectorAll('[data-gap-start]').length===1);
 }finally{connection?.close();f.close();}
});
await test('Read-only HTML view updates on remote changes without editing the document',async()=>{
 const f=await fixture('# Shared');let connection;
 try {
  connection=await connect_local_pair(f.a,f.b);f.x.set_view('html');assert(f.x.html_output.readOnly);
  f.y.set_selection(byte_length(f.y.state.source));f.y.replace(' remote');await until(()=>f.x.state.source===f.y.state.source);
  assert(f.x.html_view&&!f.x.html_output.hidden);assert(f.x.html_output.value==='<h1>Shared remote</h1>');assert(!f.x.html_output.value.includes('data-start'));
  const source=f.x.state.source;await f.x.execute_command('paragraph');assert(f.x.state.source===source);
  f.x.set_view('html');assert(!f.x.html_view&&!f.x.surface.hidden);
 }finally{connection?.close();f.close();}
});
await test('Shared Delete joins complete paragraph boundary and undo restores both peers',async()=>{
 const prefix='# 제목\n\n',left='==리치 화면==과 **원본 화면**을 같은',right='문서에 연결했습니다.',suffix='\n\n- [ ] 확인할 작업';
 const source=prefix+left+'\n\n'+right+suffix,f=await fixture(source);let connection;
 try {
  connection=await connect_local_pair(f.a,f.b);f.x.focus();f.x.set_selection(byte_length(prefix+left));
  f.x.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentForward',bubbles:true,cancelable:true}));
  await until(()=>f.y.state.source===f.x.state.source);assert(f.x.state.source===prefix+left+right+suffix);assert(!f.x.state.source.includes('같은\n'));
  await f.x.execute_command('undo');await until(()=>f.y.state.source===f.x.state.source);assert(f.x.state.source===source);
 }finally{connection?.close();f.close();}
});
await test('Shared BR arrow skips the marker and typing starts on the next line',async()=>{
 const f=await fixture('앞<br>뒤');let connection;
 try {
  connection=await connect_local_pair(f.a,f.b);f.x.set_options({show_paragraph_marks:true});f.x.focus();f.x.set_selection(byte_length('앞'));
  f.x.surface.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert(f.x.get_selection().focus===byte_length('앞<br>'));
  f.x.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertText',data:'새',bubbles:true,cancelable:true}));await until(()=>f.y.state.source===f.x.state.source);assert(f.x.state.source==='앞<br>새뒤');
 }finally{connection?.close();f.close();}
});
await test('Generated bold closer is kept before shared Shift+Enter BR',async()=>{
 const f=await fixture('');let connection;
 try {
  connection=await connect_local_pair(f.a,f.b);f.x.set_options({auto_close:{enabled:true}});f.x.focus();
  for(const data of ['*','*','원','본'])f.x.type_text(data);
  await f.x.execute_command('hard_break');await until(()=>f.y.state.source===f.x.state.source);assert(f.x.state.source==='**원본**<br>');
  await f.x.execute_command('undo');await until(()=>f.y.state.source===f.x.state.source);assert(f.x.state.source==='**원본**');
 }finally{connection?.close();f.close();}
});
await test('Shared breaks before formatted text keep delimiters intact',async()=>{
 for(const hard of [false,true]) {
  const f=await fixture('**굵게**');let connection;
  try{connection=await connect_local_pair(f.a,f.b);f.x.focus();f.x.set_selection(2);
   if(hard)await f.x.execute_command('hard_break');else f.x.enter();
   await until(()=>f.x.state.source===f.y.state.source);
   assert(f.x.state.source===(hard?'<br>\n**굵게**':'&nbsp;\n\n**굵게**'));
   await f.x.execute_command('undo');await until(()=>f.x.state.source===f.y.state.source);assert(f.x.state.source==='**굵게**');
  }finally{connection?.close();f.close();}
 }
});
await test('Shared Enter inserts an editable NBSP paragraph before a task list',async()=>{
 const text='**굵게**, *기울임*, ==하이라이트==를 확인하세요.',source=text+'\n\n- [x] WASM으로 렌더링';
 const f=await fixture(source);let connection;
 try{connection=await connect_local_pair(f.a,f.b);f.x.focus();f.x.set_selection(byte_length(text));f.x.enter();
  await until(()=>f.x.state.source===f.y.state.source);assert(f.x.state.source===text+'\n\n&nbsp;\n\n- [x] WASM으로 렌더링');
  assert(f.x.selection.focus===byte_length(text)+2);
  await f.x.execute_command('undo');await until(()=>f.x.state.source===f.y.state.source);assert(f.x.state.source===source);
 }finally{connection?.close();f.close();}
});
await test('Shared semantic boundaries preserve inline formats and insert paragraphs below headings',async()=>{
 for(const [open,close] of [['**','**'],['==','=='],['~~','~~'],['[','](https://example.com)']]){
  const source='앞 문단\n\n'+open+'한😀'+close,f=await fixture(source);let connection;
  try{connection=await connect_local_pair(f.a,f.b);f.x.set_options({mode:'hybrid'});f.x.focus();f.x.set_selection(byte_length('앞 문단\n\n'+open));
   f.x.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));await until(()=>f.x.state.source===f.y.state.source);assert(f.x.state.source==='앞 문단'+open+'한😀'+close);
   await f.x.execute_command('undo');await until(()=>f.x.state.source===f.y.state.source);assert(f.x.state.source===source);
  }finally{connection?.close();f.close();}
 }
 const f=await fixture('# 제목\n\n기존 문단');let connection;
 try{connection=await connect_local_pair(f.a,f.b);f.x.focus();f.x.set_selection(byte_length('# 제목'));f.x.enter();await until(()=>f.x.state.source===f.y.state.source);assert(f.x.state.source==='# 제목\n\n&nbsp;\n\n기존 문단');
 }finally{connection?.close();f.close();}
});
document.querySelector('#summary').textContent=`${passed} passed / ${failed} failed`;
document.body.dataset.passed=failed?'false':'true';
