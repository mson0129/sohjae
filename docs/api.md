# 임베딩 API와 WASM ABI v1

브라우저 모듈은 `web/editor.js`다. 단일 사용자 공개 API는 API v1 계약으로 고정했다. 안정 범위·오류·변경 정책은 [API 안정성](api-stability.md)을 따른다. 공유 replica 옵션과 초안 API는 협업 API v2 계약을 따르며 내부 속성은 안정 범위에서 제외한다. 파일들을 HTTP(S)로 제공하고 WASM은 `application/wasm`, JS는 JavaScript MIME으로 제공한다.

## 간편 스크립트 진입점

`<script src="./sohjae/sohjae.js"></script>`를 불러오고 `new Sohjae({ selector: "#editor" })`로 Editor API를 제공하는 인스턴스를 생성할 수 있다. 인스턴스는 즉시 반환하며 메서드는 `await editor.ready` 이후 호출한다. CSS·WASM 경로, textarea 폼 연동과 종료 처리는 [간편 시작](quick-start.md)을 따른다. 기존 ES module 진입점은 유지한다.

## 브라우저 API

`await create_editor(container, options)`는 에디터를 반환한다. 비어 있는 요소 또는 이전 에디터를 `destroy()`한 요소를 전달한다. 여러 인스턴스는 독립적인 WASM 인스턴스와 history를 사용하고 컴파일된 모듈만 URL별로 캐시한다. `config_url`을 전달하면 JSON 설정을 읽고 생성 시 객체로 덮어쓴다.

| API | 동작 |
| --- | --- |
| `get_markdown({ normalize: true })` | 정규화한 저장 문자열. 문서·선택·history 불변 |
| `get_markdown({ normalize: false })` | 현재 원문 |
| `set_markdown(source)` | 새 문서, history·선택 초기화, revision 증가. 조합 중에는 거절 |
| `get_selection()` | `{ anchor, focus, revision }`; UTF-8 바이트와 BigInt revision |
| `set_selection(anchor, focus = anchor)` | 코드 포인트 경계 검증 후 선택 변경 |
| `replace(text, start?, end?, caret?)` | 현재 선택 또는 명시한 UTF-8 범위 교체. 읽기 전용·조합 중 실행 안 함 |
| `execute_command(command)` | Promise를 반환하는 명령 실행; 호출자가 오류 처리 |
| `run(command)` | UI용 명령 실행. 실패를 `error` 이벤트와 상태 영역으로 전달 |
| `set_options(partial)` | 설정 병합·검증. 조합 중 변경은 누적하고 종료 시 적용 |
| `get_options()` | 설정 사본 |
| `get_pending_draft()` | 공유되지 않은 로컬 초안 문자열 또는 null |
| `discard_pending_draft()` | 초안 폐기 후 문자열 반환, 없으면 null. 단일 사용자는 항상 null |
| `mark_saved()` | 호스트 저장 성공 후 미저장 표시 해제 |
| `focus()` | 마지막 선택 위치로 편집 포커스 복원 |
| `destroy()` | 이벤트·코어 세션 해제·DOM 비우기. 반복 호출 가능 |

`set_markdown`은 열린 대화상자를 취소한다. 첨부를 읽는 동안 revision이 바뀌면 삽입을 거절한다. 비동기 호스트 저장은 전송 시 revision을 기억하고, 성공 시 현재 revision과 비교한 뒤 `mark_saved()`를 호출해야 한다.

이벤트는 에디터 EventTarget에서 발생한다.

- `change`: `detail: { revision, dirty }`. 편집·undo·redo 후 발생.
- `error`: `detail`에 Error 객체.
- `save`: 다운로드 동작 후 `detail: { markdown }`. 서버 영구 저장 완료 알림은 아님.

호스트 저장은 `get_markdown()`과 `mark_saved()`를 사용한다. 기본 저장은 파일 다운로드다. 저장 시 내부 문서를 재작성하지 않아 선택이 이동하지 않는다.

## 명령과 키

`undo`, `redo`, `heading_1`~`heading_6`, `paragraph`, `bold`, `italic`, `strikethrough`, `highlight`, `inline_code`, `code_block`, `quote`, `list`, `ordered_list`, `task`, `indent`, `outdent`, `hard_break`, `link`, `unlink`, `open_link`, `table`, `table_tools`, `attachment`, `footnote`, `alert`, `details`, `comment`, `line_numbers`, `heading_levels`, `paragraph_marks`, `copy_markdown`, `open`, `save`를 제공한다.

Ctrl 또는 macOS Cmd를 `mod`로 취급한다. 기본 키는 `mod+b/i/k/z`, `mod+shift+z`·`mod+y`, `mod+1`~`6`, 대체 제목 키 `mod+alt+1`~`6`, `mod+s`, `mod+shift+c/u/x`다. `mod+shift+p` 명령 팔레트에서 모든 도구를 실행한다. `keybindings`로 조합 문자열에 명령을 매핑한다. 브라우저가 가로채는 키는 강제할 수 없다.

Tab은 표 셀 → 목록 들여쓰기 → 기본 포커스 이동 순이다. Shift+Tab은 역방향이다. Esc는 편집 영역에서 방식 선택 UI로 이동한다. 대화상자의 Esc는 취소·편집 위치 복원이다.

## WASM ABI

export: `abi_version()`, `reserve_input(length)`, `dispatch(op, handle, revision, start, end)`, `output_pointer()`, `output_length()`, `memory`.

- 버전 1. 포인터·길이·handle·op·상태는 u32, revision은 u64(JavaScript BigInt).
- `reserve_input`으로 확보한 버퍼 전체에 UTF-8을 쓰고 `dispatch` 호출. 빈 요청도 길이 0을 reserve하여 이전 입력을 제거한다.
- 입력·문서 각각 최대 32MiB. 초과 reserve는 null, 잘못된 UTF-8·문자 중간 위치는 오류.
- 버퍼는 코어 소유이며 다음 export 호출로 재할당되거나 memory가 커질 수 있다. JS view는 호출 사이에 보관하지 않는다. `core.js`는 응답을 즉시 복사한다. 입력·출력 버퍼는 다음 호출에서 재사용한다.
- 입력 원문의 CRLF/CR 개행은 LF로 정규화한다. 위치는 정규화된 원문의 UTF-8 좌표다.
- 문자열은 little-endian u32 바이트 길이 + UTF-8이다.

| op | 작업 |
| --- | --- |
| 0 / 1 | 세션 생성 / 제거 |
| 2 | 새 문서 불러오기 |
| 3 | 입력 문자열로 start/end 교체 |
| 4 | anchor/focus 선택 설정 |
| 5 / 6 | undo / redo |
| 7 | snapshot |
| 8 | 정규화 원문 내보내기 |
| 9 | 저장 완료 기준 지정 |
| 10 | 자동 변환 undo: 이스케이프 원문으로 교체, redo에 변환 상태 기록 |
| 11 | 명령의 최종 선택 지정(redo 복원 위치 포함) |
| 12 | 인접 로컬 history 병합(문서·revision 불변) |

변경·선택·불러오기·저장 기준 변경은 현재 revision과 일치해야 한다. 새 문서를 불러와도 revision과 노드 ID를 되돌리지 않는다.

snapshot: handle(u32), revision(u64), anchor(u32), focus(u32), flags(u32), 문자열 3개(source, 안전한 HTML, layout 이름) 순. flags bit 0/1/2는 can_undo/can_redo/dirty다. op 4/11/12는 문자열 없는 24바이트 헤더만 반환해 커서 이동 시 재렌더링을 피한다. op 8은 문자열 하나, op 1은 빈 응답이다.

오류 status: 1(입력), 2(handle), 3(편집 거절), 4(미지원 op). 오류 응답은 메시지 문자열 하나다. panic을 오류 프로토콜로 사용하지 않는다. `unsafe` 포인터 역참조는 구현에 없다.

## 협업 복제본 옵션

`create_editor(container, { replica, ...options })`는 동일한 리치·하이브리드·Markdown·원본 UI를 v2 공유 문서에 연결한다. replica 생략 시 이 문서의 기존 v1 동작을 유지한다. `change.detail`에 origin(local/remote)과 shared(boolean)를 추가했다. 공유되지 않은 원본 초안은 get_pending_draft()/discard_pending_draft()로 다룬다. 소유권·초기화·표 투영과 한도는 [협업 API](collaboration_api.md)를 참고한다.

## 표 순서 이동

표 핸들 클릭은 행/열 선택, 드래그는 순서 이동, Shift+드래그는 범위 선택이다. 포커스한 핸들에서 Alt+방향키로 이동할 수 있다. 표 도구에도 선택 행 위/아래·선택 열 왼쪽/오른쪽 이동 명령이 있다. 머리행은 고정한다. 단일 사용자와 replica UI 모두 지원하며 협업에서는 안정 ID 이동 연산을 사용한다. 상세 충돌·호환성 규칙은 [협업 API](collaboration_api.md)를 따른다.

## 입력 history와 렌더 캐시

ABI op12는 최신 로컬 history 두 항목을 합친다. revision을 검증하며 문서·선택을 바꾸지 않고 24바이트 헤더만 반환한다. UI는 같은 입력 종류·커서·문맥의 750ms 이내 입력에 사용한다. 직접 replace() 호출·붙여넣기·Enter·명령·IME는 묶지 않는다. v1 인스턴스의 RenderCache는 독립 문단을 재사용하고 문맥 의존 문서는 전체 파싱한다. 정규화 내보내기는 문서와 history를 변경하지 않으며, 읽기 의미가 달라지는 후보는 원문을 반환한다.

## 편집기 WASM 파일명

편집기 배포 파일은 `sohjae_editor.wasm`이다. 기본 JS 로더는 이 파일을 사용하고 공유 replica 로더는 별도 `sohjae_collaborator.wasm`을 사용한다. 공유 리치 UI의 로컬 편집/투영 로더는 `sohjae_editor.wasm`을 함께 사용한다. 이전 이름을 직접 지정한 `wasm_url` 또는 호스트 배포 설정은 새 파일명으로 갱신해야 한다. Cargo 내부 빌드 산출물 이름은 crate 이름에 따라 유지하고 빌드 스크립트가 배포 파일명으로 복사한다.

`create_editor`의 선택적 `css_text` 문자열은 호스트가 CSS를 직접 제공할 때 사용한다. 생략하면 기존 editor.css URL을 fetch한다. self-contained 예제는 file://의 CSS fetch 제한을 피하기 위해 이를 사용한다.

## 단일 사용자 타입 선언 및 연동 계약

SDK의 `editor.js` 옆에 `editor.d.ts`를 제공한다. `Editor`, `EditorOptions`, `EditorOptionsPatch`, `EditorSelection`, `EditorCommand`, `EditorEventMap`을 import type으로 가져올 수 있다. 내부 DOM·state·core는 반환 Editor 타입에 노출하지 않는다. 공개 호출·설정·오류·연동 예제는 [단일 사용자 API 가이드](single-user-api.md)를 참고한다.

알 수 없는 명령과 잘못된 타입의 명령은 문서를 변경하지 않고 TypeError로 reject한다. `run()`은 동일 오류를 `error` 이벤트로 전달한다. 설정 키 바인딩도 문서화한 명령만 허용한다. `get_markdown()`의 normalize는 boolean만 허용한다.

`execute_command('open')`의 Promise는 파일 선택 UI 요청까지만 나타낸다. 실제 파일 읽기 실패는 `error` 이벤트다. 파일 읽기 완료 전에 revision이 바뀌면 새 문서를 보호하기 위해 가져오기를 거절하며, 종료된 편집기에 도착한 읽기 결과는 무시한다. `link`, `table_tools` 등의 대화상자와 `attachment`도 사용자 입력 완료를 기다리는 Promise가 아니다.
