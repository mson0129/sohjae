import {create_editor} from './editor.js';
import {byte_length} from './core.js';
import {create_replica,new_identity} from './collab/core.js';
let passed=0,failed=0;
const assert=(ok,message='assertion failed')=>{if(!ok)throw Error(message);};
const input=(e,inputType,data=null)=>e.surface.dispatchEvent(new InputEvent('beforeinput',{inputType,data,bubbles:true,cancelable:true}));
async function test(name,shared,source,run){const li=document.createElement('li');document.querySelector('#results').append(li);let e,replica;try{if(shared)replica=await create_replica({document_id:new_identity()});const host=document.createElement('div');document.querySelector('#fixtures').append(host);e=await create_editor(host,{markdown:source,mode:'hybrid',...(replica?{replica}:{})});e.focus();await run(e,replica);passed++;li.textContent='PASS '+name+' shared='+shared;}catch(error){failed++;li.className='fail';li.textContent='FAIL '+name+' shared='+shared+': '+error.stack;}finally{e?.destroy();replica?.destroy();}}
function caret(e,at){e.set_selection(at);e.refresh_syntax();}
function equal(e,expected){assert(e.state.source===expected,JSON.stringify(e.state.source)+' != '+JSON.stringify(expected));}
for(const shared of [false,true]){
 await test('Plain active paragraph uses literal spaces and Enter',shared,'본문',e=>{caret(e,0);input(e,'insertText',' ');equal(e,' 본문');input(e,'insertParagraph');equal(e,' \n본문');assert(!e.state.source.includes('&nbsp;'));});
 await test('Enter at EOF advances and subsequent text stays on new line',shared,'본문',e=>{caret(e,byte_length('본문'));input(e,'insertParagraph');input(e,'insertText','다음');equal(e,'본문\n다음');e.capture_selection();assert(e.selection.focus===byte_length(e.state.source));});
 await test('Double Enter is a paragraph separator without HTML sentinels',shared,'본문',e=>{caret(e,byte_length('본문'));input(e,'insertParagraph');input(e,'insertParagraph');input(e,'insertText','다음');equal(e,'본문\n\n다음');});
 await test('Shift Enter inserts Markdown hard break',shared,'본문',e=>{caret(e,byte_length('본문'));input(e,'insertLineBreak');input(e,'insertText','다음');equal(e,'본문  \n다음');});
 for(const [source,next] of [['- 항목','- '],['4. 항목','5. '],['2) 항목','3) '],['- [x] 작업','- [ ] ']])await test('List continuation '+source,shared,source,e=>{caret(e,byte_length(source));input(e,'insertParagraph');equal(e,source+'\n'+next);input(e,'insertParagraph');equal(e,source+'\n\n');input(e,'insertText','본문');equal(e,source+'\n\n본문');});
 await test('Quote continuation and empty quote termination',shared,'> 인용',e=>{caret(e,byte_length('> 인용'));input(e,'insertParagraph');equal(e,'> 인용\n> ');input(e,'insertParagraph');equal(e,'> 인용\n\n');});
 for(const source of ['**굵게**','==강조==','~~취소~~','`코드`'])await test('Deleting a delimiter keeps source editing stable '+source,shared,source,e=>{caret(e,byte_length(source));input(e,'deleteContentBackward');const expected=source.slice(0,-1);equal(e,expected);assert(e.editing_mode()==='markdown');input(e,'insertText','끝');equal(e,expected+'끝');assert(e.surface.querySelector('[data-revealed]'));});
 await test('Deleting all markup and typing again stays in place',shared,'**굵게**',e=>{caret(e,2);e.set_selection(0,byte_length(e.state.source));input(e,'deleteContentBackward');input(e,'insertText','새 문서');equal(e,'새 문서');});
 await test('Paste keeps literal Markdown, tabs and newlines',shared,'본문',async e=>{caret(e,0);const data=new DataTransfer();data.setData('text/plain','**원문**\t값\n다음');data.setData('text/html','<b>다른 값</b>');await e.paste({preventDefault(){},clipboardData:data});equal(e,'**원문**\t값\n다음본문');});
 await test('Word deletion does not delete one arbitrary glyph',shared,'one two',e=>{caret(e,7);input(e,'deleteWordBackward');equal(e,'one ');});
 await test('Tab and Shift Tab use literal list indentation',shared,'- 항목',e=>{caret(e,byte_length('- 항목'));e.surface.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));equal(e,'    - 항목');e.surface.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));equal(e,'- 항목');});
 await test('Undo preserves raw source edits',shared,'본문',async e=>{caret(e,byte_length('본문'));input(e,'insertParagraph');input(e,'insertText','다음');await e.execute_command('undo');assert(!e.state.source.includes('다음'));await e.execute_command('undo');equal(e,'본문');});
 await test('Rich-only configured syntax stays rendered',shared,'**굵게**',e=>{e.set_options({elements:{bold:{reveal_markdown:false}}});caret(e,2);assert(e.editing_mode()==='rich');assert(e.surface.querySelector('strong'));assert(!e.surface.querySelector('[data-revealed]'));});
}
for(const shared of [false,true]){
 await test('Fenced code does not continue list markers',shared,'```md\n- 코드\n```',e=>{caret(e,byte_length('```md\n- 코드'));input(e,'insertParagraph');equal(e,'```md\n- 코드\n\n```');});
 await test('IME composition remains in the revealed source block',shared,'==원문==',e=>{caret(e,byte_length('==원문'));e.surface.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.surface.dispatchEvent(new CompositionEvent('compositionend',{data:'한글',bubbles:true}));equal(e,'==원문한글==');assert(e.editing_mode()==='markdown');});
 await test('Selection replacement preserves exact source position',shared,'**원문** 뒤',e=>{caret(e,2);e.set_selection(0,2);input(e,'insertReplacementText','앞');equal(e,'앞원문** 뒤');assert(e.selection.focus===byte_length('앞'));assert(e.editing_mode()==='markdown');input(e,'deleteContentBackward');equal(e,'원문** 뒤');});
}
for(const shared of [false,true]){
 await test('Session temporary save restores exact Markdown and supports undo',shared,'임시😀\n\n**문서**',async e=>{const key='sohjae-test:'+crypto.randomUUID();try{e.set_options({session_storage:{key}});assert(!e.load_session());const original=e.state.source,record=e.save_session();assert(record.version===1&&record.markdown===original);assert(!localStorage.getItem(key),'temporary data leaked to localStorage');e.set_markdown('다른 문서');assert(e.load_session());equal(e,original);await e.execute_command('undo');equal(e,'다른 문서');e.clear_session();assert(!sessionStorage.getItem(key));equal(e,'다른 문서');}finally{sessionStorage.removeItem(key);}});
 await test('Session autosave follows editing and undo without marking file saved',shared,'본문',async e=>{const key='sohjae-test:'+crypto.randomUUID();try{e.set_options({session_storage:{key,auto_save:true}});caret(e,byte_length('본문'));input(e,'insertText','추가');assert(JSON.parse(sessionStorage.getItem(key)).markdown===e.state.source);assert(e.state.dirty);await e.execute_command('undo');assert(JSON.parse(sessionStorage.getItem(key)).markdown===e.state.source);}finally{sessionStorage.removeItem(key);}});
 await test('Malformed session values do not replace the current document',shared,'유지',e=>{const key='sohjae-test:'+crypto.randomUUID();try{e.set_options({session_storage:{key}});for(const value of ['invalid','{"version":2,"markdown":"bad"}','{"version":1,"markdown":3}']){sessionStorage.setItem(key,value);let threw=false;try{e.load_session();}catch{threw=true;}assert(threw);equal(e,'유지');}e.set_options({read_only:true});let threw=false;try{e.load_session();}catch{threw=true;}assert(threw);}finally{sessionStorage.removeItem(key);}});
 await test('Session quota errors keep edits and report a recoverable failure',shared,'본문',e=>{const key='sohjae-test:'+crypto.randomUUID(),original=Storage.prototype.setItem;try{e.set_options({session_storage:{key,auto_save:true}});let reported=false;e.addEventListener('error',()=>reported=true);Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Quota exceeded','QuotaExceededError');return original.call(this,k,v);};caret(e,byte_length('본문'));input(e,'insertText','추가');equal(e,'본문추가');assert(reported);}finally{Storage.prototype.setItem=original;sessionStorage.removeItem(key);}});
}
await test('Session draft survives editor destruction but is restored only on request',false,'초안',async e=>{const key='sohjae-test:'+crypto.randomUUID();let other;try{e.set_options({session_storage:{key}});e.save_session();e.destroy();const host=document.createElement('div');document.querySelector('#fixtures').append(host);other=await create_editor(host,{markdown:'기본값',session_storage:{key}});assert(other.get_markdown({normalize:false})==='기본값');assert(other.load_session());assert(other.get_markdown({normalize:false})==='초안');}finally{other?.destroy();sessionStorage.removeItem(key);}});
for(const shared of [false,true]){
 for(const mode of ['rich','hybrid','markdown'])await test('Rendering cannot change source, logical selection or history in '+mode,shared,'**한글😀** &nbsp; 끝\n\n둘째 문단',e=>{
  e.set_options({mode});const source=e.state.source,positions=[0,2,byte_length('**한글😀'),byte_length('**한글😀**'),byte_length(source)];
  for(const at of positions){e.set_selection(at);e.focus();const before={source:e.state.source,selection:{...e.selection},undo:e.state.can_undo,redo:e.state.can_redo};for(let n=0;n<3;n++){e.render();e.refresh_syntax();e.restore_selection();}assert(e.state.source===before.source);assert(JSON.stringify(e.selection)===JSON.stringify(before.selection),'display changed source selection');assert(e.state.can_undo===before.undo&&e.state.can_redo===before.redo);e.capture_selection();assert(JSON.stringify(e.selection)===JSON.stringify(before.selection),'capture of restored projection changed source selection');}
  e.set_selection(byte_length(source),2);e.render();e.capture_selection();assert(e.selection.anchor===byte_length(source)&&e.selection.focus===2,'backward selection direction lost');
 });
 await test('UTF-8 source map round-trips every code point in raw mode',shared,'**한글😀 é** &nbsp; 끝\n\n둘째 문단',e=>{
  e.set_options({mode:'markdown'});const source=e.state.source;let position=0;
  for(const ch of [...source,'']){const [node,offset]=e.source_map.source_to_dom(position);assert(e.source_map.dom_to_source(node,offset)===position,'round-trip failed at '+position);position+=byte_length(ch);}
 });
 await test('Rich Backspace removes a visible character while raw Backspace removes a delimiter',shared,'**굵은 글자**로 쓸 수 있음',e=>{
  const at=byte_length('**굵은 글자**');e.set_options({mode:'rich'});caret(e,at);input(e,'deleteContentBackward');equal(e,'**굵은 글**로 쓸 수 있음');
  e.set_markdown('**굵은 글자**로 쓸 수 있음');e.set_options({mode:'markdown'});caret(e,at);input(e,'deleteContentBackward');equal(e,'**굵은 글자*로 쓸 수 있음');
 });
}
await test('Shared source preflight is read-only and incomplete edits publish no operations',true,'| A | B |\n| --- | --- |\n| a | b |',async(e,replica)=>{
 e.set_options({mode:'markdown'});const source=e.state.source,count=replica.snapshot.operation_count,at=source.indexOf('a | b');const offset=byte_length(source.slice(0,at));const log=replica.export_state();let updates=0;replica.addEventListener('update',()=>updates++);
 const proposed=replica.preview_replace_markdown(offset,offset,'X');assert(proposed.includes('Xa'));assert(replica.snapshot.operation_count===count);assert(updates===0);assert([...replica.export_state()].join(',')===[...log].join(','),'preview changed shared history');
 const end=+e.editing_markup().querySelector('[data-kind="table"]').dataset.end;caret(e,end);input(e,'insertParagraph');assert(e.state.draft);assert(replica.snapshot.operation_count===count,'unfinished newline was published');const pending=e.state.source,caretAfter=e.selection.focus;
 await e.execute_command('undo');assert(e.state.source===source);await e.execute_command('redo');assert(e.state.source===pending);assert(e.selection.focus===caretAfter);assert(replica.snapshot.operation_count===count,'draft undo/redo changed shared state');
 input(e,'insertText','|');input(e,'insertText',' ');assert(!e.state.draft);assert(e.state.source===replica.snapshot.markdown);assert(!/^\|[ \t]*$/mu.test(replica.snapshot.markdown));
});
await test('Remote edits preserve a local draft and mark its conflict without overwriting it',true,'| A | B |\n| --- | --- |\n| a | b |',async(e,replica)=>{
 e.set_options({mode:'markdown'});caret(e,+e.editing_markup().querySelector('[data-kind="table"]').dataset.end);input(e,'insertParagraph');const source=e.state.source,selection={...e.selection};const peer=await create_replica({document_id:replica.snapshot.document_id});try{peer.merge(replica.export_state());peer.replace_markdown(0,0,'원격😀\n\n');replica.merge(peer.export_state());assert(e.state.source===source,'remote normalization overwrote raw draft');assert(e.state.draft_conflict);assert(JSON.stringify(e.selection)===JSON.stringify(selection));}finally{peer.destroy();}
});
await test('Explicit draft normalization publishes once and remains undoable',true,'| A | B |\n| --- | --- |\n| a | b |',async(e,replica)=>{
 e.set_options({mode:'markdown'});const source=e.state.source;caret(e,byte_length(source));input(e,'insertParagraph');assert(e.state.draft);const count=replica.snapshot.operation_count;assert(e.commit_pending_draft());assert(!e.state.draft);assert(e.state.source===replica.snapshot.markdown);assert(replica.snapshot.operation_count===count,'normalization-only commit created operations');assert(!e.commit_pending_draft());
});
await test('Conflicting drafts reject explicit publication without losing text',true,'| A | B |\n| --- | --- |\n| a | b |',async(e,replica)=>{
 e.set_options({mode:'markdown'});caret(e,byte_length(e.state.source));input(e,'insertParagraph');const source=e.state.source;const peer=await create_replica({document_id:replica.snapshot.document_id});try{peer.merge(replica.export_state());peer.replace_markdown(0,0,'remote\n\n');replica.merge(peer.export_state());const count=replica.snapshot.operation_count;let rejected=false;try{e.commit_pending_draft();}catch{rejected=true;}assert(rejected);assert(e.state.source===source);assert(replica.snapshot.operation_count===count);}finally{peer.destroy();}
});
for(const shared of [false,true])for(const mode of ['rich','hybrid','markdown'])await test('Home/End stay on the current visual line '+mode,shared,'첫 문단\n\n둘째 문단',e=>{
 e.set_options({mode});caret(e,byte_length('첫'));const source=e.state.source;
 const key=(key,shiftKey=false)=>e.surface.dispatchEvent(new KeyboardEvent('keydown',{key,shiftKey,bubbles:true,cancelable:true}));
 key('End');assert(e.selection.focus===byte_length('첫 문단'),'End moved past the current line');
 key('Home',true);assert(e.selection.anchor===byte_length('첫 문단')&&e.selection.focus===0,'Shift+Home lost selection direction');
 key('End');assert(e.selection.focus===byte_length('첫 문단'));assert(e.state.source===source);
});
for(const shared of [false,true]){
 for(const mode of ['rich','markdown'])for(const [at,type,expected] of (mode==='rich'?[[10,'deleteContentBackward','ma**rkd**wn'],[2,'deleteContentForward','ma**kdo**wn']]:[[10,'deleteContentBackward','ma**rkdo*wn'],[2,'deleteContentForward','ma*rkdo**wn']]))await test('Inline boundary deletion '+mode+' '+type,shared,'ma**rkdo**wn',e=>{e.set_options({mode});caret(e,at);input(e,type);equal(e,expected);});
 await test('Rich checkbox Backspace removes the marker atomically',shared,'- [ ] 작업',e=>{e.set_options({mode:'rich'});const task=e.surface.querySelector('[data-task]'),item=task.parentNode,offset=[...item.childNodes].indexOf(task)+1;assert(e.dom_to_source(item,offset)===6,'caret after checkbox mapped to list marker');caret(e,6);input(e,'deleteContentBackward');equal(e,'- 작업');assert(!e.surface.textContent.includes('['));});
 for(const accept of [false,true])await test('Rich block boundary deletion confirmation '+accept,shared,'| A | B |\n| --- | --- |\n| a | b |\n\n뒤 문단',e=>{e.set_options({mode:'rich'});const at=byte_length(e.state.source)-byte_length('뒤 문단');caret(e,at);const before=e.state.source;input(e,'deleteContentBackward');assert(e.dialog.open);equal(e,before);if(accept){e.dialog_callback(new FormData());assert(!e.state.source.includes('|'));}else equal(e,before);e.dialog.close('cancel');});
}
for(const shared of [false,true])for(const [at,key,expected] of [[10,'ArrowLeft',7],[2,'ArrowRight',5]])await test('Rich inline arrow '+at+' '+key,shared,'ma**rkdo**wn',e=>{e.set_options({mode:'rich'});caret(e,at);e.surface.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));assert(e.selection.focus===expected);});
for(const shared of [false,true]){
 await test('Hybrid reveals only the approached inline and restores on exit',shared,'ma**rkdo**wn and ==강조== 끝',e=>{
  caret(e,1);assert(!e.surface.querySelector('[data-revealed]'),'plain text revealed a paragraph');
  caret(e,6);const active=e.surface.querySelector('[data-revealed]');assert(active?.dataset.kind==='bold');assert(active.dataset.start==='2'&&active.dataset.end==='10');assert(e.surface.querySelector('mark:not([data-revealed])'),'unrelated highlight lost rich presentation');
  const source=e.state.source;caret(e,12);assert(!e.surface.querySelector('[data-revealed]'));assert(e.state.source===source);
 });
 await test('Broken inline source stays scoped beside another rich inline',shared,'ma**rkdo**wn and ==강조== 끝',e=>{
  caret(e,10);input(e,'deleteContentBackward');equal(e,'ma**rkdo*wn and ==강조== 끝');const active=e.surface.querySelector('[data-revealed]');assert(active?.dataset.kind==='bold'&&+active.dataset.start===2&&+active.dataset.end===9);assert(e.surface.querySelector('mark:not([data-revealed])'));input(e,'insertText','X');equal(e,'ma**rkdo*Xwn and ==강조== 끝');
 });
 await test('Hybrid rich-only inline option keeps its projection',shared,'ma**rkdo**wn and ==강조== 끝',e=>{e.set_options({elements:{bold:{reveal_markdown:false}}});caret(e,6);assert(!e.surface.querySelector('[data-revealed]'));assert(e.editing_mode()==='rich');});
}
for(const shared of [false,true])for(const mode of ['rich','hybrid','markdown'])for(const [code,key,wrapper] of [['KeyB','ㅠ','**'],['KeyI','ㅑ','*']])await test('Selected text formatting shortcut '+mode+' '+code,shared,'앞 선택 뒤',e=>{
 e.set_options({mode});for(const modifier of ['ctrlKey','metaKey']){
  const start=byte_length('앞 '),end=byte_length('앞 선택');e.set_selection(start,end);e.surface.dispatchEvent(new KeyboardEvent('keydown',{key,code,[modifier]:true,bubbles:true,cancelable:true}));equal(e,'앞 '+wrapper+'선택'+wrapper+' 뒤');
  e.set_selection(start, end+byte_length(wrapper+wrapper));e.surface.dispatchEvent(new KeyboardEvent('keydown',{key:code.slice(3).toLowerCase(),code,[modifier]:true,bubbles:true,cancelable:true}));equal(e,'앞 선택 뒤');
 }
});
document.querySelector('#summary').textContent=`${passed} passed / ${failed} failed`;
