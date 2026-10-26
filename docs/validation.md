# 협업 통합·GFM·입력 검증 (2026-10-23)

## 재현 방법

```sh
sh scripts/build.sh
node scripts/check_collab.mjs
python3 scripts/audit_gfm.py --check
python3 scripts/serve.py --port 8080
```

브라우저 페이지:

- `/tests.html`: 기존·확장 편집기 회귀 검사.
- `/collab/tests.html`: 실제 RTCDataChannel 코어 검사.
- `/collab/rich-tests.html`: 공유 리치·원본·표·선택·IME·초안 통합 검사.
- `/collab/rich.html`: 두 기존 편집 화면을 같은 공유 문서에 연결한 데모.
- `/collab/ime.html`: 실제 OS 입력기에서 발생한 composition/input 이벤트 기록.
- `/gfm-audit.html`: 공식 GFM 전체 예제와 구조 비교 결과.

## GFM 전체 예제

공식 GFM 0.29-gfm 명세의 예제 672개를 모두 실행했다. 출처는 https://github.com/github/cmark-gfm/blob/master/test/spec.txt 이고 고정 snapshot·SHA256·CC BY-SA 출처 표기는 spec에 보관한다. 결과의 원문·기대 HTML·실제 HTML은 web/gfm-results.json에 있으며 집계는 docs/gfm-audit.json이다.

편집기 전용 section/span·빈 커서 자리, 선택적 thead/tbody, 기본 왼쪽 정렬을 정규화해 **HTML 트리 구조와 텍스트를 비교**한다. 이 방식은 공식 테스트 도구의 byte-for-byte HTML 비교와 다르다. 안전한 HTML·URL 제한이나 별도 확장은 끄지 않는다. 정규화 기준을 바꿔 실패를 통과로 숨기지 않는다.

같은 비교 기준에서 보강 전 191/672, 현재 **265/672 일치, 407개 불일치**다. 제목 공백/닫는 기호, setext, 코드 구분자 길이·공백·개행, 마지막 코드 개행, 표 헤더 열 수·누락/초과 셀·연속 행, HTML 이름 문자 참조, 코드 안의 emphasis/link 우선순위를 보강했다. 코드 내부 표시 정규화에도 보이는 문자 좌표를 유지한다.

불일치에는 중첩 목록/인용문과 링크·emphasis 세부 규칙 등의 미구현, 편집 DOM 구조, HTML/URL 안전 정책 및 별도 확장 차이가 함께 포함된다. 모든 불일치를 의도된 정책 차이로 간주하지 않는다. **전체 GFM 적합성 통과 또는 인증이 아니다.** 이 문단은 초기 검사 기록이다. 계층적 컨테이너·delimiter/link와 개별 정책 분류의 후속 완료 상태는 gfm-conformance.md와 editor-hardening.md를 따른다.

build.sh는 고정 예제 전체를 재검사하고 gfm-baseline.json에서 기존에 일치하던 예제가 새로 실패하면 종료한다. 알려진 407개 불일치는 결과에 그대로 남긴다. `--check` 성공을 전체 672개 통과로 표현하지 않는다. 의도한 개선을 검토한 뒤에만 `--update-baseline`으로 회귀 기준을 갱신한다.

## 실제 macOS 두벌식

사용자가 입력 소스를 두벌식으로 전환한 뒤 macOS의 실행 중인 Firefox에서 네이티브 앱 키 이벤트로 검증했다. 한글 문자열을 붙여넣거나 합성 composition 이벤트를 생성한 검사가 아니다.

| 화면 | 실제 키 입력과 원격 변경 | 확인한 결과 |
| --- | --- | --- |
| 리치(contenteditable) | `g`, `k`로 ‘하’ 조합 시작 → 2초 예약 원격 이모지 → `s`로 받침 추가 → space, 이후 `r`, `m`, `f`, space | 수신 당시 조합 중=true, 종료되지 않음, DOM 그대로, ‘한 글 ’ 완료, 두 복제본 일치 |
| 전체 원본(textarea) | ‘하’ 조합 시작 → 예약 원격 이모지 → 받침 `s` → space | 수신 당시 조합 중=true, DOM 그대로, ‘한 ’ 완료, 두 복제본 일치 |

원격 변경은 네트워크 지연을 제외하고 다른 복제본의 연산을 직접 merge했다. 실제 RTCDataChannel 전달은 별도의 코어·통합 자동 검사에서 확인한다.

후자의 최종 원본은 `😀😀입력: 한 글 한 `이고 trusted compositionstart/end가 각각 3회 기록됐다. 이 기록은 테스트 문장의 실제 최종 내용과 조합 중 원격 수신 상태를 함께 확인한 결과다. trusted 이벤트 수만으로 합격을 자동 판정하지 않는다.

이 실검증은 단일 macOS·Firefox·두벌식 조합의 범위다. 다른 브라우저의 OS IME, 선택 전체 교체·한자 변환·음성 입력·긴 조합의 모든 경우를 검증한 것은 아니다. 합성 테스트는 조합 취소·선택 atom 보존·원격 행 삭제·초안 충돌 등을 추가로 확인하며 실검증과 별도로 집계한다.

## 모바일·태블릿

in-app 브라우저의 viewport를 320/375/414/768px로 바꿔 반응형 화면을 검사했다. 휴대폰 폭에서 툴바는 가로 스크롤하고, 표 스크롤 컨테이너와 전체 페이지 폭을 분리한다. 도구 버튼은 950px 이하 또는 coarse pointer에서 최소 높이 44px, 휴대폰 툴바 최소 폭 44px를 적용한다. 소스 textarea는 터치 환경에서 16px 글꼴을 사용한다. 태스크 입력 영역도 확대했다.

전체 페이지 가로 넘침, 편집기 폭, 툴바 목표 크기, 넓은 표의 독립 스크롤을 검사한다. 임시 viewport는 검사 후 복원했다. **이 검사는 실제 iPhone/Android 기기·터치 선택·가상 키보드·모바일 OS 한글 입력기 검증이 아니다.** 해당 기기에서 ime.html을 열고 같은 이벤트/내용 검증을 수행해야 한다. 실제 TURN 강제 relay·다중 기기 연결도 별도 수용 조건으로 남아 있다.

## 이번 빌드의 자동 검사 집계

Rust 65개(위치/ABI/문서/파서/공유 모델/투영), 기존·확장 브라우저 34개, WebRTC 코어 8개, 리치·원본 통합 14개가 통과했다. 통합 14개는 375px viewport에서도 다시 통과했다. fmt·Clippy·WASM release, 실제 WASM Node 검사와 SDK 패키지 모듈 일치도 확인한다. GFM 672개 구조 비교는 이 합격 집계와 별도이며 265개 일치/407개 불일치로 보고한다.

직접 표 텍스트를 선택해 붙여넣는 검사도 수행했다. 네이티브 선택이 이전 셀의 끝부터 잡히는 경우에도 선택된 셀 내용만 교체하고 열 구분자는 유지하도록 처리했으며, 리치 수정이 다른 복제본의 전체 원본에 반영됨을 확인했다.

## 렌더러 전용 WASM 분리

`node scripts/check_renderer.mjs`는 독립 WASM의 함수 export가 렌더러 ABI 5개뿐이고 import가 없음을 확인한다. 기존 GFM 672개 읽기 출력과 전부 동일함을 확인하고 Unicode·개행·허용 HTML/URL·읽기 전용 checkbox·빈 입력·한도·잘못된 UTF-8·오류 후 복구·큰 출력·로더·destroy를 검사한다. 이는 GFM 전체 적합성 합격과 별개다. 분리 빌드에서 renderer 210542바이트, editor 693239바이트를 측정했다. 렌더러 데모 `/renderer.html`은 실제 브라우저에서 제목·강조·하이라이트·표·비활성 작업 체크박스를 확인했다. 기존 Rust 65개 및 실제 editor/collab WASM Node 검사를 다시 통과했다.

## Setext 제목과 빈 목록 항목 오류 수정

`## 서명\n- 이메일 하단에 자동으로 작성될 내용을 지정\n-`에서 목록이 두 번째 H2가 되는 오류를 원본 WASM에서 재현했다. Setext 판정을 블록 시작 종류 판정 뒤로 이동해 일반 문단에만 적용하고, 단독 -/*/+를 빈 목록으로 인식하되 일반 문단은 끊지 않도록 처리했다. Rust 회귀 2개를 추가해 총 67개를 통과했다. 실제 editor/renderer WASM에서 H2 1개·목록 2개를 확인했으며 뷰어 브라우저에서도 정상 출력을 확인했다. GFM 기존 일치 항목 회귀 없이 현재 265/672 일치·407개 불일치다. 이 수정은 공유 파서를 사용하는 편집기와 독립 렌더러 모두에 반영된다.

## 표 이동과 UI 통합 추가 검증

Rust 70개(안정 ID 이동·동시 이동/삽입/삭제 수렴·잘못된/비인과 이동 거절 3개 추가)를 통과했다. 리치·원본 통합 검사는 19개로 확대해 실제 WebRTC 이동 전달·원격 편집 보존·자기 undo·정렬·단일 사용자 이동·키보드·포인터·Shift 범위·취소·원격 삭제 중 드래그 취소·다중 표 원본 교체를 포함한다. 기존 브라우저 34개와 전송 8개는 별도 검사 페이지에서 확인한다.

실제 브라우저 포인터 드래그로 데모의 ‘공동 편집’ 행을 맨 뒤로 이동하고 첫 열을 두 번째 열로 옮겼다. 상대 복제본의 전체 원본에 동일 순서와 열 정렬이 반영됨을 확인했다. 합성 포인터 테스트와 구분한 실제 UI 조작 검증이며 모바일 터치 실기기 검증을 뜻하지 않는다.

이번 행·열 이동 변경의 브라우저 집계는 61개(기존 34·전송 8·통합 19)다. 통합 19개는 375px viewport에서도 반복 통과했으며 모바일 실기기 검증으로 집계하지 않는다.

## GFM 컨테이너·인라인·분류 보강

같은 비교 함수와 672개 고정 fixture에서 265→585개 일치, 407→87개 불일치로 개선했다. 시작 시 실패 320개를 해결하고 기존 통과 항목의 회귀 없이 기준을 확대했다. Rust 85개·브라우저 66개(37+8+21) 회귀 검사를 통과했다. 87개는 렌더러의 확장 또는 정책상 차이로 전체 GFM과의 차이가 있다. 세부 결과·남은 분류와 표준 문법으로 수정한 이전 수용 fixture는 [GFM 보강 기록](gfm-conformance.md)에 기록한다.

## 현재 편집 보강 검증

현재 결과와 테스트 집계는 [편집 보강 기록](editor-hardening.md)을 따른다. 위의 단계별 수치는 당시 실행 기록이며 현재 미구현 목록이 아니다.

## API v1 계약 검사 (2026-10-24)

`node scripts/check_api_contracts.mjs`는 실제 WASM으로 ABI 불일치 거절·렌더러 인스턴스 격리·숫자 좌표 오류·안정화 전 SCV2 로그 복원·손상된 프레임의 원자적 거절·협업 handshake 스키마 불일치 차단을 검사한다. 저장 fixture는 `spec/api/`에 유지한다.

실제 인앱 브라우저에서 `/api-contracts.html` 6/6, 기존 단일 사용자 40/40, 공유 UI 22/22, 전송·입력 8/8을 통과했다. API 계약의 IME 검사는 합성 composition 이벤트를 사용하며 새로운 OS 입력기·모바일 실기기 검증 결과가 아니다. 정책과 공개 범위는 [API 안정성](api-stability.md)을 따른다.

## 단일 사용자 API 확장 검사 (2026-10-24)

`/api-contracts.html`은 11개로 확장했다. 기존 검사에 잘못된 설정·명령의 무변경 거절, 다중 IME 대기 설정 병합과 사본 격리, 생성 경합·설정 파일 우선순위·실패 후 재사용, toolbar 명령 타입 누락, 지연된 파일 열기 보호를 추가했다. `scripts/check_editor_types.ts`는 TypeScript 5.9.3 strict 검사에서 정상 호출과 잘못된 옵션·명령·이벤트·내부 상태 접근의 @ts-expect-error를 함께 검증했다. 임시 개발 도구만 사용하고 SDK 의존성은 추가하지 않았다.

## 협업 안정 계약 검사 (2026-10-24)

`check_collab_contracts.mjs` 10/10에서 전체 tag0~9 고정 로그의 참조 파싱·복원·재출력 바이트 동일성, factory 입력/ABI 거절, 불변 snapshot, 이벤트 순서·재진입·반복 종료, 프로필·identity·인증·timeout, 분할 헤더·역압·대기 큐 한도, 손상 프레임 거절과 초기 export/send 실패를 검사한다. 기존 저장 fixture 검사와 실제 WASM 검사도 유지한다.

브라우저 협업 검사는 11개로 확장해 실제 3인 full mesh의 동시 편집·오프라인 재연결 수렴과 replica 종료 후 peer 문서 보존을 추가했다. 타입 선언은 TypeScript 5.9.3 strict 정상/부정 예제로 검사한다. 이 검사는 로컬 ICE이며 실제 다중 기기 TURN relay·모바일·다른 OS IME 검증을 의미하지 않는다.

## 간편 스크립트 진입점 (2026-10-25)

`/quick-start/tests.html` 9/9 통과. 스크립트와 다른 디렉터리에서 head 초기화, 자동 경로, textarea/form 데이터·중복 name, undo/redo·호스트 교체, reset/취소, 실패 후 복구, 중복 초기화·종료·재사용, div와 selector 약식, required·readonly·disabled fieldset, label 및 중복 엔트리 로드를 확인했다. `/quick-start.html`과 별도 examples 서버의 `/sohjae_editor/quick-start.html`도 실제 WASM 편집기 초기화를 확인했다. 타입 정상/부정 검사는 기존 TypeScript strict 검사에 포함한다.

## 생성자 초기화 계약 (2026-10-25)

간편 진입점 브라우저 검사 15/15 통과. 기존 9개에 생성자 반환·ready 및 메서드/이벤트 전달, 비동기 실패·재시도, 준비 전 종료, CSS 로딩 중 종료, DOM 마운트와 handle 준비 사이 취소, 로딩 중 textarea 입력 보존을 추가했다. 기존 init 호환 테스트도 유지하며 TypeScript strict 정상/부정 검사를 통과했다.

### Optional classic collaboration and renderer constructors

The classic entry contract harness passes 20 tests, including constructor readiness/cancellation, form integration, absence of collaboration runtime requests in ordinary editors, plugin replica synchronization and ownership, transport teardown, and div renderer update/destroy/reinitialization. Strict TypeScript checks and full package build pass. GFM audit remains 585/672 with the existing 87 documented policy mismatches; no parser changes in this update.
