# 협업 API v2 및 프로토콜 안정 계약

2026-10-24부터 이 문서의 공개 협업 API·ABI·wire 프로필을 고정한다. `COLLABORATION_PROFILE`은 읽기 전용 `{ api: 2, abi: 2, protocol: 3, codec: 2, schema: 1 }`이다. API 계약 번호, WASM ABI, WebRTC 연결 버전, 저장 코덱과 연산 스키마는 서로 다른 번호다. SDK 패키지 버전은 현재 0.1.0이며, 안정 API 유지 정책은 0.x에도 적용한다.

## 공개 범위

- `collab/core.js`: `create_replica`, `new_identity`, UTF-8/UTF-16 변환 함수, `COLLABORATION_PROFILE`, `CollaborationError`, 반환 Replica의 문서·표·투영·앵커·캡처·history·저장 메서드와 이벤트. 정확한 서명은 `collab/core.d.ts` 및 [협업 API](collaboration_api.md)를 따른다.
- `collab/webrtc.js`: `WebRTCTransport` 생성자, 읽기 전용 `ready`·`closed`, `close`, `ready`·`sync`·`close`·`error` 이벤트와 `TransportError`. 서명은 `collab/webrtc.d.ts`를 따른다.
- 편집기: `create_editor(container, { replica })`와 `get_pending_draft`·`discard_pending_draft`, 기존 편집기 API의 공유 문서 동작. replica는 같은 SDK의 살아 있는 `create_replica` 결과여야 한다. 편집기를 해제해도 호스트 소유 replica는 해제하지 않는다. 단일 사용자 화면의 초안 조회·폐기는 null이다.
- 내부 `request`, exports·handle·WASM 메모리 접근, `SharedEditorCore`, 내부 DOM·CSS 클래스와 정확한 HTML 문자열은 안정 API가 아니다. `CollaborativeReplica` 직접 WASM 생성, `connect_local_pair`, `bind_field`는 검증용 저수준 도구로 공개 안정 범위에서 제외한다.

## 코어 호출·스냅샷·이벤트

`create_replica`는 Promise이며 잘못된 identity는 WASM 다운로드 전에 거절한다. 문서/작성자 ID는 0이 아닌 32자리 hex다. 독립 참가자는 다른 actor를 사용한다. ID는 인증 수단이 아니다. 호스트는 동일 문서의 seed 로그를 전달하고 최초 본문 삽입은 한 번만 한다.

공개 메서드는 동기이며 실패 시 예외다. 문자열 입력은 LF로 정규화한다. 본문·셀 좌표는 각 scope의 UTF-8 바이트이고 투영 좌표는 `snapshot.markdown`의 UTF-8 바이트다. 본문의 U+FFFC 구조 표 토큰과 Markdown 표 문자열은 좌표가 다르다. `merge`·앵커·캡처 입력은 Uint8Array만 받는다. 잘못된 문자열·scope·bias·정렬·표 ID·좌표는 거절한다. 다른 문서 또는 손상된 SCV2 프레임을 거절할 때 기존 문서·로그·history를 보존한다. ABI는 연산뿐 아니라 응답 직렬화에 실패한 경우에도 변경을 되돌린다. panic·프로세스 종료·메모리 부족으로 인한 중단의 복구를 뜻하지 않는다.

`snapshot`과 반환 스냅샷은 중첩 배열·객체까지 읽기 전용이다. 새 요청은 새 스냅샷을 설치하며 기존 참조는 이전 상태를 유지한다. `snapshot.text/markdown/html`, `tables`, `projection`, `frontier`, `pending`, `rejected`, `operation_count`, `can_undo/can_redo`, `document_id/actor_id`의 타입과 의미를 유지한다. 내부 handle은 공개 타입에서 제외한다. HTML의 정확한 직렬화는 고정하지 않는다.

일반 응답 요청은 스냅샷 설치 → 동기 `change({ snapshot, origin })` → 새 로컬 연산이 있으면 `update(Uint8Array)` 순서다. merge의 origin은 remote이며 update를 재발행하지 않는다. 중복 merge도 change를 발생시킬 수 있으므로 change 횟수를 새 연산 수로 해석하지 않는다. export·앵커·캡처 조회와 coalesce_history는 change/update를 발생시키지 않는다. clear_local_history는 상태 갱신 알림만 발생시키고 네트워크 연산은 만들지 않는다.

이벤트 처리 중 snapshot 읽기, export와 앵커/캡처 조회는 가능하다. 편집·merge·undo·destroy 등 재진입 변경은 `CollaborationError.code === 'ReentrantCall'`로 거절한다. 변경이 필요하면 queueMicrotask로 현재 이벤트 전달 이후 실행한다. update 바이트는 WASM 메모리와 독립된 사본이지만 같은 이벤트의 구독자가 공유하므로 처리기 안에서 수정하지 않는다. 수정·비동기 보관에는 `event.detail.slice()`를 사용한다.

`destroy()`는 반복 호출 가능하고 destroy 이벤트는 한 번 발생한다. 연결된 transport도 닫힌다. 마지막 snapshot은 진단용으로 계속 읽을 수 있다. 종료 후 유효한 다른 메서드 호출은 `Destroyed` 오류다. 편집 UI → transport → replica 순서로 해제하는 것을 권장한다. UI를 유지한 채 replica를 먼저 해제한 뒤 편집하는 것은 지원하지 않는다.

TypeError는 입력 형태, RangeError는 숫자·버퍼 한도 검증 오류다. CollaborationError의 code는 타입 선언의 고정 union을 따르며 core 오류명(InvalidBoundary, WrongDocument, NoHistory 등)과 UnsupportedABI, UnsupportedSchema, Destroyed, ReentrantCall을 제공한다. 문자열 메시지·스택은 안정 식별자가 아니다. undo/redo 이력이 없으면 NoHistory이며 호스트는 can_undo/can_redo로 확인한다.

## 연결 상태와 소유권

생성자는 살아 있는 replica, open 또는 connecting 상태의 ordered/reliable RTCDataChannel, 필수 authorize_peer 콜백을 받는다. 채널은 해당 transport가 소유하며 close 시 닫는다. RTCPeerConnection·인증·시그널링과 replica의 소유권은 호스트에 남는다. handshake_timeout_ms는 1~2147483647 정수이고 기본 15000ms다.

1. 채널 open 시 hello를 한 번 보낸다.
2. hello의 프로필·문서·다른 actor를 검사한 뒤 authorize_peer를 호출한다.
3. 콜백이 true로 완료한 뒤에만 전체 로그를 보낸다. false·예외·시간 초과 시 닫는다.
4. 초기 로그를 전송 큐에 넣는 데 성공한 후 ready 이벤트가 발생한다. ready는 인증된 채널이 준비되었다는 의미이며 상대의 적용 완료를 뜻하지 않는다.
5. 완성된 업데이트를 적용하면 sync에 최신 snapshot을 전달한다. pending=0과 호스트의 기대 상태를 함께 확인한다.
6. close는 반복 가능하고 한 번만 알린다. 실패 시 상태를 닫고 close 이벤트 후 error 이벤트를 전달한다. 초기 송신 실패 시 ready는 발생하지 않는다. 인증 대기 중 닫힌 연결은 인증이 늦게 성공해도 다시 열리지 않는다.

오류는 TransportError이며 code는 CHANNEL_ERROR, RESOURCE_LIMIT, TIMEOUT, INVALID_FRAME, UNSUPPORTED_PROTOCOL, IDENTITY_MISMATCH, UNAUTHORIZED, INVALID_OPERATIONS, SYNC_FAILED다. ready/closed는 호스트가 변경할 수 없다. 오류 후 자동 재연결은 없고 새 채널에 새 transport를 연결한다. 기존 replica는 유지해 오프라인 연산을 보존한다.

## WebRTC hello v3

첫 메시지는 아래 필드를 가진 JSON 문자열이다. 객체 키 순서는 계약이 아니며 알 수 없는 추가 필드는 무시한다. protocol/codec/schema는 아래 값과 정확히 같아야 하며 identity는 소문자 32자리 hex다. 자기 actor 또는 다른 문서를 거절한다.

```json
{"type":"hello","protocol":3,"codec":2,"schema":1,"document_id":"00000000000000000000000000000011","actor_id":"00000000000000000000000000000022"}
```

구형 protocol2나 다른 codec/schema에는 자동 downgrade하지 않는다. 중복 hello, 인증 전 binary 메시지와 잘못된 JSON을 거절한다. 인증 콜백에는 읽기 전용 hello를 전달한다. DataChannel 메시지는 문자열 또는 ArrayBuffer여야 한다.

## 분할 프레임

binary 메시지의 앞 20바이트는 다음 u32 little-endian 헤더다.

| 오프셋 | 값 |
| --- | --- |
| 0 | magic 0x32564353 (바이트 SCV2) |
| 4 | transfer_id; 송신 연결마다 증가하는 u32, wrap 허용 |
| 8 | index; 0부터 |
| 12 | count = ceil(total / 12288) |
| 16 | total; 재조립 후 SCV2 바이트 길이 |

나머지는 최대 12288바이트 payload다. total은 26~16777216바이트다. 마지막 payload는 남은 길이와 정확히 같아야 한다. 하나의 ordered 채널은 한 업데이트의 조각을 순서대로 보내며 서로 겹치지 않는다. index·transfer_id·count·total 불일치, 중간부터 시작, 중복 조각, 중첩 전송과 잘못된 magic을 거절한다. 조각 재조립은 30초 안에 완료해야 한다.

송수신 대기 큐 한도는 각각 32MiB이며 송신은 헤더 비용도 포함한다. bufferedAmount가 512KiB 이상이면 큐를 멈추고 128KiB low threshold 이벤트에서 재개한다. 제한 초과 시 닫고 재연결로 재동기화한다. handshake 문자열도 같은 메시지 크기 검사를 적용한다(UTF-16 코드 단위당 2바이트로 보수적으로 계산). 프레임은 SCV2 payload를 변경하지 않는다.

## 저장 코덱 SCV2 v2, 연산 스키마 1

모든 정수는 little-endian이며 모든 길이는 u32 바이트/항목 수다. 헤더는 magic4(SCV2) + version u16(2) + document u128 + operation_count u32로 26바이트다. 연산은 OpId + dependency_count u32 + dependency OpId 목록 + tag u8 + payload다.

- OpId = counter u64 + actor u128 (24바이트), AtomId = OpId + Unicode scalar index u32 (28바이트). 문자열은 UTF-8이다.
- scope는 tag0(본문) 또는 tag1 + table/row/column OpId다. optional은 flag u8(0 또는 1) 뒤에 선택적인 값을 둔다. boolean은 0/1만 허용한다.
- 태그별 payload는 아래와 같다. 이 표의 필드 순서·크기와 기존 태그의 의미를 변경하지 않는다.

| tag | 연산 | payload |
| --- | --- | --- |
| 0 | InsertText | scope + optional after AtomId + text byte length u32 + text |
| 1 | DeleteText | scope + target_count u32 + target AtomId 목록 |
| 2 | CreateTable | optional after AtomId |
| 3 | InsertRow | table OpId + optional after OpId |
| 4 | InsertColumn | table OpId + optional after OpId |
| 5 | DeleteRow | table OpId + row OpId |
| 6 | DeleteColumn | table OpId + column OpId |
| 7 | SetAlignment | table OpId + column OpId + alignment u8 (0 left / 1 center / 2 right) |
| 8 | SetActive | target OpId + active boolean |
| 9 | Reorder | table OpId + columns boolean + target_count u32 + target OpId 목록 + optional before OpId |

삭제는 tombstone이며 undo는 자기 연산의 활성 상태를 바꾼다. 행·열 이동의 충돌은 OpId 전체 순서로 결정하고 원격 셀 편집을 보존한다. 중복 ID의 동일 연산은 무시하고 다른 내용이면 IdCollision이다. 알려지지 않은 tag·version, 잘린 필드, 잘못된 boolean·UTF-8·identity, 잉여 바이트는 거절한다.

인과 선행 연산이 없으면 pending에 대기한다. 유효한 프레임 안의 논리적으로 잘못된 연산은 격리하고 rejected 수를 알린다. 같은 프레임의 다른 유효 연산은 적용될 수 있다. transport는 rejected가 있으면 INVALID_OPERATIONS로 연결을 닫는다. 손상된 코덱 프레임의 원자적 거절과 개별 연산 격리를 혼동하지 않는다.

## 보존·변경·호스트 책임

SCV2 codec2/schema1을 안정 저장 형식으로 보존한다. export는 적용 로그와 pending을 포함하며 로컬 undo/redo 스택·presence·초안은 포함하지 않는다. 복원은 같은 document_id와 새 actor로 생성 후 merge한다. 로그에 적용된 undo 연산은 문서 상태로 복원되지만 새 actor의 undo 이력은 새로 시작한다. 호스트는 원본 로그, document_id와 프로필을 함께 보관한다.

기존 tag0~9의 필드와 의미는 같은 codec/schema 안에서 변경하지 않는다. 새 필수 연산·다른 저장 구조를 도입하려면 schema와 저장 codec version을 함께 올리고 연결 프로필도 명시적으로 구분한다. 기존 reader 유지 또는 별도 변환기를 제공하며 원본 로그를 덮어쓰지 않는다. API의 비호환 변경은 SDK major에서만 한다. 같은 프로필의 향후 호환 SDK는 아래 fixture를 계속 읽어야 한다. 임의 과거 개발 빌드의 손상된/다른 스키마 로그까지 지원하는 것은 아니다.

고정 fixture는 `spec/api/scv2-schema1.bin`과 `spec/api/scv2-all-operations.bin`이다. 전자는 안정화 전 로그, 후자는 모든 태그와 한글·이모지·구조 표·자기 undo·행/열 이동을 포함한다. 빌드 중 재생성하지 않는다. 독립 JS 참조 reader로 태그·필드 경계를 읽고 실제 WASM의 복원·재출력 바이트 동일성을 검사한다.

제한은 1MiB/텍스트 연산, 16MiB/업데이트·export, 100000 로그 연산과 4096 인과 대기/이동 대상이다. 표 최초 크기는 각 1~100이다. 전체 로그가 16MiB를 넘으면 export/reconnect가 실패할 수 있어 호스트가 크기를 관리해야 한다. 메모리·문서 크기·처리 시간의 성능 보장이 아니며, 원자적 오류 복원을 위해 ABI에서도 변경 전 상태를 복사한다.

호스트는 사용자 인증·방 권한·시그널링·STUN/TURN·영구 저장을 제공한다. 전달된 로그의 모든 작성자에 대한 서명 검증은 제공하지 않는다. 자동 재연결, 로그 압축/GC/체크포인트, 대용량 첨부 blob, presence와 악의적인 방 참가자 간 권한 격리는 별도 범위다. 3인 이상은 full mesh 또는 호스트의 별도 relay/중복 방지 계층이 필요하다. 이번 안정 계약은 모바일·다중 기기 TURN relay·모든 OS 입력기의 출시 검증을 대신하지 않는다.

## 검증

`node scripts/check_collab_contracts.mjs`는 고정 코덱·API lifecycle·오류·인증·분할·역압·초기 실패를 검사하며 build.sh에 포함한다. `scripts/check_collab_types.ts`는 TypeScript strict 정상/부정 예제다. `/collab/tests.html`은 실제 WebRTC의 2인/3인 오프라인 편집·재연결·표·분할 전송·종료를, `/collab/rich-tests.html`은 공유 UI 통합을 검사한다. 합성 IME 검사는 실제 OS 입력기 검증을 대신하지 않는다.

## 기존 개발 버전에서 이전

JS·WASM·타입 선언을 같은 배포 묶음으로 교체한다. 기존 codec2/schema1 로그는 변환 없이 그대로 merge한다. 구형 protocol2 연결은 지원하지 않으므로 참가자 양쪽의 자산을 함께 갱신한다. 호스트가 snapshot을 직접 수정하던 코드는 replace_text·표 명령으로 바꾸고, change/update 이벤트 안에서 편집하던 코드는 queueMicrotask로 연기한다. 오류 문자열 비교는 code 비교로 바꾼다. 중복 destroy/close 방어 코드는 유지해도 된다. 초기 ready만으로 저장 복원 완료를 가정하지 말고 sync와 pending 및 기대 문서 상태를 확인한다.
