import {create_editor} from '../editor.js';
import {create_replica,new_identity} from './core.js';
import {connect_demo_pair} from './demo-connection.js';
const document_id=new_identity(),a=await create_replica({document_id}),b=await create_replica({document_id});
const response=await fetch(new URL('./markdown-examples.md',import.meta.url));
if(!response.ok)throw new Error('문법 예제를 불러오지 못했습니다.');
const markdown=await response.text();
const x=await create_editor(document.querySelector('#left'),{replica:a,mode:'rich',session_storage:{key:'sohjae:collab-demo:left',auto_save:true},markdown});
b.merge(a.export_state());const y=await create_editor(document.querySelector('#right'),{replica:b,mode:'rich',session_storage:{key:'sohjae:collab-demo:right',auto_save:true}});y.set_view('source');y.set_selection(0);requestAnimationFrame(()=>{y.source_input.scrollTop=0;});
let connection=null,busy=false;const button=document.querySelector('#connect'),status=document.querySelector('#status');
async function toggle(){if(busy)return;busy=true;button.disabled=true;try{if(connection){connection.close();connection=null;status.textContent='연결 끊김 · 독립 편집';}else{status.textContent='연결 중…';const mode=document.querySelector('#connection_mode').value;connection=await connect_demo_pair(a,b,{mode,ice_servers:mode==='webrtc'?JSON.parse(document.querySelector('#ice_servers').value):[]});status.textContent=connection.mode==='webrtc'?'WebRTC 연결됨':'같은 페이지 연결됨 (WebRTC 아님)';for(const transport of connection.transports)transport.addEventListener('error',event=>{connection?.close();connection=null;status.textContent=event.detail.message;button.textContent='다시 연결';});}}catch(error){connection?.close();connection=null;status.textContent=error.message;}finally{busy=false;button.disabled=false;document.querySelector('#connection_mode').disabled=!!connection;button.textContent=connection?'연결 끊기':'다시 연결';}}
button.onclick=toggle;await toggle();window.addEventListener('pagehide',()=>{connection?.close();x.destroy();y.destroy();a.destroy();b.destroy();});
