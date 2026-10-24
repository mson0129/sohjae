# 스크립트 하나로 시작하기

편집기 SDK 폴더를 HTTP(S)로 제공하고 `sohjae.js` 하나를 script src로 불러온다. `new Sohjae()`은 필요한 모듈·CSS·`sohjae_editor.wasm`을 스크립트 위치 기준으로 자동 로드한다. 별도 번들러나 type=module 설정은 필요하지 않다.

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="./sohjae/sohjae.js"></script>
  <script>
    new Sohjae({ selector: '#editor' });
  </script>
</head>
<body>
  <form method="post">
    <textarea id="editor" name="markdown"># Hello, Sohjae!</textarea>
    <button type="submit">저장</button>
  </form>
</body>
</html>
```

head에서 호출하면 DOMContentLoaded까지 기다린다. 백엔드 저장은 폼의 action/method에 맞게 호스트가 구현한다. 실행 예제는 `/quick-start.html`, 소스는 SDK의 `quick-start.html`이다. 예제의 폼 버튼은 서버 전송 대신 폼 데이터를 화면에 표시한다.

## 대상과 반환값

`new Sohjae({ selector: '#editor' })`, `new Sohjae('#editor')`, `new Sohjae({ target: document.getElementById('editor') })`를 지원한다. selector 또는 target 중 하나만 전달하며 selector는 정확히 한 요소에 일치해야 한다. 여러 편집기는 서로 다른 요소에 각각 호출한다. 동일 요소의 생성 중/생성 완료 상태에서는 중복 호출을 거절한다.

생성자는 즉시 Sohjae 인스턴스를 반환하며 자동으로 초기화를 시작한다. editor.ready는 준비 완료 후 같은 인스턴스로 resolve한다. 실패 시 ready를 reject하고 error 이벤트로 알리며 textarea는 그대로 남긴다. Editor 메서드는 ready 이후 사용하고, 이벤트 구독과 destroy는 즉시 사용할 수 있다. 초기화 전 호출은 준비 대기 오류이며 자동으로 명령을 큐에 넣지 않는다. 기존 설정과 `replica` 옵션도 전달할 수 있다. 협업은 선택적 SDK와 replica를 준비한 경우에만 사용하며, 일반 초기화는 협업 WASM을 로드하지 않는다.

```js
const editor = new Sohjae({ selector: '#editor', mode: 'rich' });
editor.addEventListener('error', event => console.error(event.detail));
await editor.ready;
editor.addEventListener('change', event => console.log(event.detail.dirty));
const markdown = editor.get_markdown();
editor.set_markdown('# New document');
// 생성 후 원래 요소의 ID(# 제외) 또는 요소로 조회:
console.log(Sohjae.get('editor') === editor);
editor.destroy();
```

`Sohjae.get(idOrElement)`는 활성 생성자 인스턴스 또는 null을 반환한다. 호환 함수 Sohjae.init으로 만든 경우에는 기존 Editor를 반환한다. 생성 중과 종료 후에는 null이다. 사용법과 반환 타입은 `sohjae.d.ts`에 제공한다. 기존 ES module `create_editor` API도 유지한다.

## textarea와 폼

textarea의 value가 초기 Markdown이다. `markdown` 옵션을 명시하면 우선하며 빈 문자열도 유효하다. textarea에서 읽은 초기 내용은 인스턴스 markdown 옵션으로 전달하므로 config_url의 markdown보다 우선한다. div도 지정할 수 있고 이때 textContent를 Markdown으로 읽는다. 초기 HTML을 CKEditor 문서 모델처럼 변환하는 기능은 아니며, HTML 붙여넣기는 기존 에디터의 붙여넣기 경로를 사용한다.

textarea는 name·form·required·disabled 등 속성을 유지한 채 숨기고, 별도 컨테이너에 편집기를 표시한다. 편집·undo/redo·set_markdown·초안 폐기 결과를 textarea.value에 원문으로 동기화해 FormData와 일반 폼 제출에 반영한다. 같은 name의 다른 필드를 덮어쓰지 않는다. 정규화한 서버 저장 문자열이 필요하면 editor.get_markdown()을 사용한다. 네이티브 input/change 이벤트를 별도로 만들어 보내지는 않으므로 변경 구독은 editor의 change 이벤트를 사용한다. 외부에서 문서를 바꿀 때는 숨겨진 textarea.value 대신 set_markdown을 호출한다.

readOnly와 disabled(상위 disabled fieldset 포함)는 초기 read_only의 기본값으로 반영하며 명시적 옵션으로 덮어쓸 수 있다. required 검증 실패 시 편집기에 포커스를 보낸다. 연결된 label 클릭도 편집기로 전달한다. disabled 필드는 브라우저의 폼 제출 제외 규칙을 따른다.

폼 reset은 textarea.defaultValue로 문서를 교체하고 history를 초기화한다. 취소된 reset은 반영하지 않는다. IME 조합 중 문서 교체가 거절되면 error 이벤트를 내보내고 현재 문서 값을 유지한다. 폼 제출에는 commit된 문서가 들어가며, 조합 중 강제 저장은 기존 API 계약을 따른다. 호스트가 폼 소유권이나 DOM 위치를 바꾸려면 종료 후 다시 초기화한다.

종료는 반복 호출 가능하다. 현재 원문을 textarea에 남기고 기존 hidden 속성을 복원하며 보조 컨테이너·폼·label 이벤트를 해제한다. 재초기화하면 현재 textarea.value부터 시작한다. textarea.defaultValue는 변경하지 않는다. div는 기존 모듈 API의 컨테이너 해제 규칙을 따른다.

## 배포

SDK 폴더의 파일을 함께 제공한다. `sohjae.js`는 단일 공개 진입점이며 내부 JS·CSS·WASM은 별도 파일로 자동 요청한다. 파일을 하나로 합치거나 외부 CDN에 게시한 것은 아니다. 다른 출처에 SDK를 제공하는 경우 모듈·CSS·WASM 요청에 해당 서버의 CORS 허용이 필요하다. SDK 버전별 경로로 파일들을 함께 갱신한다.

이 진입점은 HTTP(S)용이다. 직접 파일 열기는 기존 self-contained 예제 index.html을 사용한다. `examples/sohjae_editor/quick-start.html`은 같은 예제 폴더를 HTTP로 제공할 때 이 간편 초기화를 보여준다.

## 검증

`/quick-start/tests.html`은 스크립트와 페이지의 디렉터리를 다르게 하여 상대 경로를 검사한다. head 초기화·폼 데이터·reset/취소·오류 복구·중복 생성·재사용·div·네이티브 폼 속성·label·중복 스크립트 로드를 검사한다. 타입 검사는 기존 `scripts/check_editor_types.ts`에 포함한다.

## 호환 함수와 초기화 취소

기존 `Sohjae.init(options): Promise<Editor>`도 유지한다. 새 예제의 기본 방식은 생성자다. `ready` 이벤트에서도 Editor 메서드를 사용할 수 있으며 ready Promise는 같은 handle을 반환한다. 생성 직후 단순히 `new Sohjae(...)`만 호출해도 초기화된다. 오류는 error 이벤트와 ready.catch로 확인할 수 있다. 동기 생성자는 파일 로딩 완료를 기다리지 않는다.

로딩 중 destroy()를 호출하면 초기화 결과를 해제하고 ready는 AbortError로 reject한다. 취소 시 error 이벤트는 발생시키지 않는다. 진행 중인 공유 모듈/WASM 요청 자체를 중단하지는 않으므로 해당 작업이 끝난 뒤 정리가 완료될 수 있다. 재초기화는 취소된 ready의 종료 후 진행한다. 종료 후 공개 메서드 규칙은 기존 Editor와 같다.

초기 markdown을 지정하지 않고 로딩 중 표시된 textarea에 입력하면, 준비 완료 직전의 최신 값을 초기 문서로 반영한다. 명시한 markdown 옵션은 기존 우선순위를 유지한다.

## Optional collaboration plugin

Deploy the collaboration SDK overlay beside the editor SDK, then enable the plugin:

```html
<script src="./sohjae.js"></script>
<textarea id="editor"># Shared document</textarea>
<script>
const editor = new Sohjae({
  selector: '#editor',
  plugins: ['collaboration'],
  collaboration: { document_id: '0123456789abcdef0123456789abcdef' }
});
editor.ready.then(() => {
  const replica = editor.collaboration.replica;
  // Persist replica.export_state(), or merge a saved log with replica.merge(bytes).
});
</script>
```

Omit `collaboration` to create a new document identity automatically. Participants need the same document ID and must exchange their document logs. The plugin loads collaboration JavaScript and `sohjae_collaborator.wasm` only when selected. `editor.collaboration` is `null` without the plugin. An existing `replica` can be supplied instead of creation options; the host retains ownership of that replica.

After your application establishes an RTCDataChannel, call `editor.collaboration.connect(channel, { authorize_peer: hello => /* verify authenticated peer */ false })`. The host supplies signaling, ICE/STUN/TURN configuration and peer authorization. This plugin does not create a room service. Destroying the editor closes its transports and destroys a replica created by the plugin.

## Standalone div renderer

```html
<script src="./sohjae-renderer.js"></script>
<div id="preview"># Hello

Markdown **inside the div**.</div>
<script>
const preview = new SeojaeRenderer({ selector: '#preview' });
preview.ready.then(() => preview.render('# Updated'));
</script>
```

`SeojaeRenderer` (also available as `SohjaeRenderer`) reads the div's `textContent`, renders it as Markdown and loads only `renderer.js`, `renderer.css` and `sohjae_render.wasm` relative to the script. Escape HTML characters when writing Markdown directly in HTML. Pass `markdown` explicitly to override the initial div text, or `target: element` instead of `selector`. `ready` resolves to the instance; `get_markdown()` returns its current source. `destroy()` restores the latest Markdown as plain text and permits initialization again. Initialization errors reject `ready` and emit `error`; destroy is safe during loading. Other methods require readiness. Serve these modular quick starts over HTTP; the generated example `index.html` pages additionally support offline file opening.
