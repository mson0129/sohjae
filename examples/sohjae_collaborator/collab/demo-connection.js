// Demo-only same-page transport. Uses the real handshake, framing and CRDT replicas;
// MessageChannel does not connect remote devices and is never presented as WebRTC.
import {WebRTCTransport,connect_local_pair} from './webrtc.js';
class PageChannel extends EventTarget {
  constructor(port){
    super();this.port=port;this.readyState='open';this.ordered=true;this.maxRetransmits=null;this.maxPacketLifeTime=null;this.bufferedAmount=0;
    port.onmessage=event=>{if(this.readyState==='open')this.dispatchEvent(new MessageEvent('message',{data:event.data}));};
    port.onmessageerror=()=>this.dispatchEvent(new Event('error'));port.start();
  }
  send(data){
    if(this.readyState!=='open')throw new Error('Same-page channel closed');
    this.port.postMessage(data instanceof Uint8Array?data.slice().buffer:data);
  }
  close(){if(this.readyState==='closed')return;this.readyState='closed';this.port.close();this.dispatchEvent(new Event('close'));}
}
export async function connect_demo_pair(a,b,{mode='same-page',ice_servers=[]}={}){
  if(mode==='webrtc')return {...await connect_local_pair(a,b,{ice_servers}),mode:'webrtc'};
  if(mode!=='same-page')throw new TypeError('Unknown demo connection mode');
  if(!a?.handle||!b?.handle||a.snapshot.document_id!==b.snapshot.document_id||a.snapshot.actor_id===b.snapshot.actor_id)throw new TypeError('Distinct live replicas of the same document are required');
  const ports=new MessageChannel(),channels=[new PageChannel(ports.port1),new PageChannel(ports.port2)],transports=[];
  let closed=false;
  const close=()=>{if(closed)return;closed=true;transports.forEach(transport=>transport.close());channels.forEach(channel=>channel.close());};
  try{
    await new Promise((resolve,reject)=>{
      const attach=(replica,channel,actor)=>{
        const transport=new WebRTCTransport(replica,channel,{authorize_peer:hello=>hello.actor_id===actor});transports.push(transport);
        transport.addEventListener('ready',()=>{if(transports.length===2&&transports.every(item=>item.ready))resolve();});
        transport.addEventListener('error',event=>{reject(event.detail);close();});
        transport.addEventListener('close',()=>{reject(new Error('Same-page connection closed'));close();});
      };
      attach(a,channels[0],b.snapshot.actor_id);attach(b,channels[1],a.snapshot.actor_id);
    });
    return {mode:'same-page',close,transports,peer_connections:[]};
  }catch(error){close();throw error;}
}
