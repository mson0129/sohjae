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

공식 GFM 0.29-gfm 명세의 예제 672개를 모두 실행했다. 출처는 https://github.com/github/cmark-gfm/blob/master/test/spec.txt 이고 고정 snapshot·SHA256·CC BY-SA 출처 표기는 tests/fixtures에 보관한다. 결과의 원문·기대 HTML·실제 HTML은 web/gfm-results.json에 있으며 집계는 docs/gfm-audit.json이다.

편집기 전용 section/span·빈 커서 자리, 선택적 thead/tbody, 기본 왼쪽 정렬을 정규화해 **HTML 트리 구조와 텍스트를 비교**한다. 이 방식은 공식 테스트 도구의 byte-for-byte HTML 비교와 다르다. 안전한 HTML·URL 제한이나 별도 확장은 끄지 않는다. 정규화 기준을 바꿔 실패를 통과로 숨기지 않는다.

같은 비교 기준에서 보강 전 191/672, 현재 **262/672 일치, 410개 불일치**다. 제목 공백/닫는 기호, setext, 코드 구분자 길이·공백·개행, 마지막 코드 개행, 표 헤더 열 수·누락/초과 셀·연속 행, HTML 이름 문자 참조, 코드 안의 emphasis/link 우선순위를 보강했다. 코드 내부 표시 정규화에도 보이는 문자 좌표를 유지한다.

불일치에는 중첩 목록/인용문과 링크·emphasis 세부 규칙 등의 미구현, 편집 DOM 구조, HTML/URL 안전 정책 및 별도 확장 차이가 함께 포함된다. 모든 불일치를 의도된 정책 차이로 간주하지 않는다. **전체 GFM 적합성 통과 또는 인증이 아니다.** 다음 핵심 과제는 계층적 컨테이너 파싱과 정식 delimiter/link 스택, 정책 차이의 개별 분류다.

build.sh는 고정 예제 전체를 재검사하고 gfm-baseline.json에서 기존에 일치하던 예제가 새로 실패하면 종료한다. 알려진 410개 불일치는 결과에 그대로 남긴다. `--check` 성공을 전체 672개 통과로 표현하지 않는다. 의도한 개선을 검토한 뒤에만 `--update-baseline`으로 회귀 기준을 갱신한다.

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

Rust 65개(위치/ABI/문서/파서/공유 모델/투영), 기존·확장 브라우저 34개, WebRTC 코어 8개, 리치·원본 통합 14개가 통과했다. 통합 14개는 375px viewport에서도 다시 통과했다. fmt·Clippy·WASM release, 실제 WASM Node 검사와 SDK 패키지 모듈 일치도 확인한다. GFM 672개 구조 비교는 이 합격 집계와 별도이며 262개 일치/410개 불일치로 보고한다.

직접 표 텍스트를 선택해 붙여넣는 검사도 수행했다. 네이티브 선택이 이전 셀의 끝부터 잡히는 경우에도 선택된 셀 내용만 교체하고 열 구분자는 유지하도록 처리했으며, 리치 수정이 다른 복제본의 전체 원본에 반영됨을 확인했다.
