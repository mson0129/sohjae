# sohjae

다른 프로젝트에 임베딩하는 Rust/WASM Markdown 편집기. 외부 crate·JavaScript 패키지·편집기 프레임워크 없이 Rust 표준 라이브러리와 브라우저 기본 API로 구현한다. [MIT](LICENSE).

## 실행

Rust와 Python 3가 필요하다. Node는 ABI 검증·성능 측정에만 사용한다.

```sh
rustup target add wasm32-unknown-unknown
sh scripts/build.sh
python3 scripts/serve.py --port 8080
```

- 편집기: <http://127.0.0.1:8080/>
- [확장 문법 예제](http://127.0.0.1:8080/extended.html) · [예제 원문](web/extended.md)
- 브라우저 수용 테스트: <http://127.0.0.1:8080/tests.html>
- 실제 WASM ABI 검증·측정: `node scripts/check_wasm.mjs`
- 배포 파일 생성: `sh scripts/package.sh`

## 협업 코어 v2

기존 단일 사용자 프로토타입을 보존하고 협업 문서 코어를 별도로 추가했다. 문자 CRDT, 안정적인 표·행·열 ID, 작성자별 undo/redo, 상대 커서·IME 캡처, 전송 독립 WASM API와 WebRTC 어댑터를 제공한다. **`create_editor(container, { replica })`로 같은 공유 문서를 리치·하이브리드·Markdown·원본 화면에 연결한다. `replica`를 생략하면 기존 단일 사용자 동작을 유지한다.**

- [리치·원본 협업 화면](http://127.0.0.1:8080/collab/rich.html) · [통합 테스트](http://127.0.0.1:8080/collab/rich-tests.html) · [실제 한글 입력기 검증](http://127.0.0.1:8080/collab/ime.html)
- [협업 코어 검증 화면](http://127.0.0.1:8080/collab/index.html): 실제 WebRTC 연결·단절·재연결, 본문/셀 편집.
- [협업 브라우저 테스트](http://127.0.0.1:8080/collab/tests.html), 실제 WASM 검증: `node scripts/check_collab.mjs`
- [협업 설계](docs/collaboration.md), [협업 API](docs/collaboration_api.md)
- 보존본: `artifacts/prototype-v1-2026-10-23.tar.gz` (원본별 SHA256 manifest 포함).

STUN/TURN 설정은 전송 구성에 전달하며, 다른 기기의 참가자 연결에는 호스트의 인증·시그널링이 필요하다. 같은 페이지 검증은 외부 서버 없이 로컬 ICE 후보를 사용한다.

## 단일 사용자 프로토타입 기능

- 하이브리드·리치·Markdown 모드와 전체 원본 화면, 요소별 문법 노출 설정.
- 하이라이트(`==내용==`)·정의 목록·사용자 지정 제목 ID·코드 기본 색상 표시.
- Markdown 입력·서식 도구·undo/redo·한글 IME commit과 UTF-8/UTF-16 선택 매핑.
- 표 셀 이동·행/열 삽입·삭제·정렬·다중 선택·드래그·표 밖 이동.
- HTML 붙여넣기의 허용 구조 변환, 이미지·파일 Base64 임베딩 및 다운로드.
- Front Matter와 CSS 레이아웃, 읽기 화면·읽기 전용, 키보드 명령 팔레트.
- 원문을 유지하면서 지원 문법을 정규화해 내보내기.

현재는 개발 버전이다. 자체 문법 fixture와 브라우저 수용 테스트를 통과했지만 **전체 GFM 적합성과 대상 브라우저 전체·모바일 실기기 검증은 완료하지 않았다.** 공식 GFM 672개 전체 예제의 구조 비교 결과와 실패 목록은 [GFM 검사 화면](http://127.0.0.1:8080/gfm-audit.html)에 공개한다. macOS 두벌식은 Firefox에서 실제 키 이벤트로 리치·원본 조합 중 원격 삽입까지 검증했다. 이 결과는 모바일 가상 키보드나 다른 OS 입력기 검증을 대신하지 않는다. 정확한 구현·검증 경계는 [구현 상태](docs/implementation_plan.md)와 [호환성](docs/compatibility.md)에 기록한다.

## 임베딩

빌드한 `web`의 모듈·CSS·WASM 파일을 같은 디렉터리에 제공한다. 인스턴스는 Shadow DOM으로 호스트 스타일과 격리한다.

```html
<div id="editor"></div>
<script type="module">
  import { create_editor } from './sohjae/editor.js';
  const editor = await create_editor(document.querySelector('#editor'), {
    markdown: '# 문서\n\n내용',
    mode: 'hybrid',
    elements: { table: { reveal_markdown: false } }
  });
  editor.addEventListener('change', event => console.log(event.detail.dirty));
  // editor.get_markdown(); editor.set_markdown(source); editor.destroy();
</script>
```

## 문서

| 문서 | 내용 |
| --- | --- |
| [요구사항](docs/requirements.md) | 합의한 목표 범위 |
| [문법 및 저장 규칙](docs/formatting.md) | 정규화·HTML·붙여넣기 |
| [아키텍처](docs/architecture.md) | 현재 구현과 목표 설계의 차이 |
| [협업 설계 및 API](docs/collaboration_api.md) | v2 코어·WebRTC·원본 좌표 경계 |
| [설정](docs/configuration.md) | 기본값과 적용 순서 |
| [API 및 ABI](docs/api.md) | 임베딩·버퍼·오류·라이프사이클 |
| [구현 및 검증](docs/implementation_plan.md) | 검증 결과와 남은 작업 |
| [실검증 및 GFM](docs/validation.md) | 전체 예제·실제 OS 입력·모바일 검증 경계 |
| [호환성](docs/compatibility.md) | 지원 문법·브라우저 검증 범위 |
| [이전 기록](docs/handoff.md) | 결정 출처와 환경 이전 |
