import {create_editor} from './editor.js';
import {byte_length} from './core.js';
import {create_replica,new_identity} from './collab/core.js';
import {connect_demo_pair} from './collab/demo-connection.js';
let passed=0,failed=0;
const assert=(ok,message='assertion failed')=>{if(!ok)throw new Error(message);};
const equal=(a,b)=>assert(a===b,`${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
async function test(name,run){const li=document.createElement('li');document.querySelector('#results').append(li);try{await run();li.textContent='PASS '+name;passed++;}catch(error){li.textContent='FAIL '+name+': '+error.stack;li.className='fail';failed++;}}
async function fixture(markdown='',options={}){const host=document.createElement('div');document.querySelector('#fixtures').append(host);return create_editor(host,{markdown,mode:'rich',...options});}
function native(editor,html,{type='insertParagraph',data=null,selector='p',offset=0}={}){
 editor.focus();editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:type,data,bubbles:true,cancelable:true}));
 editor.surface.innerHTML=html;const target=editor.surface.querySelector(selector)||editor.surface;const node=target.firstChild?.nodeType===3?target.firstChild:target;
 editor.dom_selection().setBaseAndExtent(node,offset,node,offset);editor.surface.dispatchEvent(new InputEvent('input',{inputType:type,data,bubbles:true}));
}
async function until(predicate){const end=performance.now()+5000;while(!predicate()){if(performance.now()>end)throw new Error('sync timeout');await new Promise(resolve=>setTimeout(resolve,10));}}
await test('Rich surface uses semantic text, while hybrid retains source coordinates',async()=>{
 const e=await fixture('# 제목\n\n**굵게**, ==강조==, ~~취소선~~');try{assert(e.surface.querySelector('strong'));assert(!e.surface.querySelector('section,[data-text],span'));equal(e.surface.contentEditable,'true');e.set_options({mode:'hybrid'});assert(e.surface.querySelector('[data-text]'));e.set_options({mode:'rich'});assert(!e.surface.querySelector('[data-text]'));}finally{e.destroy();}
});
await test('Native text changes remain a small source edit, preserving surrounding syntax',async()=>{
 const e=await fixture('__굵게__\n\n다른 문단');try{e.set_selection(2);native(e,'<p><strong>새굵게</strong></p><p>다른 문단</p>',{type:'insertText',data:'새',selector:'strong',offset:1});equal(e.state.source,'__새굵게__\n\n다른 문단');await e.execute_command('undo');equal(e.state.source,'__굵게__\n\n다른 문단');}finally{e.destroy();}
});
await test('Native paragraph split before inline formats keeps whole delimiters',async()=>{
 for(const [tag,open,close] of [['strong','**','**'],['mark','==','=='],['del','~~','~~']]){
  const e=await fixture(open+'굵게'+close);try{e.set_selection(2);native(e,`<p><br></p><p><${tag}>굵게</${tag}></p>`);equal(e.state.source,'&nbsp;\n\n'+open+'굵게'+close);equal(e.selection.focus,0);}finally{e.destroy();}
 }
});
await test('Native Backspace merges paragraphs and Enter splits a formatted run',async()=>{
 const e=await fixture('앞\n\n**굵게**');try{e.set_selection(byte_length('앞\n\n**'));native(e,'<p>앞<strong>굵게</strong></p>',{type:'deleteContentBackward',offset:1});equal(e.state.source,'앞**굵게**');
 e.set_markdown('**가나다라**');native(e,'<p><strong>가나</strong></p><p><strong>다라</strong></p>',{selector:'p:last-child strong'});equal(e.state.source,'**가나**\n\n**다라**');}finally{e.destroy();}
});
await test('Native heading end creates an actual paragraph before existing content',async()=>{
 const e=await fixture('# 제목\n\n기존 문단');try{e.set_selection(byte_length('# 제목'));native(e,'<h1>제목</h1><p><br></p><p>기존 문단</p>');equal(e.state.source,'# 제목\n\n&nbsp;\n\n기존 문단');equal(e.selection.focus,byte_length('# 제목\n\n'));}finally{e.destroy();}
});
await test('Nested tables and merged cells are rejected without changing source',async()=>{
 const e=await fixture('본문');try{for(const html of ['<table><tr><td><table><tr><td>x</td></tr></table></td></tr></table>','<table><tr><td colspan="2">x</td></tr></table>']){native(e,html);equal(e.state.source,'본문');assert(e.root.querySelector('.errors').textContent.includes('Markdown'));}}finally{e.destroy();}
});
await test('Native formatting is restricted to supported Markdown tags',async()=>{
 const e=await fixture('본문');try{native(e,'<p><span style="color:red;font-size:40px">본문</span><u>추가</u></p>',{type:'insertText',data:'추가',offset:0});equal(e.state.source,'본문추가');assert(!e.surface.querySelector('span,u,[style]'));}finally{e.destroy();}
});
await test('Shared native text preserves cell identity and synchronizes through real framing',async()=>{
 const id=new_identity(),a=await create_replica({document_id:id}),b=await create_replica({document_id:id});let e,other,connection;
 try{e=await fixture('| H |\n| --- |\n| 값 |',{replica:a});b.merge(a.export_state());other=await fixture('',{replica:b});connection=await connect_demo_pair(a,b);const table=a.snapshot.tables[0],cell=e.surface.querySelector('td');e.set_selection(Number(cell.dataset.start));
 native(e,'<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>새값</td></tr></tbody></table>',{type:'insertText',data:'새',selector:'td',offset:1});await until(()=>other.state.source===e.state.source);assert(e.state.source.includes('새값'));equal(a.snapshot.tables[0].id,table.id);equal(a.snapshot.tables[0].rows[1],table.rows[1]);
 }finally{connection?.close();e?.destroy();other?.destroy();a.destroy();b.destroy();}
});
await test('IME captured before a remote insertion preserves both users edits',async()=>{
 const id=new_identity(),a=await create_replica({document_id:id}),b=await create_replica({document_id:id});let e;
 try{e=await fixture('기존',{replica:a});b.merge(a.export_state());e.focus();e.set_selection(byte_length('기존'));e.surface.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));b.replace_text(0,0,'원격');a.merge(b.export_state());e.surface.dispatchEvent(new CompositionEvent('compositionend',{data:'한',bubbles:true}));assert(e.state.source.includes('원격'));assert(e.state.source.includes('한'));assert(!e.composing);}finally{e?.destroy();a.destroy();b.destroy();}
});
await test('Stale native transactions keep remote state and retain a local draft',async()=>{
 const id=new_identity(),a=await create_replica({document_id:id}),b=await create_replica({document_id:id});let e;
 try{e=await fixture('원문',{replica:a});b.merge(a.export_state());e.focus();e.set_selection(0);e.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertText',data:'새',bubbles:true,cancelable:true}));b.replace_text(0,0,'원격');a.merge(b.export_state());e.surface.innerHTML='<p>새원문</p>';e.surface.dispatchEvent(new InputEvent('input',{inputType:'insertText',data:'새',bubbles:true}));assert(e.state.source.includes('원격'));equal(e.get_pending_draft(),'새원문');assert(e.root.querySelector('.errors').textContent.includes('초안'));}finally{e?.destroy();a.destroy();b.destroy();}
});
await test('Empty rich paragraphs become text without retaining placeholder entities',async()=>{
 const e=await fixture('&nbsp;');try{e.focus();e.set_selection(0);native(e,'<p>입력</p>',{type:'insertText',data:'입력',offset:2});equal(e.state.source,'입력');}finally{e.destroy();}
});
await test('Read-only IME and input without beforeinput are handled safely',async()=>{
 const locked=await fixture('원문',{read_only:true});try{locked.surface.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));locked.surface.dispatchEvent(new CompositionEvent('compositionend',{data:'변경',bubbles:true}));equal(locked.state.source,'원문');}finally{locked.destroy();}
 const e=await fixture('원문');try{e.surface.innerHTML='<p>새원문</p>';const node=e.surface.firstChild.firstChild;e.dom_selection().setBaseAndExtent(node,1,node,1);e.surface.dispatchEvent(new InputEvent('input',{inputType:'insertText',data:'새',bubbles:true}));equal(e.state.source,'새원문');}finally{e.destroy();}
});
document.querySelector('#summary').textContent=`${passed} passed / ${failed} failed`;document.body.dataset.passed=failed?'false':'true';
