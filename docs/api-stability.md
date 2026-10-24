# API 안정성 및 호환성 정책

2026-10-24부터 렌더러·단일 사용자 편집기의 공개 계약은 **API v1**, 협업의 공개 계약은 **API v2**로 고정한다. 이는 명시한 호출·반환·이벤트 계약의 유지 약속이다. GFM 완전 적합성, 모든 환경의 입력 검증, 성능 상한 또는 제품 출시 인증을 뜻하지 않는다. 패키지 버전은 현재 0.1.0이며 API 계약 번호·WASM ABI·협업 프로토콜 번호는 각각 독립적이다.

## 안정 범위

| 구성 요소 | 안정 계약 | 범위 밖 |
| --- | --- | --- |
| 간편 진입점 | `new Sohjae(options)`·ready Promise/이벤트·`Sohjae.get`·호환 init; Editor API v1 | 다중 일치 selector, 내부 로더·registry |
| 렌더러 | `create_renderer({ wasm_url? })`, 반환 객체의 `render(markdown)`·`destroy()`; renderer ABI v1 | `Renderer` 직접 생성, 내부 exports와 메모리 접근, HTML의 정확한 직렬화·DOM 구조 |
| 단일 사용자 편집기 | `create_editor(container, options)`, 아래 메서드·이벤트·문서화한 설정; editor ABI v1 | 내부 속성·DOM·CSS 클래스·보조 함수 |
| 협업 | 공개 Replica·Transport API v2, 공유 UI·초안 API; ABI2·transport3·codec2/schema1 | 내부 dispatcher·DOM, 자동 로그 변환, 임의 과거 빌드의 로그 지원 |

안정 편집기 메서드는 `get_markdown`, `set_markdown`, `get_selection`, `set_selection`, `replace`, `execute_command`, `run`, `set_options`, `get_options`, `mark_saved`, `focus`, `destroy`, `get_pending_draft`, `discard_pending_draft`다. 세부 서명·옵션·명령은 [편집기 API](api.md)와 [설정](configuration.md)을 따른다. `set_selection`의 세 번째 내부 인수, `set_view`, `state`, `core`, `root`, `surface`, `selection`은 안정 API에 포함하지 않는다. 화면 전환은 사용자 UI로 제공하며 필요하면 별도 공개 API로 추가한다.

## 호출 및 오류 계약

- 두 생성 함수는 Promise를 반환한다. 파일 로드·ABI 불일치·잘못된 필수 설정은 reject한다. 생성 실패 시 생성한 코어 세션을 해제한다. 비어 있는 Element 또는 `destroy()`한 편집기 컨테이너를 사용한다.
- 렌더러 `render(string)`은 동기 HTML 문자열 반환이며 비문자열은 TypeError다. `destroy()`는 반복 호출 가능하고 이후 render는 Error다. 동시 인스턴스의 메모리는 독립적이다.
- 편집기 문서·선택·설정 메서드는 동기다. `execute_command`는 Promise를 반환하고 실패 시 reject한다. `run`은 UI용 Promise이며 실패를 잡아 Error를 담은 `error` 이벤트로 전달한다.
- `destroy()`는 반복 호출 가능하다. 나머지 안정 편집기 메서드는 종료 후 Error를 던지며 `execute_command`는 reject한다. `run`은 종료 후에도 `error` 이벤트로 전달한다. EventTarget 자체의 구독·해제 기능은 계속 사용할 수 있다.
- `set_markdown`과 `replace`의 텍스트는 문자열이어야 한다. 편집 좌표는 LF로 정규화한 원문의 UTF-8 바이트 위치다. 음수·소수·NaN·u32 초과·문자 중간 좌표는 거절한다. `revision`은 BigInt이며 JSON에 직접 넣지 않는다.
- `replace(text, start?, end?, caret?)`에서 caret은 교체 결과의 유효한 UTF-8 위치를 전달한다. 잘못된 caret이나 교체 범위는 문서를 변경하지 않고 거절한다.
- `set_markdown`은 history와 선택을 초기화한다. 읽기 전용은 사용자 편집 보호이며 호스트의 명시적 문서 교체는 허용한다. IME 조합 중 문서 교체는 거절하고 `replace`와 편집 명령은 실행하지 않으며 설정 변경은 조합 종료까지 연기한다.
- `get_markdown`의 기본값은 `{ normalize: true }`다. 내보내기는 문서·선택·history·revision을 변경하지 않는다. 정규화 결과와 렌더링 결과의 정확한 문자열은 문법 오류 수정으로 바뀔 수 있다.
- 설정은 문서화한 형식으로 전달한다. `get_options`의 설정 사본 변경은 편집기에 적용되지 않는다. `replica` 변경은 새 인스턴스가 필요하다. 알 수 없는 명령은 TypeError로 거절한다. 알 수 없는 옵션·내부 속성의 동작은 보장하지 않는다.
- 오류의 Error 계열 및 전달 경로를 계약으로 유지한다. 오류 메시지 전문·스택·내부 코어 진단 문자열은 안정 식별자가 아니다.

`change`는 편집·undo·redo 처리와 상태 갱신 후 동기적으로 발생한다. detail의 `revision`은 최신 BigInt, `dirty`는 boolean이다. 문서 설정·선택 이동·`mark_saved()`에 대한 change 알림은 보장하지 않는다. 호스트가 `set_markdown`한 문서는 호스트가 직접 상태를 갱신한다. `save`는 파일 다운로드 동작 후 `{ markdown }`을 알리며 서버 저장 완료 신호가 아니다. 비동기 저장 시 전송 revision과 현재 revision이 같은 경우에만 `mark_saved()`한다.

## 변경 정책

- 같은 패키지 major에서 위 안정 계약을 깨지 않는다. 현재 0.x에도 이 정책을 적용한다. 새 선택적 옵션·메서드·이벤트 필드 추가는 minor, 호환 가능한 오류·보안 수정은 patch로 배포한다.
- 삭제·이름 변경·기존 기본값 또는 반환 형식의 비호환 변경은 major에서만 한다. 기존 API는 먼저 문서에서 deprecated로 알리고 최소 한 번의 minor 배포 동안 유지하며 대체 예제·이전 안내를 제공한다. 보안상 즉시 차단이 필요한 동작은 보안 수정으로 기록한다.
- JS·WASM·CSS는 동일 SDK 배포 묶음을 함께 갱신한다. ABI 번호가 다른 WASM은 로더가 거절한다. 동일 ABI의 모든 과거 JS/WASM 교차 조합을 보장하지 않으며, 혼합 배포는 지원하지 않는다. CDN 캐시에는 배포 버전별 디렉터리 또는 파일 해시를 사용한다.
- 렌더러·편집기·협업 SDK를 독립적으로 사용할 수 있다. 협업 선택 시에만 collaborator WASM과 어댑터를 추가한다. 협업의 변경으로 안정 단일 사용자 메서드를 변경하지 않는다.

## 협업 연결 및 저장 로그

공개 서명·스냅샷·오류 코드·이벤트·상태 전이·wire 태그와 향후 저장 형식 변경 정책은 [협업 프로토콜 안정 계약](collaboration-protocol.md)을 따른다.

WebRTC hello는 `protocol: 3`, `codec: 2`, `schema: 1`을 모두 요구한다. codec 2는 SCV2 바이너리이며 schema 1은 행·열 이동 tag9까지 지원하는 연산 집합이다. 구형 protocol 2 또는 다른 codec/schema는 인증 콜백 및 문서 송신 전에 거절한다. WASM의 `collab_schema_capabilities() == 1`도 요구하므로 구형 WASM과 신형 JS를 섞으면 생성 시 거절한다. 향후 필수 연산/저장 구조 변경은 schema·저장 codec version 및 연결 프로필을 명시적으로 구분하며 기존 로그 reader 또는 변환기를 제공한다.

기존 SCV2 바이트 형식은 변경하지 않았다. 현재 reader가 이해하는 연산만 포함한 기존 로그는 그대로 merge할 수 있다. `spec/api/scv2-schema1.bin`은 안정화 전 빌드에서 생성한 한글·이모지·구조 표·행 이동 로그이며 원본을 재생성하지 않고 복원 회귀 검사에 사용한다. 미래 codec/schema 전환 시 이 fixture 지원 유지 또는 별도의 명시적 변환기를 제공해야 한다. 알 수 없는 버전·잘못된 문서·손상된 프레임은 문서 변경 없이 거절한다. 유효한 프레임 내부의 개별 잘못된 연산은 기존 격리 규칙을 따른다.

호스트는 원본 로그와 `document_id`, 사용한 SDK 버전을 함께 백업한다. 변환이 필요하면 구버전 reader로 원본을 읽고 새 파일로 변환·검증한 뒤 전환하며, 원본을 덮어쓰지 않는다. 현재 자동 마이그레이션 도구는 없으며 Markdown 내보내기·재가져오기는 CRDT ID·history를 유지하는 로그 변환이 아니다. 체크포인트·로그 압축·blob 저장·자동 재연결은 별도 기능이다.

## 검증 및 배포 점검

- `node scripts/check_api_contracts.mjs`: 실제 WASM ABI 거절, 인스턴스 격리, 좌표 입력, 저장 fixture 복원·원자적 거절, 협업 handshake 호환성 검사. `scripts/build.sh`에서 Node가 있으면 실행한다.
- `/api-contracts.html`: 실제 브라우저에서 공개 API의 선택·revision·이벤트·설정·IME·종료·생성 실패 계약을 검사한다. 합성 IME 이벤트 검사는 실제 OS IME 검증을 대신하지 않는다.
- 기존 `/tests.html`, `/collab/rich-tests.html`, `/collab/tests.html`과 각 WASM 검사를 함께 통과시킨다.
- API 변경 시 계약 문서·회귀 fixture·SDK 패키지 포함 파일을 함께 검토한다. 버전 변경과 외부 release 등록은 별도 배포 작업이다.

## 단일 사용자 계약 보강 (2026-10-24)

`editor.d.ts`로 안정 메서드·설정·명령·이벤트를 선언하고 SDK에 포함한다. 타입 확인과 실행 시 검증은 함께 유지한다. 생성 전 설정 검증·컨테이너 생성 잠금, 원본 옵션과 URL 사본, 조합 중 설정 누적, 생성 전용 옵션 변경 거절, 알 수 없는 명령 거절과 지연된 파일 읽기 보호를 계약으로 추가했다. 구체적인 사용법은 [단일 사용자 API 가이드](single-user-api.md)를 따른다.

## 협업 계약 고정 (2026-10-24)

Replica·Transport 타입 선언과 고정 프로필을 제공한다. 스냅샷은 깊은 읽기 전용이고 종료는 반복 가능하다. core와 transport 오류는 고정 code로 분기한다. 호스트 인증·시그널링·TURN·영구 저장 및 제품 환경 검증은 API 계약과 구분한다. 전체 tag0~9의 고정 저장 fixture와 독립 참조 reader, 실제 WASM·3인 WebRTC 재연결 검사를 추가했다.

## 간편 진입점 (2026-10-25)

클래식 스크립트 `sohjae.js`의 init/get과 textarea 폼·reset·종료 연동을 [간편 시작](quick-start.md)의 계약으로 제공한다. 내부 모듈·CSS·WASM은 동일 SDK에서 자동 로드하며 기존 모듈 API와 분리 배포 구조를 유지한다. 새 진입점은 HTTP(S)용이고 기존 self-contained 파일 예제는 유지한다.

## 생성자 초기화 (2026-10-25)

`new Sohjae({ selector })`를 기본 진입점으로 제공한다. 즉시 반환한 handle의 ready Promise는 같은 handle로 resolve하며, ready 이벤트 이후 Editor API를 호출할 수 있다. 로딩 실패는 ready reject와 error 이벤트로 전달한다. 초기화 중 destroy는 초기화 결과를 정리하고 AbortError로 reject한다. 기존 init(options): Promise<Editor>는 유지하며 get은 생성자 handle 또는 기존 init 결과를 반환한다.
