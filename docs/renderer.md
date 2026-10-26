# 독립 Markdown 렌더러

파일 브라우저의 Markdown 미리보기처럼 편집 기능이 필요 없는 호스트는 렌더러 전용 WASM을 사용한다. `sohjae_render.wasm`은 파서·HTML 렌더링·문자 참조·코드 색상 로직만 포함하며 편집 세션·history·CRDT·WebRTC를 포함하지 않는다. 에디터는 기존 `sohjae_editor.wasm`을 계속 사용하며 렌더러 WASM을 추가 다운로드하지 않는다. 두 바이너리는 같은 Rust 파서/렌더러 소스를 각각 컴파일하므로 문법 규칙이 갈라지지 않는다.

`create_renderer`와 반환 객체의 `render`·`destroy`는 안정 API v1이다. [안정성 및 호환성 정책](api-stability.md)을 따른다. HTML의 정확한 문자열·내부 DOM 구조는 안정 계약에 포함하지 않는다.

## 빌드와 배포

```sh
# 렌더러만 빌드
sh scripts/build_renderer.sh
# 렌더러 전용 패키지
sh scripts/package_renderer.sh
# 전체 편집기 + 렌더러 빌드/검사
sh scripts/build.sh
node scripts/check_renderer.mjs
```

`dist/sohjae-renderer-0.1.0.tgz`에는 renderer.js, renderer.css, sohjae_render.wasm과 API.md, gfm-conformance.md, LICENSE를 포함한다. CSS는 선택 사항이다. JS/WASM을 같은 디렉터리에 HTTP(S)로 제공한다. wasm은 application/wasm MIME을 사용한다. 외부 패키지·CDN이 필요하지 않으며 단일 Python 파일 서버에 포함하려면 호스트가 해당 바이트를 자체 리소스 경로로 제공할 수 있다. 참조 파일 브라우저 프로젝트 자체는 변경하지 않았다.

```html
<link rel="stylesheet" href="./sohjae-renderer/renderer.css">
<article id="preview" class="sohjae_viewer"></article>
<script type="module">
  import { create_renderer } from './sohjae-renderer/renderer.js';
  const renderer = await create_renderer();
  document.querySelector('#preview').innerHTML = renderer.render('# 문서\n\n==강조==');
  // renderer.destroy(); // 미리보기 갱신에는 같은 인스턴스를 재사용한다.
</script>
```

`create_renderer({ wasm_url })`로 별도 WASM 경로를 지정할 수 있다. Promise로 생성하고 `render(markdown)`은 동기적으로 읽기용 HTML 문자열을 반환한다. `destroy()`는 참조를 해제하며 이후 render는 거절한다. 여러 인스턴스는 WASM 메모리를 공유하지 않으며 컴파일된 모듈은 URL별로 캐시한다. DOM 삽입·파일 읽기·링크 탐색·첨부 다운로드·호스트의 base URL 정책은 호스트가 담당한다. 상대 링크와 이미지의 기준 경로는 호스트 문서 URL의 영향을 받으므로 파일 미리보기에서는 호스트 파일 경로로 해석해야 한다. 중복 제목/각주 ID가 있는 복수 미리보기는 별도 Shadow DOM 또는 iframe 등으로 격리하는 것이 적합하다.

## 출력과 범위

공통 파서의 읽기용 결과에서 편집 좌표용 section·텍스트 span·이미지 래퍼와 편집 메타데이터 및 table_scroll div를 제거한 HTML을 반환한다. 굵게 강조는 `<strong>`, 하이라이트는 `<mark>`로 출력한다. 일반 제목의 자동 ID는 생략하며 명시한 제목 ID와 문서 내부 링크가 참조하는 ID는 유지한다. 코드 색상·언어 정보, 표 정렬, 각주와 알림 등 의미나 표시 기능에 필요한 요소는 보존하며 체크박스는 disabled다. 편집 UI, contenteditable 호스트, 커서 및 undo 상태를 만들지 않는다. 허용 HTML/속성/URL 정책도 편집기와 동일하며 임의 원본 HTML을 직접 삽입하지 않는다. 외부 이미지·링크는 호스트 정책으로 추가 제어할 수 있다.

문법 지원 범위는 기존 파서와 동일하다. 하이라이트·표·각주 등은 지원하지만 Markdown 위/아래 첨자는 제외한다. 현재 672개 구조 비교 중 585개 일치·87개 불일치다. 87개는 렌더러의 확장 또는 정책상 차이로 전체 GFM과의 차이가 있다. 렌더러 분리 검사는 편집 전용 래퍼·속성과 강조 태그 차이를 제외한 672개 출력의 의미가 기존 읽기 렌더링과 같은지 확인하며, GFM 672개 합격을 뜻하지 않는다.

## 렌더러 ABI v1

exports: memory, renderer_abi_version, renderer_reserve_input, renderer_render, renderer_output_pointer, renderer_output_length. 편집기 ABI의 dispatch/collab_dispatch는 포함하지 않는다.

1. renderer_abi_version() == 1 확인.
2. renderer_reserve_input(u32 길이)로 버퍼 확보. 입력 한도 32MiB, 초과 시 null.
3. 확보한 버퍼에 UTF-8 입력을 쓴다. 빈 입력도 reserve를 호출한다.
4. renderer_render() 호출. 상태 0이면 HTML, 1이면 오류 메시지.
5. output_pointer/length에서 raw UTF-8을 즉시 복사한다. 길이 접두사·세션 handle은 없다.

입력 CRLF/CR은 LF로 정규화한다. 잘못된 UTF-8, reserve 누락/초과는 오류로 반환한다. 다음 렌더링은 새 reserve가 필요하다. 버퍼는 WASM 소유이며 export 호출 또는 memory growth 전에 view를 재사용하지 않는다. 렌더링은 동기적이며 큰 문서에서 UI 스레드를 막을 수 있으므로 호스트는 필요 시 Worker에서 호출한다. 출력 크기·최대 메모리와 대용량 문서 처리 시간에 대한 보장은 없다.

Cargo 기본 feature는 editor다. renderer는 `--no-default-features --features renderer --lib`로 별도 빌드하며 editor와 동시에 활성화하지 않는다. 별도 target/renderer 디렉터리를 사용해 기존 에디터 산출물을 덮어쓰지 않는다.

최신 컨테이너·delimiter/link 구현과 불일치 분류는 [GFM 보강 기록](gfm-conformance.md)을 따른다.

## Classic-script constructor

Load `sohjae-renderer.js`, then call `new SeojaeRenderer({ selector: '#preview' })` to render the matched div's `textContent` as Markdown. `SohjaeRenderer` is an alias. Await `renderer.ready` before calling `render(markdown)` or `get_markdown()`. `destroy()` restores the latest Markdown text. CSS and renderer WASM load automatically beside the entry script; editor and collaboration modules are not loaded. See [quick start](quick-start.md).
