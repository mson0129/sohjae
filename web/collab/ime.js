import {create_editor} from '../editor.js';
import {create_replica,new_identity,byte_length} from './core.js';
const document_id=new_identity(),a=await create_replica({document_id}),b=await create_replica({document_id});
const editor=await create_editor(document.querySelector('#editor'),{replica:a,markdown:'입력: ',mode:'rich',auto_close:{enabled:false}});b.merge(a.export_state());
const records=[];let trusted_start=0,trusted_end=0;
function record(event){const item={type:event.type,trusted:event.isTrusted,data:event.data??null,input_type:event.inputType??null,view:editor.source_view?'source':'rich',time_ms:Math.round(performance.now())};records.push(item);if(event.isTrusted&&event.type==='compositionstart')trusted_start++;if(event.isTrusted&&event.type==='compositionend')trusted_end++;document.querySelector('#log').textContent=records.slice(-40).map(record=>JSON.stringify(record)).join('\n');document.querySelector('#status').textContent=`실제 조합 시작 ${trusted_start}회 / 종료 ${trusted_end}회 · 복제본 ${a.snapshot.markdown===b.snapshot.markdown?'일치':'동기화 중'} · 이벤트만으로 문장 정확성 통과를 자동 판정하지 않습니다.`;}
for(const field of [editor.surface,editor.source_input])for(const type of ['compositionstart','compositionupdate','compositionend','beforeinput','input'])field.addEventListener(type,event=>queueMicrotask(()=>record(event)));
a.addEventListener('update',event=>b.merge(event.detail));
function inject_remote(){const composing=editor.composing,field=editor.source_view?editor.source_input:editor.surface;const before=editor.source_view?field.value:field.innerHTML;b.replace_text(0,0,'😀');a.merge(b.export_state());const after=editor.source_view?field.value:field.innerHTML;document.querySelector('#remote-status').textContent=`원격 수신 당시 조합 중: ${composing?'예':'아니오'} · 조합 DOM 보존: ${before===after?'예':'아니오'} · 복제본 ${a.snapshot.markdown===b.snapshot.markdown?'일치':'불일치'}`;}
document.querySelector('#remote').onpointerdown=event=>event.preventDefault();document.querySelector('#remote').onclick=inject_remote;
document.querySelector('#delayed').onclick=()=>{document.querySelector('#remote-status').textContent='2초 뒤 원격 수신 예약됨';setTimeout(inject_remote,2000);};
document.querySelector('#source').onclick=()=>editor.set_view('source');
window.addEventListener('pagehide',()=>{editor.destroy();a.destroy();b.destroy();});
