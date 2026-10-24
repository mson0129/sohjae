# 단일 사용자 편집기 API v1

`replica` 없이 `create_editor`를 호출하면 `sohjae_editor.wasm`만 사용하는 독립 편집기를 생성한다. 공개 메서드·설정·명령은 [API](api.md), [설정](configuration.md), [호환성 정책](api-stability.md)에 명시한다. `editor.d.ts`는 같은 계약을 TypeScript에 제공하며 JavaScript 사용자에게 추가 런타임 의존성은 없다.

## 생성 및 저장

```ts
import { create_editor, type Editor } from './sohjae/editor.js';

const container = document.querySelector<HTMLElement>('#editor');
if (!container) throw new Error('Missing editor container');
const editor: Editor = await create_editor(container, {
  markdown: '# Document\n\nContent',
  mode: 'hybrid',
  filename: 'notes.md',
  auto_close: { pairs: { bold: true } }
});

editor.addEventListener('change', event => {
  // detail.revision: bigint; detail.dirty: boolean
  updateSaveIndicator(event.detail.dirty);
});
editor.addEventListener('error', event => showError(event.detail.message));

async function saveToHost() {
  const revision = editor.get_selection().revision;
  const markdown = editor.get_markdown();
  await persistMarkdown(markdown); // Implemented by the host application.
  if (editor.get_selection().revision === revision) editor.mark_saved();
}
// updateSaveIndicator/showError/persistMarkdown are host application functions.
// Teardown after pending host save operations have finished:
// editor.destroy();
```

저장 예제의 `persistMarkdown`, `updateSaveIndicator`, `showError`는 호스트가 구현하는 함수다. 다운로드용 `save` 이벤트는 서버 저장 성공을 뜻하지 않는다. 비동기 저장 종료 전에 편집기를 해제할 수 있는 호스트는 자체 종료 플래그로 해제 후 호출을 막아야 한다.

## 문서와 좌표

- `get_markdown()`은 기본적으로 정규화 내보내기다. 정확한 현재 원문은 `{ normalize: false }`로 읽는다. 내보내기는 선택·history·revision을 바꾸지 않는다.
- `set_markdown(source)`는 새 문서로 교체하며 history와 선택을 초기화한다. 호스트가 요청한 교체이므로 `change` 이벤트를 기다리지 말고 호스트 상태를 직접 갱신한다.
- `get_selection()`의 anchor/focus는 UTF-16 인덱스가 아니라 LF 원문의 UTF-8 바이트다. revision은 BigInt다. 예를 들어 `한😀`의 경계는 0, 3, 7이다.
- `set_selection(7, 3)`처럼 역방향 선택을 유지할 수 있다. `replace('글')`은 현재 선택 범위를 교체한다. 명시적 범위를 사용할 때는 `replace('글', 3, 7, 6)`처럼 시작·끝·교체 결과 커서를 함께 지정한다.
- 음수·소수·NaN·문자 중간 위치·범위 밖 위치는 거절한다. 잘못된 교체 범위 또는 결과 커서는 문서·선택·revision을 변경하지 않는다.

## 설정과 명령

`EditorOptions`는 생성 옵션, `EditorOptionsPatch`는 실행 중 변경 가능한 설정이다. `markdown`, `config_url`, `wasm_url`, `css_text`, `replica`는 생성 전용이다. 원본 옵션과 `get_options()` 반환 객체를 수정해도 실행 중인 설정은 바뀌지 않는다.

IME 조합 중 `set_options()` 요청은 누적하며 같은 키는 마지막 값이 우선한다. 조합이 끝나기 전 `get_options()`는 기존 설정을 반환한다. 잘못된 요청은 이미 대기 중인 유효한 변경을 지우지 않는다. 읽기 전용과 조합 중 편집 거절 범위는 기존 API 계약을 따른다.

`execute_command`는 문서화한 명령만 허용한다. 알 수 없는 명령은 TypeError로 reject하고 `run`은 오류 이벤트로 전달한다. 파일 선택·대화상자 명령의 Promise는 사용자 상호작용 전체 완료를 뜻하지 않는다. 늦게 끝난 파일 읽기는 변경된 문서나 종료된 인스턴스를 덮어쓰지 않는다.

## 이벤트 및 종료

`change` 이벤트에서 최신 문서·선택을 읽을 수 있다. 이벤트 처리기에서 문서 변경 명령을 재진입 호출하거나 즉시 해제하지 말고 `queueMicrotask()` 등으로 현재 호출이 끝난 뒤 실행한다. 여러 인스턴스의 문서·history는 독립적이다.

`destroy()`는 반복 호출할 수 있고 컨테이너는 재사용할 수 있다. 그 외 안정 메서드는 종료 후 Error를 던진다. `execute_command`는 reject, `run`은 error 이벤트 전달이다. 동일 컨테이너의 중복 생성은 첫 생성 진행 중에도 거절하며 실패 후 재시도할 수 있다.

## 검증

- `/api-contracts.html`: 생성·문서·좌표·이벤트·설정·IME·종료·지연 파일 읽기 계약.
- `/tests.html`: 기존 단일 사용자 동작 회귀 검사.
- `/collab/rich-tests.html`: 공통 UI의 협업 회귀 검사.
- `scripts/check_editor_types.ts`: 공개 타입의 정상 호출과 `@ts-expect-error` 부정 예제. 개발용 TypeScript 컴파일러가 있으면 다음과 같이 검사한다. 컴파일러는 SDK 런타임 의존성이 아니다.

```sh
tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler scripts/check_editor_types.ts
```

정확한 내부 DOM 구조·CSS 클래스·상태 속성은 안정 API가 아니다. GFM 결과와 OS/모바일 검증 범위는 [호환성](compatibility.md)을 따른다.
