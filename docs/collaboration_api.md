# 협업 API v2 (실험)

`replica` 옵션 없는 `create_editor`와 ABI v1은 단일 사용자 프로토타입이다. 협업 코어와 전송 모듈은 별도 경로에 있으며 replica 옵션으로 기존 UI에 연결한다. 모델·실행 취소·수렴 규칙은 [협업 설계](collaboration.md)를 따른다.

## JS 코어

```js
import { create_replica, new_identity, byte_length } from './collab/core.js';
const replica = await create_replica({ document_id: new_identity() });
replica.addEventListener('change', event => {
  const { snapshot, origin } = event.detail; // local | remote
  console.log(snapshot.markdown, origin);
});
replica.addEventListener('update', event => {
  // 새 로컬 SCV2 Uint8Array만. merge는 이 이벤트를 내보내지 않는다.
  persist_or_send(event.detail);
});
replica.replace_text(0, 0, '# 문서\n');
const persisted = replica.export_state();
// 같은 document_id, 새 actor_id로 생성한 복제본에 복원:
// restored.merge(persisted);
replica.destroy();
```

`document_id`와 `actor_id`는 0이 아닌 32자리 16진 문자열이다. 기본 actor는 crypto.getRandomValues로 생성하며 독립 탭·기기마다 다른 ID를 사용한다. 서로 다른 문서는 병합하지 않는다. ID는 인증 수단이 아니다. 같은 문서를 여는 참가자에게 호스트가 같은 document_id와 기존 연산 로그를 전달해야 한다. 여러 참가자가 같은 초기 Markdown을 각각 삽입하면 내용이 중복되므로 문서 최초 생성자가 한 번만 삽입한다.

코어 메서드는 동기 호출이며 실패하면 예외를 낸다. `snapshot`에는 `text`, `markdown`, `html`, `tables`, `frontier`, `pending`, `rejected`, `operation_count`, `can_undo`, `can_redo`가 있다. `rejected`는 해당 merge 호출에서 격리한 연산 수다. `change` 시점에 snapshot은 이미 교체된다. 이벤트 핸들러에서 편집 명령을 재진입 호출하지 않는다.

| 메서드 | 의미 |
| --- | --- |
| `replace_text(start, end, text, scope = null)` | UTF-8 범위 교체, 줄바꿈 LF 정규화 |
| `capture_range(start, end, scope = null)` | 현재 선택한 atom ID와 삽입 기준점 캡처 |
| `replace_capture(capture, text)` | 캡처한 글자만 교체; 중간 수신한 원격 글자 보존 |
| `anchor_at(offset, bias = 'after', scope = null)` | 좌우 atom ID 기반 binary 상대 위치 |
| `resolve_anchor(anchor)` | 현재 scope의 UTF-8 오프셋 |
| `create_table(offset, rows = 2, columns = 2)` | 문서에 구조 표 생성; 최초 크기 각 1~100 |
| `insert_row(table, after = null)`, `insert_column(table, after = null)` | 안정적 ID 뒤에 행/열 삽입; null이면 맨 앞 |
| `delete_row(table, row)`, `delete_column(table, column)` | 하위 셀을 보존하는 논리 삭제 |
| `set_alignment(table, column, alignment)` | left/center/right |
| `undo()`, `redo()` | 현재 복제본이 작성한 연산 그룹만 활성/비활성 |
| `merge(bytes)` | 원격/저장 SCV2 병합, 중복 무시; 잘못된 문서·프레임은 예외 |
| `export_state()` | 적용된 연산과 인과 대기 중인 연산의 SCV2 로그 |
| `destroy()` | WASM 세션 해제, 이후 호출 오류 |

scope는 본문일 때 null, 셀일 때 `{ table, row, column }`이다. 표/행/열 ID는 snapshot에서 얻는 `counter(16 hex)-actor(32 hex)` 문자열이다. `tables[].cells`는 `{row,column,text}` 목록이고 `rows`, `columns`, `alignments`와 함께 읽는다.

본문 `snapshot.text`는 구조 표마다 U+FFFC 한 문자를 가진다. 이 문자는 UTF-8로 3바이트다. 실제 Markdown 표의 텍스트는 `snapshot.markdown`으로만 투영된다. 두 문자열의 오프셋은 호환되지 않는다. Markdown 전체 문자열을 본문에 덮어써서 구조 표를 수정하지 않는다. 일반 본문에 직접 입력한 Markdown 표 문자열은 현재 파서가 렌더링할 수 있지만 구조화된 공유 표 객체로 자동 승격되지 않는다.

캡처와 앵커는 저장 형식이 아니다. IME 시작 시 캡처하고 종료 시 한 번 commit한다. 조합 중 원격 merge는 계속하되 조합 중인 DOM은 교체하지 않는다. 범위의 방향은 UI가 별도로 보관한다. 본문 객체가 삭제되거나 셀이 숨겨지면 UI에서 선택을 안전한 위치로 이동해야 한다.

## WebRTC 어댑터

```js
import { WebRTCTransport } from './collab/webrtc.js';
const peer_connection = new RTCPeerConnection({
  iceServers: host_ice_servers // [{ urls, username?, credential? }]
});
// 인증된 호스트 시그널링으로 SDP/ICE 교환 후 생성/수신한 채널:
const channel = peer_connection.createDataChannel('document', { ordered: true });
const transport = new WebRTCTransport(replica, channel, {
  authorize_peer: async hello =>
    host_session.document_id === hello.document_id &&
    host_session.authorized_actor_id === hello.actor_id
});
transport.addEventListener('error', event => console.error(event.detail));
transport.addEventListener('sync', event => console.log(event.detail.pending));
// 종료: transport.close(); peer_connection.close();
```

수신 측도 `datachannel` 이벤트의 채널로 같은 어댑터를 생성한다. `authorize_peer`는 필수이며 true를 반환해야 문서를 교환한다. 호스트는 인증된 시그널링 세션과 hello의 actor를 연결해야 한다. 자기 주장 ID만 비교하는 콜백은 실제 사용자 인증이 아니다. 전달받은 로그에는 다른 작성자가 만든 연산도 들어갈 수 있으므로 이 코어는 방 참가자의 악의적 위조에 대한 서명 검증을 제공하지 않는다.

기본 RTCDataChannel의 ordered/reliable 설정을 사용한다. 어댑터는 버전·문서·다른 actor를 확인하고 전체 로그를 교환한다. `ready`는 handshake 완료이며 문서 수렴 완료를 의미하지 않는다. `sync` 후 pending=0 및 기대 상태를 확인한다. 12KiB 분할 전송, 16MiB 업데이트 한도, 32MiB 송수신 큐 한도, bufferedAmount 역압, handshake/fragment timeout을 적용한다. 과부하·잘못된 프레임·권한 거절 시 채널을 닫고 error를 알린다. 호스트가 새 채널을 연결하면 전체 로그로 재동기화한다. 현재 전송은 delta/frontier 최적화와 자동 reconnect를 제공하지 않는다. 원격 연산을 다른 채널에 중계하지 않으므로 3명 이상은 호스트가 모든 참가자 쌍을 연결하는 full mesh를 구성하거나 별도 중계·중복 방지 계층을 제공해야 한다.

`connect_local_pair(a, b, { ice_servers: [], timeout_ms: 20000 })`는 같은 페이지에서 두 RTCPeerConnection의 SDP/ICE를 직접 교환하는 검증 도우미다. 외부 STUN/TURN 기본값은 없으며 서버 없이 로컬 후보로 연결한다. 반환값의 `close()`는 두 채널과 연결을 해제한다. 다른 기기 간 연결은 호스트 시그널링과 실제 ICE 구성이 필요하다.

## WASM ABI

v1 exports는 유지하며 v2는 `collab_` 접두사를 쓴다. `collab_abi_version() == 2`. `collab_reserve_input(length)`로 얻은 메모리에 바이트를 복사한 뒤 `collab_dispatch(op, handle, start, end)`를 호출한다. 출력은 `collab_output_pointer/length`로 즉시 복사한다. 이후 호출과 memory.grow는 이전 뷰를 무효화할 수 있다. 입력 한도 16MiB, 오류 status=1과 UTF-8 오류 이름이다. 정상 status=0.

일반 응답은 `[JSON 길이 u32][JSON UTF-8][update 길이 u32][SCV2 update]`. 정수는 little-endian이다. 생성 JSON의 handle을 다음 호출에 전달한다. OpId는 counter u64+actor u128, AtomId는 OpId+scalar index u32다. scope는 document tag0 또는 cell tag1+table/row/column OpId다. optional ID는 존재 flag0/1 다음 ID다.

| op | 입력·좌표 | 출력 예외 |
| --- | --- | --- |
| 0 | document u128 + actor u128 | 새 세션 일반 응답 |
| 1 | 세션 파괴 | 빈 출력 |
| 2 | 본문 교체 UTF-8, start/end | 일반 응답 |
| 3 | SCV2 merge | 일반 응답, update 없음 |
| 4 | 전체 로그 export | raw SCV2 |
| 5 | snapshot | 일반 응답 |
| 6, 7 | undo, redo | 일반 응답 |
| 8 | rows u32+columns u32, start=객체 삽입 위치 | 일반 응답 |
| 9 | table/row/column OpId + UTF-8, start/end=셀 범위 | 일반 응답 |
| 10, 11 | table OpId + optional after OpId | 행/열 삽입 |
| 12, 13 | table OpId + row/column OpId | 행/열 삭제 |
| 14 | table OpId+column OpId+alignment u8(0/1/2) | 정렬 |
| 16 | scope, start=offset, end=bias(0 before/1 after) | raw anchor |
| 17 | anchor | raw offset u32 |
| 18 | scope, start/end | raw SCE2 capture |
| 19 | capture 길이 u32+capture+UTF-8 교체 문자열 | 일반 응답 |

anchor는 scope+optional left AtomId+optional right AtomId+bias u8이다. SCE2는 magic4+document u128+scope+optional after AtomId+target count u32+AtomId 목록이다. 상세 wire 구현은 `src/collab/codec.rs`를 기준으로 한다. 프로토콜은 실험 단계이며 버전 간 호환을 보장하지 않는다.

## 검증과 남은 경계

Rust 테스트는 역순·중복·단절·세 작성자 무작위 전달, 겹친 삭제·자기 undo, 안정적 표/행/열 ID, 셀 보존, 인과 참조 검증, codec 경계, IME 캡처를 포함한다. Node는 빌드한 실제 WASM과 JS 어댑터를 호출한다. 브라우저 `/collab/tests.html`은 실제 RTCPeerConnection으로 재연결·Unicode 분할 전송·표 병합을 검사하며 허용되지 않은 peer와 잘못된 프레임도 검사한다.

현재 코어는 정확성 검증을 우선해 연산마다 상태를 복사하고 인과 조상을 순회한다. 삭제 atom/로그는 유지되며 100000 연산 한도나 1MiB/연산은 권장 문서 크기·메모리 보장이 아니다. 전체 로그가 16MiB를 넘으면 현재 export/reconnect가 실패하므로 그 전에 체크포인트 설계와 크기 관리가 필요하다. 대규모 문서에 대한 성능 보장은 없다. 실제 TURN relay 강제 경로, 다른 기기·브라우저·OS IME, 지속 저장 호스트, 커서 presence, 첨부 blob, 원본 표 projection, 전체 리치 UI 통합과 checkpoint/GC는 후속 범위다.

## 리치·원본 편집기 통합 (2026-10-23)

```js
import { create_editor } from './editor.js';
import { create_replica, new_identity } from './collab/core.js';
const replica = await create_replica({ document_id: new_identity() });
const editor = await create_editor(container, {
  replica, markdown: '# 문서\n\n내용', mode: 'rich'
});
// 기존 toolbar, set_options, set_view, get_markdown 등을 그대로 사용한다.
// 다른 참가자는 같은 document_id와 위 복제본의 연산 로그를 복원한다.
// WebRTCTransport에는 editor가 아니라 replica를 전달한다.
editor.addEventListener('change', event => {
  console.log(event.detail.origin, event.detail.shared);
});
editor.destroy(); // 로컬 renderer/DOM만 해제. replica 소유권은 호스트에 있다.
replica.destroy();
```

초기 markdown은 비어 있는 복제본에서만 한 번 import한다. 다른 참가자는 각자 초기 문자열을 삽입하지 않고 seed 로그를 병합한다. 비어 있지 않은 복제본이 이미 보유한 내용이 옵션의 markdown보다 우선한다. 단일 사용자 화면은 replica를 생략하면 기존 ABI v1을 사용한다. config_url 설정과 replica를 함께 사용할 수 있으며 살아 있는 editor의 replica는 set_options로 교체할 수 없다.

`collab/editor_core.js`는 공유 문서를 원본 Markdown 좌표에 투영하고 기존 v1 코어는 로컬 파서·정규화·DOM 렌더러로만 사용한다. 공유 history는 v2가 소유하며 v1 snapshot history를 전송하지 않는다. 본문·셀 편집을 각 scope의 atom 명령으로, 표 툴바 조작을 table/row/column ID 명령으로 바꾼다. 복합 조작은 하나의 공유 undo 그룹이다. 상대 위치로 선택·command redo caret를 복원하며, 삭제된 활성 행의 커서는 표 밖으로 이동한다.

리치 셀의 파이프/개행은 셀 원문으로 저장하고 Markdown 투영에서 escape/br로 표시한다. 전체 원본 화면에서 입력한 파이프/개행은 표 문법으로 다시 해석한다. 원본에서 행·열 모양이 달라지면 동일 길이 항목의 위치와 일치하는 앞/뒤 내용을 기준으로 ID를 유지한다. 원본 문자열만으로 동일한 중복 행·열의 이동 의도를 유일하게 추론할 수는 없으며, 확실한 구조 의도는 표 도구의 ID 명령을 사용한다.

헤더보다 셀이 많은 불규칙 GFM 표는 무시된 내용이 사라지지 않도록 초기 import 시 원본 문자 CRDT로 보존한다. 그 표의 구조 도구는 원본에서 열 수를 맞춘 뒤 활성화된다. 표를 고치면 정상 구조 표로 승격한다. 이미 구조화된 표에 열 수가 맞지 않는 원본을 입력하거나 표 구분자가 미완성이면 **로컬 초안**을 유지한다. 완성된 문법으로 고치면 공유 명령으로 적용한다. 초안 동안 원격 변경이 도착하면 자동 적용을 중지하여 덮어쓰기를 막는다.

이 상태는 `change.detail.shared === false`, `editor.get_pending_draft()`와 화면 상태로 확인한다. 저장 버튼은 초안 원문을 그대로 다운로드한다. `editor.discard_pending_draft()`는 보관할 초안 문자열을 반환하고 최신 공유 문서로 돌아간다. UI에도 되돌리기 버튼을 제공한다. 원본 전체 교체/불러오기는 명시적 문서 교체이며 기존 표 ID를 재생성할 수 있다. Markdown 저장만으로 공유 로그·ID가 보존되지 않으므로 호스트는 replica.export_state()와 document_id를 지속 저장해야 한다.

복제본 JS 메서드에 `import_markdown`, `replace_markdown`(원본 문법), `replace_projected_text`(리치 본문/셀), `projected_anchor`, `resolve_projected_anchor`, `projected_capture`, `table_action`을 추가했다. snapshot.projection은 표·셀의 Markdown byte 범위와 문서 객체 위치를 제공한다. ABI op20 import, 21 원본 범위 교체, 22/23 투영 앵커/해석, 24 투영 범위 캡처, 26 구조 표 명령, 28 로컬 history 초기화, 29 redo 초기화, 30 리치 투영 범위 교체다. wire SCV2 연산 형식은 바꾸지 않았다.

통합은 현재 프로토타입의 기존 기능을 공유 상태에 연결한 개발 버전이다. 대용량 첨부 blob 모델·checkpoint·호스트 영구 저장·실제 다중 기기 TURN relay 검증을 완료한 제품 릴리스를 뜻하지 않는다. 공유 텍스트의 1MiB/연산·16MiB/프레임 한도와 비용을 그대로 적용하므로 큰 Base64 첨부는 별도 blob 계층을 구현하기 전 제한될 수 있다.
