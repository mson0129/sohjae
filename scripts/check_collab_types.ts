import { create_replica, new_identity, COLLABORATION_PROFILE, CollaborationError, type Replica, type ReplicaSnapshot } from '../web/collab/core.js';
import { WebRTCTransport, type TransportErrorCode } from '../web/collab/webrtc.js';
declare const replica: Replica, channel: RTCDataChannel;
const created: Promise<Replica> = create_replica({document_id:new_identity(), wasm_url:new URL('https://example.test/collaborator.wasm')});
const snapshot: ReplicaSnapshot = replica.replace_text(0,0,'한😀');
const anchor: Uint8Array = replica.projected_anchor(0,'before');
replica.replace_capture(replica.capture_range(0,0), 'text');
replica.table_action('id','clear',0,0,[0,1,0,1]);
replica.reorder('id','column',['column']);
replica.addEventListener('change', event => { const text:string=event.detail.snapshot.markdown; void text; });
replica.addEventListener('update', event => { const bytes:Uint8Array=event.detail; void bytes; });
const transport=new WebRTCTransport(replica,channel,{authorize_peer:async hello=>hello.protocol===3&&hello.document_id===replica.snapshot.document_id});
transport.addEventListener('sync', event=>{const pending:number=event.detail.pending;void pending;});
transport.addEventListener('error', event=>{const code:TransportErrorCode=event.detail.code;void code;});
if(new CollaborationError('Destroyed','destroyed').code==='Destroyed') transport.close();
// @ts-expect-error Snapshots cannot be overwritten.
replica.snapshot.text='wrong';
// @ts-expect-error Table identities are immutable.
replica.snapshot.tables[0].rows.push('id');
// @ts-expect-error Merge expects binary bytes, not a string.
replica.merge('log');
// @ts-expect-error Alignment is a closed union.
replica.set_alignment('table','column','justify');
// @ts-expect-error Authentication callback is required.
new WebRTCTransport(replica,channel,{});
// @ts-expect-error Transport states cannot be changed by the host.
transport.ready=true;
// @ts-expect-error No internal dispatcher in the public API.
replica.request(2);
// @ts-expect-error Protocol profile is immutable.
COLLABORATION_PROFILE.protocol=4;
void [created,snapshot,anchor];
