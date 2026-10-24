# Sohjae

[English](../../README.md) | [Español](README.es.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

다른 프로젝트에 임베딩하는 Markdown 편집기와 렌더러입니다. Rust/WASM, Rust 표준 라이브러리와 브라우저 기본 API로 구현하며 외부 crate·JavaScript 패키지·편집기 프레임워크가 필요하지 않습니다. [MIT 라이선스](../../LICENSE).

렌더러와 단일 사용자 편집기의 공개 API는 [API v1 안정성·호환성 정책](../api-stability.md)을 따릅니다. 협업은 [API v2·프로토콜 안정 계약](../collaboration-protocol.md)을 따르며 문서 교환 전에 버전·스키마를 확인합니다.

## 간편 시작

편집기 SDK 폴더를 제공하고 스크립트 하나를 불러오면 됩니다. CSS·WASM·내부 모듈은 스크립트 위치에서 자동으로 읽습니다.

```html
<script src="./sohjae/sohjae.js"></script>
<textarea id="editor" name="markdown"># Hello, Sohjae!</textarea>
<script>new Sohjae({ selector: '#editor' });</script>
```

[간편 시작 안내](../quick-start.md) · [실행 예제](http://127.0.0.1:8080/quick-start.html). textarea의 값은 폼에 동기화하며 div도 지정할 수 있습니다.

## 바로 실행하는 예제

| 예제 | WASM 모듈 |
| --- | --- |
| [Markdown 렌더러](../../examples/sohjae_renderer/index.html) | `sohjae_render.wasm` |
| [Markdown 편집기](../../examples/sohjae_editor/index.html) | `sohjae_editor.wasm` |
| [협업 편집기](../../examples/sohjae_collaborator/index.html) | `sohjae_editor.wasm` + 선택적 `sohjae_collaborator.wasm` |

각 폴더에는 `index.html`, JavaScript, CSS, WASM 바이너리와 로컬 파일용 companion이 포함됩니다. 폴더 내 파일을 함께 보관하세요. HTTP에서는 인접한 WASM 파일을, `file://`에서는 동일한 바이너리를 담은 companion을 읽습니다. 예제를 여는 데 빌드 도구는 필요하지 않습니다. 브라우저 자동화의 `file://` 제한으로 로컬 파일 직접 실행은 전체 동작을 검증하지 못했습니다. 브라우저가 로컬 스크립트를 제한하면 로컬 HTTP 서버를 사용하세요.

```sh
python3 scripts/serve_examples.py --port 8081
```

[렌더러](http://127.0.0.1:8081/sohjae_renderer/index.html), [편집기](http://127.0.0.1:8081/sohjae_editor/index.html), [협업 편집기](http://127.0.0.1:8081/sohjae_collaborator/index.html)를 엽니다. 자세한 구성은 [예제 안내](../../examples/README.md)를 참고하세요.

## 기능

- 리치·하이브리드·Markdown 모드, 전체 원본 화면과 요소별 문법 노출 설정.
- 하이라이트(`==내용==`), 정의 목록, 사용자 지정 제목 ID와 코드 기본 색상 표시. 위첨자·아래첨자 확장 문법은 제외합니다.
- 서식 도구, undo/redo, 한글 IME 조합 처리와 UTF-8/UTF-16 선택 매핑.
- 표 셀 이동, 행·열 삽입 및 삭제, 정렬, 다중 선택과 핸들 드래그 순서 이동.
- 지원하는 HTML 구조의 붙여넣기 변환, 이미지·파일 Base64 임베딩과 다운로드.
- Front Matter, CSS 레이아웃, 읽기 화면·읽기 전용과 키보드 명령 팔레트.
- 원문을 유지하는 편집과 지원 문법의 정규화 내보내기.

## 빌드 및 실행

Rust와 Python 3를 설치하세요. Node.js는 WASM 검증과 측정에 사용합니다.

```sh
rustup target add wasm32-unknown-unknown
sh scripts/build.sh
python3 scripts/serve.py --port 8080
```

- [편집기](http://127.0.0.1:8080/), [렌더러](http://127.0.0.1:8080/renderer.html), [확장 문법 예제](http://127.0.0.1:8080/extended.html) ([원문](../../web/extended.md)).
- [브라우저 테스트](http://127.0.0.1:8080/tests.html)와 [GFM 검사](http://127.0.0.1:8080/gfm-audit.html).
- 편집기 WASM 검증: `node scripts/check_wasm.mjs`.
- 세 SDK 배포 파일 생성: `sh scripts/package.sh`.

렌더러 SDK는 `renderer.js`와 `sohjae_render.wasm`을 사용하며 편집·히스토리·CRDT·WebRTC 코드를 포함하지 않습니다. 별도로 생성하려면 `sh scripts/package_renderer.sh`를 실행하세요. [렌더러 API](../../docs/renderer.md)를 참고하세요.

## 편집기 임베딩

빌드한 `web/`의 JavaScript 모듈·CSS·WASM 파일을 상대 경로를 유지해 함께 제공합니다. 각 편집기는 Shadow DOM으로 호스트 페이지의 스타일과 격리합니다.

```html
<div id="editor"></div>
<script type="module">
  import { create_editor } from './sohjae/editor.js';
  const editor = await create_editor(document.querySelector('#editor'), {
    markdown: '# Document\n\nContent',
    mode: 'hybrid',
    elements: { table: { reveal_markdown: false } }
  });
  editor.addEventListener('change', event => console.log(event.detail.dirty));
  // editor.get_markdown(); editor.set_markdown(source); editor.destroy();
</script>
```

편집기는 기본적으로 `sohjae_editor.wasm`을 로드하며 렌더러 WASM은 필요하지 않습니다.

## 선택적 협업 기능

일반 편집기 WASM에는 협업 ABI나 CRDT가 없습니다. 협업 SDK는 필요한 경우에만 추가합니다. 추가 SDK 배포 파일은 상대 경로를 유지해 같은 SDK 루트에 합쳐 배치하세요.

`create_editor(container, { replica })`로 리치·하이브리드·Markdown·원본 화면을 공유 문서에 연결합니다. `replica`를 생략하면 단일 사용자로 작동합니다. 협업 기능은 문자 CRDT, 안정적인 표·행·열 ID, 작성자별 undo/redo, 상대 커서 앵커, IME 캡처, 전송 독립 WASM API와 WebRTC 어댑터를 제공합니다.

STUN/TURN 설정은 전송 구성에 전달합니다. 다른 기기의 참가자를 연결하려면 호스트의 인증과 시그널링도 필요합니다. 같은 페이지의 예제는 외부 서버 없이 로컬 ICE 후보를 사용합니다.

[협업 설계](../../docs/collaboration.md), [API](../../docs/collaboration_api.md), [리치·원본 데모](http://127.0.0.1:8080/collab/rich.html), [통합 테스트](http://127.0.0.1:8080/collab/rich-tests.html), [IME 검증 화면](http://127.0.0.1:8080/collab/ime.html)을 참고하세요. 협업 WASM은 `node scripts/check_collab.mjs`로 검증합니다.

## 검증 현황과 제한

Sohjae는 개발 버전입니다. 공식 GFM 672개 예제의 기록된 구조 비교 결과는 **585개 일치·87개 불일치**입니다. 계층적 목록·인용문, 강조 구분자, 링크와 참조 정의 처리를 개선했습니다. 전체 GFM 적합성을 보장하는 결과는 아닙니다. 해결한 사례와 남은 차이는 [GFM 보고서](../../docs/gfm-conformance.md)에 기록합니다.

macOS 두벌식 한글 입력기는 Firefox에서 실제 입력으로 검증했으며, 리치·원본 화면의 조합 중 원격 삽입도 확인했습니다. 모바일 실기기, 다른 OS와 전체 대상 브라우저 검증을 대신하지는 않습니다. 검증 범위는 [구현 상태](../../docs/implementation_plan.md)와 [호환성](../../docs/compatibility.md)을 참고하세요.

## 문서

상세 참조 문서는 현재 한국어로 작성되어 있습니다.

| 문서 | 내용 |
| --- | --- |
| [요구사항](../../docs/requirements.md) | 합의한 목표 범위 |
| [문법 및 저장 규칙](../../docs/formatting.md) | 정규화·HTML·붙여넣기 |
| [아키텍처](../../docs/architecture.md) | 현재 구현과 목표 설계 |
| [설정](../../docs/configuration.md) | 기본값과 적용 순서 |
| [API 및 ABI](../../docs/api.md) | 임베딩·버퍼·오류·라이프사이클 |
| [단일 사용자 API 가이드](../single-user-api.md) | 타입 기반 연동·설정·명령·라이프사이클 |
| [구현 계획](../../docs/implementation_plan.md) | 검증 결과와 남은 작업 |
| [검증 기록](../../docs/validation.md) | GFM·실제 OS 입력·모바일 검증 |
| [호환성](../../docs/compatibility.md) | 지원 문법과 브라우저 범위 |
| [편집 보강 기록](../../docs/editor-hardening.md) | 캐시·undo 묶음·정규화·접근성 |
| [이전 기록](../../docs/handoff.md) | 결정 출처와 환경 이전 |

`tests/`는 로컬 검증용으로 Git 추적에서 제외합니다. 빌드·문법 검사에 필요한 공식 표준 자료는 `spec/`에 보관합니다. Rust 보조 도구는 `tools/`에 있으며 Cargo example 이름과 실행 명령은 유지합니다.

## 협업 플러그인과 div 렌더링

`new Sohjae({ selector: "#editor", plugins: ["collaboration"] })`로 협업 모듈을 선택해서 로드합니다. `sohjae-renderer.js`를 가져온 뒤 `new SeojaeRenderer({ selector: "#preview" })`를 호출하면 div의 Markdown을 변환합니다. 배포 및 연결 방법은 [빠른 시작](../quick-start.md)을 참고하세요.
