import {create_editor} from '../editor.js';
import {create_replica,new_identity,byte_length,byte_to_utf16} from './core.js';
import {connect_local_pair} from './webrtc.js';
let passed=0,failed=0;
const assert=(value,message='Assertion failed')=>{if(!value)throw new Error(message);};
async function until(predicate){const end=performance.now()+10000;while(!predicate()){if(performance.now()>end)throw new Error('sync timeout');await new Promise(resolve=>setTimeout(resolve,20));}}
async function fixture(source){
 const document_id=new_identity(),a=await create_replica({document_id}),b=await create_replica({document_id});
 const left=document.createElement('div'),right=document.createElement('div');document.querySelector('#fixtures').append(left,right);
 const x=await create_editor(left,{replica:a,markdown:source,mode:'rich',auto_close:{enabled:false}});b.merge(a.export_state());
 const y=await create_editor(right,{replica:b,mode:'rich',auto_close:{enabled:false}});
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
 let editor;try{editor=await create_editor(host,{replica,config_url:new URL('../editor.config.json',import.meta.url),markdown:'configured',mode:'rich'});editor.set_selection(10);editor.replace('!');assert(replica.snapshot.markdown==='configured!');
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
document.querySelector('#summary').textContent=`${passed} passed / ${failed} failed`;
document.body.dataset.passed=failed?'false':'true';
