import {create_editor} from './editor.js';
import {create_replica,new_identity} from './collab/core.js';
import {connect_demo_pair} from './collab/demo-connection.js';
const cases={inline:'**굵은 글자**로 쓸 수 있음',unicode:'한글😀 é &nbsp; 끝',list:'- [ ] 확인할 작업',table:'| 항목 | 상태 |\n| --- | --- |\n| 표 편집 | 준비 |\n\n뒤 문단',paragraph:'첫 문단\n\n둘째 문단'};
let editor,peer,a,b,connection,generation=0;
const status=document.querySelector('#status'),diagnostics=document.querySelector('#diagnostics');
function report(){if(!editor?.core||!peer?.core)return;const selection=editor.dom_selection();diagnostics.textContent=JSON.stringify({source:editor.state.source,selection:editor.get_selection(),draft:!!editor.state.draft,can_undo:editor.state.can_undo,can_redo:editor.state.can_redo,peer_source:peer.state.source,dom_focus:selection?.focusNode?.nodeType===3?selection.focusNode.data:selection?.focusNode?.nodeName,dom_offset:selection?.focusOffset},(_,v)=>typeof v==='bigint'?v.toString():v,2);}
function dispose(){connection?.close();editor?.destroy();peer?.destroy();a?.destroy();b?.destroy();connection=editor=peer=a=b=null;}
async function setup(){const run=++generation;dispose();document.querySelector('#case').disabled=true;document.querySelector('#mode').disabled=true;status.textContent='새 검증 문서 준비 중';const document_id=new_identity();a=await create_replica({document_id});b=await create_replica({document_id});if(run!==generation)return;
 const left=document.createElement('div'),right=document.createElement('div');document.querySelector('#editor').replaceChildren(left);document.querySelector('#peer').replaceChildren(right);
 editor=await create_editor(left,{replica:a,markdown:cases[document.querySelector('#case').value],mode:document.querySelector('#mode').value});b.merge(a.export_state());peer=await create_editor(right,{replica:b});peer.set_view('source');peer.set_selection(0);connection=await connect_demo_pair(a,b,{mode:'same-page'});for(const transport of connection.transports)transport.addEventListener('error',event=>{status.textContent='전송 오류: '+event.detail.message;report();});
 editor.set_options({mode:document.querySelector('#mode').value});document.querySelector('#case').disabled=false;document.querySelector('#mode').disabled=false;
 editor.addEventListener('change',report);peer.addEventListener('change',report);status.textContent='연결됨 · 실제 키보드 입력 대기';report();}
document.querySelector('#case').onchange=()=>setup().catch(error=>status.textContent=error.message);
document.querySelector('#mode').onchange=()=>{editor.set_options({mode:document.querySelector('#mode').value});report();};
document.querySelector('#render').onclick=()=>{const before=JSON.stringify({source:editor.state.source,selection:editor.selection,undo:editor.state.can_undo});for(let i=0;i<5;i++)editor.render();const after=JSON.stringify({source:editor.state.source,selection:editor.selection,undo:editor.state.can_undo});status.textContent=before===after?'표시 복원 불변식 통과':'표시 복원 불변식 실패';report();};
document.querySelector('#remote').onclick=()=>{peer.replace('원격😀\n\n',0,0);report();};
document.addEventListener('selectionchange',report);window.addEventListener('pagehide',dispose);await setup();
