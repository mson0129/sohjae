import {create_editor} from './editor.js';
import {byte_length,byte_slice} from './core.js';
import {create_replica,new_identity} from './collab/core.js';
import {connect_demo_pair} from './collab/demo-connection.js';
let passed=0,failed=0;
const assert=(ok,message='assertion failed')=>{if(!ok)throw new Error(message);};
const equal=(a,b)=>assert(a===b,`${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
async function test(name,run){const li=document.createElement('li');document.querySelector('#results').append(li);try{await run();li.textContent='PASS '+name;passed++;}catch(error){li.textContent='FAIL '+name+': '+error.stack;li.className='fail';failed++;}}
async function fixture(markdown='',options={}){const host=document.createElement('div');document.querySelector('#fixtures').append(host);return create_editor(host,{markdown,mode:'rich',...options});}
function native(editor,html,{type='insertParagraph',data=null,selector='p',offset=0}={}){
 editor.focus();editor.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:type==='insertParagraph'?'insertReplacementText':type,data,bubbles:true,cancelable:true}));
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
await test('External row grip replaces cell handles in rich and hybrid modes',async()=>{
 for(const mode of ['rich','hybrid']){const e=await fixture('| H | V |\n| --- | --- |\n| A | 1 |\n| B | 2 |',{mode});try{
  assert(!e.surface.querySelector('[data-row-handle],[data-column-handle]'));
  const row=e.surface.querySelector('table').rows[2],r=row.getBoundingClientRect();
  row.cells[0].dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+10,clientY:r.top+5}));
  assert(!e.row_grip.hidden);assert(!e.surface.contains(e.row_grip));
  e.row_grip.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',altKey:true,bubbles:true,cancelable:true}));
  assert(e.state.source.indexOf('| B |')<e.state.source.indexOf('| A |'));assert(e.state.source.startsWith('| H |'));
 }finally{e.destroy();}}
});
await test('Subscript and superscript survive native editing and toolbar commands',async()=>{
 const e=await fixture('H~2~O X^2^');try{
 assert(e.surface.querySelector('sub'));assert(e.surface.querySelector('sup'));
 native(e,'<p>H<sub>3</sub>O X<sup>2</sup></p>',{type:'insertText',data:'3',selector:'sub',offset:1});equal(e.state.source,'H~3~O X^2^');
 e.set_markdown('2');e.set_selection(0,1);await e.execute_command('superscript');equal(e.state.source,'^2^');
 e.set_markdown('2');e.set_selection(0,1);await e.execute_command('subscript');equal(e.state.source,'~2~');
 e.set_options({mode:'hybrid'});assert(e.surface.querySelector('[data-kind="subscript"]'));
 }finally{e.destroy();}
});
await test('Enter follows three source insertion rules in rich and hybrid paragraphs',async()=>{
 for(const mode of ['rich','hybrid'])for(const [source,position,expected] of [['문장',0,'&nbsp;\n\n문장'],['문장',byte_length('문장'),'문장\n\n&nbsp;'],['앞뒤',byte_length('앞'),'앞\n\n뒤'],['**굵게**',2,'&nbsp;\n\n**굵게**'],['# 제목\n\n다음',byte_length('# 제목'),'# 제목\n\n&nbsp;\n\n다음']]){
 const e=await fixture(source,{mode,elements:{bold:{reveal_markdown:false}}});try{e.focus();e.set_selection(position);e.restore_selection();const event=new InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true});e.surface.dispatchEvent(event);assert(event.defaultPrevented);equal(e.state.source,expected);}finally{e.destroy();}}
});
await test('External block selector converts all ten types and discards type metadata',async()=>{
 const sources=['# 본문','## 본문','### 본문','#### 본문','##### 본문','###### 본문','본문','```js\n본문\n```','> [!NOTE]\n> 본문','<details>\n<summary>잃을 제목</summary>\n\n본문\n\n</details>'];
 const targets=['h1','h2','h3','h4','h5','h6','p','pre','blockquote','details'];
 for(const mode of ['rich','hybrid']){const e=await fixture('본문',{mode});try{
  assert(!e.surface.contains(e.block_switcher));equal(e.block_switcher.options.length,10);
  for(let i=0;i<sources.length;i++)for(const target of targets){e.set_markdown(sources[i]);const block=e.conversion_blocks[0];assert(block,'missing block '+i);e.block_conversion(block,target);assert(e.state.source.includes('본문'),mode+' '+i+' '+target+' '+e.state.source);if(target!==targets[i]){assert(!e.state.source.includes('잃을 제목'),'summary '+mode+' '+i+' '+target+' '+e.state.source);assert(!e.state.source.includes('[!NOTE]'),'notice '+mode+' '+i+' '+target+' '+e.state.source);assert(!e.state.source.includes('```js'),'language '+mode+' '+i+' '+target+' '+e.state.source);}equal(e.conversion_blocks[0]?.dataset.conversionKind,target);}
 }finally{e.destroy();}}
});
await test('NBSP paragraphs retain a native caret line without a source BR',async()=>{
 const e=await fixture('앞\n\n&nbsp;\n\n| H |\n| --- |\n| V |');try{
 const p=e.surface.querySelector('p[data-start="5"]')||[...e.surface.querySelectorAll('p')].find(p=>p.querySelector('[data-rich-placeholder]'));
 assert(p);assert(p.querySelector('br[data-rich-placeholder]'));assert(p.getBoundingClientRect().height>0);
 e.focus();e.set_selection(byte_length('앞\n\n'));native(e,'<p>앞</p><p>입력<br data-rich-placeholder="1"></p><table><thead><tr><th>H</th></tr></thead><tbody><tr><td>V</td></tr></tbody></table>',{type:'insertText',data:'입력',selector:'p:nth-child(2)',offset:2});
 assert(e.state.source.includes('앞\n\n입력\n\n'));assert(!e.state.source.includes('<br>'));
 }finally{e.destroy();}
});
await test('New hybrid defaults reveal all syntax and constructor options retain selected rich elements',async()=>{
 const source='| H |\n| --- |\n| V |';
 for(const reveal of [true,false]){const e=await fixture(source,{mode:'hybrid',elements:{table:{reveal_markdown:reveal}}});try{e.focus();e.set_selection(byte_length('| H |\n| --- |\n| '));e.refresh_syntax();equal(!!e.surface.querySelector('[data-revealed]'),reveal);}finally{e.destroy();}}
 const e=await fixture('**내용**',{mode:'hybrid',elements:{bold:{reveal_markdown:false}}});try{assert(e.should_reveal('table'));assert(e.should_reveal('image'));assert(!e.should_reveal('bold'));}finally{e.destroy();}
});
await test('Markdown mode always displays exact source with heading and inline styles',async()=>{
 const source='# 제목😀\n\n**굵게**와 *기울임*\n\n| H |\n| --- |\n| V |\n\n&nbsp;\n\n```js\n# 코드\n```\n';
 const e=await fixture(source,{mode:'markdown'});try{
 equal(e.surface.textContent,source);let position=0;for(const char of source){const [node,offset]=e.source_to_dom(position);equal(e.dom_to_source(node,offset),position);position+=byte_length(char);}assert(e.surface.querySelector('.markdown_line[data-level="h1"]'));assert(e.surface.querySelector('.md_bold'));assert(!e.surface.querySelector('table,img,[data-revealed]'));
 e.focus();e.set_selection(byte_length('# 제목😀'));e.refresh_syntax();equal(e.surface.textContent,source);
 e.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true}));equal(e.state.source,source.replace('# 제목😀','# 제목😀\n'));equal(e.surface.textContent,e.state.source);
 e.set_options({mode:'rich'});assert(!e.surface.classList.contains('styled_markdown'));e.set_options({mode:'markdown'});equal(e.surface.textContent,e.state.source);
 }finally{e.destroy();}
});
await test('Rich is the default; ordered block conversion shortcuts match dropdown targets',async()=>{
 const host=document.createElement('div');document.querySelector('#fixtures').append(host);const defaultEditor=await create_editor(host,{markdown:'본문'});try{equal(defaultEditor.options.mode,'rich');equal([...defaultEditor.root.querySelector('.view_bar select').options].map(o=>o.value).join(','),'rich,hybrid,markdown');equal([...defaultEditor.block_switcher.options].map(o=>o.value).join(','),'h1,h2,h3,h4,h5,h6,pre,blockquote,details,p');}finally{defaultEditor.destroy();}
 for(const mode of ['rich','hybrid','markdown']){const e=await fixture('본문',{mode});try{for(let digit=0;digit<=9;digit++){
 e.set_markdown(digit===0?'# 본문':'본문');e.focus();e.set_selection(digit===0?2:0);e.restore_selection();
 const event=new KeyboardEvent('keydown',{key:digit===1?'¡':String(digit),code:'Digit'+digit,metaKey:digit%2===1,ctrlKey:digit%2===0,altKey:true,bubbles:true,cancelable:true});e.surface.dispatchEvent(event);assert(event.defaultPrevented);
 const target=({0:'p',7:'pre',8:'blockquote',9:'details'})[digit]||'h'+digit;
 const content=e.editing_markup().firstElementChild.firstElementChild;equal(target==='details'?!!content.querySelector('details'):content.localName,target==='details'?true:target);assert(e.state.source.includes('본문'));
 await e.execute_command('undo');equal(e.state.source,digit===0?'# 본문':'본문');
 }}finally{e.destroy();}}
});
await test('IME on empty paragraph element offsets replaces NBSP at the captured paragraph',async()=>{
 const source='# 제목\n\n&nbsp;\n\n다음 문단',expected='# 제목\n\n가나다라\n\n다음 문단',start=byte_length('# 제목\n\n');
 for(const shared of [false,true])for(const position of ['before','after','br']){
 let replica,e;try{if(shared)replica=await create_replica({document_id:new_identity()});e=await fixture(source,replica?{replica}:{});e.focus();const p=e.surface.querySelector('[data-rich-placeholder]').parentElement,br=p.querySelector('br');
 const node=position==='br'?br:p,offset=position==='after'?p.childNodes.length:0;e.dom_selection().setBaseAndExtent(node,offset,node,offset);e.capture_selection();equal(e.selection.focus,start);
 e.surface.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.surface.dispatchEvent(new CompositionEvent('compositionend',{data:'가나다라',bubbles:true}));equal(e.state.source,expected);assert(e.selection.focus<=byte_length('# 제목\n\n가나다라'));
 }finally{e?.destroy();replica?.destroy();}}
});
await test('Remote edits during IME on NBSP retain the local paragraph position',async()=>{
 const id=new_identity(),a=await create_replica({document_id:id}),b=await create_replica({document_id:id});let e;
 try{e=await fixture('# 제목\n\n&nbsp;\n\n다음',{replica:a});b.merge(a.export_state());e.focus();const p=e.surface.querySelector('[data-rich-placeholder]').parentElement;e.dom_selection().setBaseAndExtent(p,p.childNodes.length,p,p.childNodes.length);e.surface.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));b.replace_text(0,0,'원격\n\n');a.merge(b.export_state());e.surface.dispatchEvent(new CompositionEvent('compositionend',{data:'가나다라',bubbles:true}));equal(e.state.source,'원격\n\n# 제목\n\n가나다라\n\n다음');}finally{e?.destroy();a.destroy();b.destroy();}
});
await test('Browser storage saves exact Markdown, restores across instances and supports undo',async()=>{
 const key='sohjae-test-'+new_identity();let e;
 try{e=await fixture('# 제목😀\n\n&nbsp;',{local_storage:{key}});const saved=e.save_local();equal(saved.markdown,e.state.source);e.destroy();e=await fixture('현재',{local_storage:{key}});equal(e.state.source,'현재');assert(e.load_local());equal(e.state.source,'# 제목😀\n\n&nbsp;');await e.execute_command('undo');equal(e.state.source,'현재');
 localStorage.setItem(key,'{"version":9}');let failed=false;try{e.load_local();}catch{failed=true;}assert(failed);equal(e.state.source,'현재');
 }finally{e?.destroy();localStorage.removeItem(key);}
});
await test('Browser autosave is opt-in and uses isolated keys',async()=>{
 const key='sohjae-test-'+new_identity(),other=key+'-other';let e,b;
 try{e=await fixture('처음',{local_storage:{key,auto_save:true}});b=await fixture('별도',{local_storage:{key:other}});e.replace('수정',0,byte_length('처음'));equal(JSON.parse(localStorage.getItem(key)).markdown,'수정');equal(localStorage.getItem(other),null);e.set_options({read_only:true});let failed=false;try{e.load_local();}catch{failed=true;}assert(failed);equal(e.state.source,'수정');
 }finally{e?.destroy();b?.destroy();localStorage.removeItem(key);localStorage.removeItem(other);}
});
await test('Enter before an empty paragraph follows the original paragraph downward',async()=>{
 const prefix='# 함께 쓰는 문서\n\n',suffix='\n\n==리치 화면==\n\n| H |\n| --- |\n| V |\n';
 for(const mode of ['rich','hybrid'])for(const shared of [false,true]){let replica,e;try{
 if(shared)replica=await create_replica({document_id:new_identity()});e=await fixture(prefix+'&nbsp;'+suffix,{mode,...(replica?{replica}:{}),elements:{heading:{reveal_markdown:false},highlight:{reveal_markdown:false}}});e.focus();e.set_selection(byte_length(prefix));e.restore_selection();
 for(let count=1;count<=2;count++){
 e.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true}));
 equal(e.state.source,prefix+'&nbsp;\n\n'.repeat(count)+'&nbsp;'+suffix);equal(e.selection.focus,byte_length(prefix+'&nbsp;\n\n'.repeat(count)));
 e.capture_selection();equal(e.selection.focus,byte_length(prefix+'&nbsp;\n\n'.repeat(count)));
 }
 e.surface.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.surface.dispatchEvent(new CompositionEvent('compositionend',{data:'가나다라',bubbles:true}));
 assert(e.state.source.includes('&nbsp;\n\n가나다라'));assert(e.state.source.endsWith(suffix));
 }finally{e?.destroy();replica?.destroy();}}
});
await test('Native rich paragraph marks toggle without changing Markdown or adding caret text',async()=>{
 const source='# 제목\n\n본문<br>다음\n\n&nbsp;\n\n- [ ]';const e=await fixture(source);try{
 const revision=e.state.revision;await e.execute_command('paragraph_marks');equal(e.state.source,source);assert(e.state.revision===revision);
 const heading=e.surface.querySelector('h1'),empty=e.surface.querySelector('[data-rich-placeholder]').parentElement,marker=e.surface.querySelector('.break_mark');
 assert(getComputedStyle(heading,'::after').content.includes('↵'));assert(getComputedStyle(empty,'::after').content.includes('↵'));equal(getComputedStyle(empty,'::after').position,'absolute');assert(marker);assert(!e.surface.querySelector('li:last-child .break_mark'));assert(getComputedStyle(marker,'::before').content.includes('↓'));assert(!e.surface.textContent.includes('↵'));assert(!e.surface.textContent.includes('↓'));
 await e.execute_command('paragraph_marks');equal(e.state.source,source);assert(!getComputedStyle(e.surface.querySelector('h1'),'::after').content.includes('↵'));
 }finally{e.destroy();}
});
await test('Hybrid revealed lists hide browser bullets and numbering',async()=>{
 for(const source of ['- 항목','1. 항목']){const e=await fixture(source,{mode:'hybrid'});try{e.focus();e.set_selection(byte_length(source));e.refresh_syntax();const item=e.surface.querySelector('li[data-revealed]');assert(item);equal(item.textContent,source);equal(getComputedStyle(item).listStyleType,'none');e.set_options({elements:{list:{reveal_markdown:false}}});assert(!e.surface.querySelector('li[data-revealed]'));assert(getComputedStyle(e.surface.querySelector('li')).listStyleType!=='none');}finally{e.destroy();}}
});
await test('Deleting the last lazy list continuation character creates a paragraph below the list',async()=>{
 for(const shared of [false,true])for(const backwards of [true,false]){let e,replica;
 try{if(shared)replica=await create_replica({document_id:new_identity()});const prefix='1. [ ] 가나다\n2. [ ] 파하',source=prefix+'\n6';e=await fixture(source,{mode:'hybrid',...(replica?{replica}:{})});e.focus();e.set_selection(byte_length(source)-(backwards?0:1));e.refresh_syntax();e.restore_selection();
 e.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:backwards?'deleteContentBackward':'deleteContentForward',bubbles:true,cancelable:true}));equal(e.state.source,prefix+'\n\n&nbsp;');equal(e.selection.focus,byte_length(prefix+'\n\n'));assert(e.surface.querySelector('ol'));assert(e.surface.querySelector('section:last-child > p'));e.capture_selection();equal(e.selection.focus,byte_length(prefix+'\n\n'));await e.execute_command('undo');equal(e.state.source,source);
 }finally{e?.destroy();replica?.destroy();}}
});
await test('Hybrid preserves typed trailing spaces after a pipe and subsequent caret position',async()=>{
 for(const shared of [false,true]){let e,replica;try{if(shared)replica=await create_replica({document_id:new_identity()});e=await fixture('지울 내용',{mode:'hybrid',...(replica?{replica}:{})});e.focus();e.set_selection(0,byte_length('지울 내용'));e.restore_selection();e.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));equal(e.state.source,'');
 for(const char of ['|',' ',' ','A']){e.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertText',data:char,bubbles:true,cancelable:true}));e.capture_selection();equal(e.selection.focus,byte_length(e.state.source));}
 equal(e.state.source,'|  A');equal(e.surface.querySelector('p').textContent,'|  A');
 }finally{e?.destroy();replica?.destroy();}}
});
await test('Markdown Backspace edits table source delimiters in standalone and shared editors',async()=>{
 const source='| 리치 | 하이브리드 | 마크다운 | 원본 | HTML | 읽기 |\n| --- | --- | --- | --- | --- | --- |';
 for(const shared of [false,true]){let e,replica;try{if(shared)replica=await create_replica({document_id:new_identity()});e=await fixture(source,{mode:'markdown',...(replica?{replica}:{})});e.focus();
 const position=byte_length(e.state.source.trimEnd());e.set_selection(position);e.restore_selection();
 for(let i=0;i<4;i++){
 const before=e.state.source,at=e.selection.focus,expected=byte_slice(before,0,at-1)+byte_slice(before,at);
 e.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));equal(e.state.source,expected);equal(e.selection.focus,at-1);equal(e.surface.textContent,e.state.source);e.capture_selection();equal(e.selection.focus,at-1);
 }
 }finally{e?.destroy();replica?.destroy();}}
});
await test('Enter after an unescaped pipe inserts only one source newline before paragraph rules',async()=>{
 for(const mode of ['rich','hybrid'])for(const shared of [false,true])for(const source of ['|','| A |','앞 | 뒤']){let e,replica;try{
 if(shared)replica=await create_replica({document_id:new_identity()});e=await fixture(source,{mode,...(replica?{replica}:{})});const at=byte_length(source.slice(0,source.indexOf('|')+1));e.focus();e.set_selection(at);e.restore_selection();
 e.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true}));equal(e.state.source,byte_slice(source,0,at)+'\n'+byte_slice(source,at));equal(e.selection.focus,at+1);e.capture_selection();assert(e.selection.focus===at+1,mode+' shared='+shared+' source='+source+' caret='+e.selection.focus+' expected='+(at+1)+' html='+e.surface.innerHTML);
 }finally{e?.destroy();replica?.destroy();}}
});
await test('Tab in the last rich table cell appends a row and focuses its first column',async()=>{
 for(const mode of ['rich','hybrid'])for(const shared of [false,true]){let e,replica;try{
 if(shared)replica=await create_replica({document_id:new_identity()});e=await fixture('| H | V |\n| --- | :---: |\n| A | B |',{mode,...(replica?{replica}:{}),elements:{table:{reveal_markdown:false}}});e.focus();const last=e.surface.querySelector('table').rows[1].cells[1];e.set_selection(+last.dataset.end);e.restore_selection();
 e.surface.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',code:'Tab',bubbles:true,cancelable:true}));
 let table=e.surface.querySelector('table');equal(table.rows.length,3);equal(e.selection.focus,+table.rows[2].cells[0].dataset.start);e.capture_selection();equal(e.selection.focus,+table.rows[2].cells[0].dataset.start);
 e.surface.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',code:'Tab',bubbles:true,cancelable:true}));table=e.surface.querySelector('table');equal(e.selection.focus,+table.rows[2].cells[1].dataset.start);equal(table.rows.length,3);
 e.surface.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',code:'Tab',shiftKey:true,bubbles:true,cancelable:true}));equal(e.selection.focus,+table.rows[2].cells[0].dataset.start);equal(table.rows.length,3);
 }finally{e?.destroy();replica?.destroy();}}
});
await test('Tab from a browser element caret in the last empty cell cannot focus the row grip',async()=>{
 for(const mode of ['rich','hybrid'])for(const shared of [false,true]){let e,replica;try{if(shared)replica=await create_replica({document_id:new_identity()});e=await fixture('| H | V |\n| --- | --- |\n| | |',{mode,...(replica?{replica}:{}),elements:{table:{reveal_markdown:false}}});e.focus();const cell=e.surface.querySelector('table').rows[1].cells[1];e.dom_selection().setBaseAndExtent(cell,cell.childNodes.length,cell,cell.childNodes.length);
 e.capture_selection();equal(e.selection.focus,+cell.dataset.start);const event=new KeyboardEvent('keydown',{key:'Tab',code:'Tab',bubbles:true,cancelable:true});e.surface.dispatchEvent(event);assert(event.defaultPrevented);const table=e.surface.querySelector('table');equal(table.rows.length,3);equal(e.selection.focus,+table.rows[2].cells[0].dataset.start);const focus=e.dom_selection().focusNode;assert((focus.nodeType===1?focus:focus.parentElement).closest('td')===table.rows[2].cells[0]);assert(e.root.activeElement===e.surface);equal(e.row_grip.tabIndex,-1);
 }finally{e?.destroy();replica?.destroy();}}
});
await test('Typing after last-cell Tab remains in the new first cell',async()=>{
 const replica=await create_replica({document_id:new_identity()});let e;try{e=await fixture('| H | V |\n| --- | --- |\n|  |  |\n',{replica});e.focus();const last=e.surface.querySelector('table').rows[1].cells[1];e.dom_selection().setBaseAndExtent(last,0,last,0);e.surface.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
 for(const char of ['가','나']){const cell=e.surface.querySelector('table').rows[2].cells[0];e.surface.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertText',data:char,bubbles:true,cancelable:true}));cell.querySelectorAll('br').forEach(br=>br.remove());const text=cell.firstChild||cell.appendChild(document.createTextNode(''));text.textContent+=char;e.dom_selection().setBaseAndExtent(text,text.length,text,text.length);e.surface.dispatchEvent(new InputEvent('input',{inputType:'insertText',data:char,bubbles:true}));assert(e.state.source.includes('| '+(char==='가'?'가':'가나')+' |  |'),e.state.source);}
 }finally{e?.destroy();replica.destroy();}
});
await test('Rich table arrows use native visual navigation and never add rows or paragraphs',async()=>{
 for(const shared of [false,true]){let e,replica;try{if(shared)replica=await create_replica({document_id:new_identity()});e=await fixture('| H | V |\n| --- | --- |\n| 여러 글자<br>다음 줄 | |',{...(replica?{replica}:{})});e.focus();const source=e.state.source;
 for(const cell of e.surface.querySelectorAll('[data-cell]'))for(const position of [+cell.dataset.start,+cell.dataset.end])for(const key of ['ArrowLeft','ArrowRight']){e.set_selection(position);e.restore_selection();const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});e.surface.dispatchEvent(event);assert(!event.defaultPrevented,key);equal(e.state.source,source);}
 }finally{e?.destroy();replica?.destroy();}}
});
await test('Rich table vertical arrows keep the same column, including empty cells',async()=>{
 for(const shared of [false,true]){let e,replica;try{if(shared)replica=await create_replica({document_id:new_identity()});e=await fixture('| H1 | H2 | H3 | H4 |\n| --- | --- | --- | --- |\n| A | B | C | D |\n| E | F | | H |',{...(replica?{replica}:{})});e.focus();const source=e.state.source;
 for(const [row,key,targetRow] of [[1,'ArrowDown',2],[2,'ArrowUp',1]]){const table=e.surface.querySelector('table'),cell=table.rows[row].cells[2];e.set_selection(+cell.dataset.start);e.restore_selection();const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});e.surface.dispatchEvent(event);assert(event.defaultPrevented);equal(e.selection.focus,+table.rows[targetRow].cells[2].dataset.start);const focus=e.dom_selection().focusNode;assert((focus.nodeType===1?focus:focus.parentElement).closest('[data-cell]')===table.rows[targetRow].cells[2]);equal(e.state.source,source);}
 }finally{e?.destroy();replica?.destroy();}}
});
await test('Vertical arrows preserve column in the reported escaped-code table',async()=>{
 const source="# enter&nbsp;입력에 따른 동작 \n\n| 구분 | 리치 | 하이브리드 | 마크다운 | 원본 |\n| --- | --- | --- | --- | --- |\n| enter 시 커서 앞에 `\\|` 글자가 있는 경우 | `\\n`만 삽입 |  |  |  |\n| enter 시 커서 앞에 글자가 없는 경우 | `&nbsp;\\n\\n` 삽입 | <br> | <br> | &nbsp; |\n|  |  |  |  |  |\n";
 for(const shared of [false,true]){let e,replica;try{if(shared)replica=await create_replica({document_id:new_identity()});e=await fixture(source,{...(replica?{replica}:{})});e.focus();const table=e.surface.querySelector('table'),from=table.rows[1].cells[2],target=table.rows[2].cells[2];e.dom_selection().setBaseAndExtent(from,0,from,0);e.surface.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));const focus=e.dom_selection().focusNode,cell=(focus.nodeType===1?focus:focus.parentElement).closest('[data-cell]');assert(cell===target,'shared='+shared+' row='+cell?.dataset.row+' col='+cell?.dataset.column+' wanted row=2 col=2');}finally{e?.destroy();replica?.destroy();}}
});


await test('Rich wrapped table cells navigate by DOM row and column from every cell edge',async()=>{
 const source='# enter&nbsp;입력에 따른 동작\n\n| 구분 | 리치 | 하이브리드 | 마크다운 | 원본 |\n| --- | --- | --- | --- | --- |\n| enter 시 커서 앞에 `\\|` 글자가 있는 경우 | `\\n`만 삽입 |  |  |  |\n| enter 시 커서 앞에 글자가 없는 경우 | `&nbsp;\\n\\n` 삽입 | <br> | <br> | &nbsp; |\n|  |  |  |  |  |';
 for(const shared of [false,true]){let e,replica;try{if(shared)replica=await create_replica({document_id:new_identity()});e=await fixture(source,{...(replica?{replica}:{})});e.surface.style.width='320px';e.focus();
  const baseline=e.state.source,table=e.surface.querySelector('table');
  for(let col=0;col<5;col++)for(const end of [false,true])for(const [row,key,destination] of [[1,'ArrowDown',2],[2,'ArrowUp',1]]){
   const from=table.rows[row].cells[col],target=table.rows[destination].cells[col],range=document.createRange();range.selectNodeContents(from);range.collapse(!end);const selection=e.dom_selection();selection.removeAllRanges();selection.addRange(range);
   const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});e.surface.dispatchEvent(event);assert(event.defaultPrevented);const node=selection.focusNode;assert((node.nodeType===1?node:node.parentElement).closest('[data-cell]')===target,'wrong row/column '+row+'/'+col);equal(e.state.source,baseline);
  }
 }finally{e?.destroy();replica?.destroy();}}
});

document.querySelector('#summary').textContent=`${passed} passed / ${failed} failed`;document.body.dataset.passed=failed?'false':'true';
