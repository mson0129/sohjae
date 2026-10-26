# 세 가지 실행 예제

| 폴더 | 실행 파일 | 포함 WASM |
| --- | --- | --- |
| sohjae_renderer | index.html | sohjae_render.wasm |
| sohjae_editor | index.html | sohjae_editor.wasm |
| sohjae_collaborator | index.html | sohjae_editor.wasm + sohjae_collaborator.wasm |

각 폴더만 복사해 사용할 수 있다. index.html을 열면 샘플 Markdown과 화면이 초기화된다. 협업 예제에서는 ‘협업 시작’ 버튼을 눌러 추가 모듈을 로드하고 두 참가자의 편집·연결 끊기·재연결을 확인한다. 서버 설치나 Rust 빌드는 예제 열기에 필요하지 않다.

## 로컬 파일과 HTTP

- 실제 `.wasm`은 HTTP 배포에 사용한다.
- `example.js`는 저장소의 SDK 소스에서 만든 classic-script 번들이다. 별도 구현이나 CDN을 사용하지 않는다.
- `.wasm.js`는 바로 옆 WASM과 같은 바이트의 Base64 companion이다. file://에서만 요청하며 ES module import와 로컬 WASM fetch의 브라우저 제한을 피한다. 협업 companion도 버튼을 누르기 전에는 읽지 않는다.
- `style.css`, example.js, WASM, companion을 함께 유지한다. index.html 하나만 복사하는 예제가 아니다.

HTTP를 사용하려면 저장소 루트에서:

```sh
python3 scripts/serve_examples.py --port 8081
```

http://127.0.0.1:8081/sohjae_renderer/index.html 등 세 폴더로 접속한다. HTTP 환경에서 렌더링·일반 편집·실제 로컬 WebRTC 동기화를 확인했다. 현재 자동화 도구는 file:// 탐색을 보안 정책으로 차단하므로 더블클릭 실행 자체는 자동 검증하지 못했다. companion의 실제 WASM과의 바이트 일치 및 번들 문법은 별도 검사한다. 브라우저가 로컬 스크립트 자체를 금지하는 경우 HTTP를 사용한다.

## 다시 생성하기

```sh
sh scripts/build.sh
node scripts/check_examples.mjs
```

example.js와 companion은 scripts/build_examples.py로 생성한다. SDK 수정은 web/ 소스를 변경한 뒤 다시 생성한다. 실제 WASM과 생성 파일도 예제를 바로 실행할 수 있도록 Git에 포함한다.

기존 examples의 Rust 파일은 사용자 브라우저 예제가 아니어서 tools/로 이동했다. `cargo run --example render_gfm`은 GFM 검사 입출력 도구이고, `cargo run --release --example benchmark_incremental`은 네이티브 렌더러 측정 도구다.

## 스크립트 하나로 초기화

`sohjae_editor/quick-start.html`은 `sohjae.js` 하나와 `new Sohjae({ selector: "#editor" })`로 초기화하는 HTTP 예제다. `python3 scripts/serve_examples.py --port 8081` 실행 후 <http://127.0.0.1:8081/sohjae_editor/quick-start.html>을 연다. 기존 각 폴더의 index.html은 직접 파일 열기용 self-contained 예제를 유지한다.

## GitHub Pages

공개 데모: https://mson0129.github.io/sohjae/

`.github/workflows/pages.yml`이 main 푸시 또는 수동 실행 시 예제 자산을 검증하고 `examples/`만 GitHub Pages에 배포한다. Rust 빌드는 배포 단계에서 실행하지 않으므로 SDK 변경 후에는 먼저 예제를 다시 생성해 커밋한다. Pages 배포 소스는 GitHub Actions로 설정한다.
