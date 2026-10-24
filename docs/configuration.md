# 설정

JSON 파일(`config_url`)과 생성 시 객체를 지원한다. 기본값 → 파일 → 생성 시 객체 순으로 병합하며, 실행 중 `set_options(partial)`도 같은 검증을 적용한다. 설정 그룹은 일반 객체여야 하며 배열·null·잘못된 모드·boolean·용량·저장 방식·레이아웃 URL·키 바인딩 명령은 적용 전에 거절한다. 알 수 없는 키는 저장되지만 동작에 사용하지 않는다. 설정 키는 `snake_case`다.

```json
{
  "mode": "hybrid",
  "elements": {},
  "read_only": false,
  "announce_changes": false,
  "show_code_line_numbers": false,
  "show_heading_levels": false,
  "show_paragraph_marks": false,
  "auto_close": {
    "enabled": true,
    "pairs": {
      "bold": true,
      "italic": true,
      "strikethrough": true,
      "highlight": true,
      "inline_code": true,
      "link_brackets": true,
      "html_comment": true
    },
    "wrap_selection": true,
    "skip_closing": true,
    "delete_empty_pair": true
  },
  "attachments": {
    "enabled": true,
    "storage": "embedded",
    "max_file_size": 4194304,
    "max_total_size": 16777216
  },
  "images": { "enabled": true, "storage": "embedded" },
  "layout": { "name": "default" },
  "layouts": {},
  "keybindings": {}
}
```

개별 파일·전체 첨부의 임시 기본값은 각각 4MiB·16MiB이며 바이트 단위 양의 정수로 변경 가능하다. 입력·문서는 별도로 ABI의 32MiB 한도를 적용한다.

## 모드와 요소

`hybrid`는 인라인 서식·링크·제목·목록·인용문의 활성 문법을 노출하고 표 구조는 유지한다. `rich`는 리치 표현을 유지하고 `markdown`은 활성 요소의 원문을 노출한다. 전체 원본 화면은 별도다.

`elements.<kind>.reveal_markdown`을 명시하면 모드 기본값을 덮어쓴다. `true`는 커서 진입 시 노출, `false`는 유지, 생략은 프리셋이다. 현재 렌더러 kind는 `bold`, `bold_italic`, `italic`, `strikethrough`, `highlight`, `inline_code`, `code_block`, `link`, `image`, `heading`, `list`, `quote`, `table`, `footnote`, `rule`, `html`, `comment`, `definition_list`, `definition_term`, `definition`다. Front Matter는 항상 원문으로 편집한다.

## 레이아웃

적용 순서는 기본 CSS → 인스턴스 `layout` → Front Matter에서 선택한 등록 레이아웃이다. `layouts`는 이름별 `{ "css_url": "..." }` 객체다. 등록되지 않은 이름이나 해석할 수 없는 YAML 값은 인스턴스 설정을 사용한다. 현재 읽는 YAML 값은 최상위 `layout`의 단순 문자열(따옴표 선택 가능)이며 이름은 문자·숫자·밑줄·하이픈으로 제한한다. 전체 YAML 검증은 하지 않는다.

```json
{
  "layout": { "name": "default" },
  "layouts": { "serif": { "css_url": "./layouts/serif.css" } }
}
```

```yaml
---
layout: serif
---
```

Shadow DOM 안의 `.markdown_editor`와 CSS 변수를 사용한다. 예: `--body_font_family`, `--body_font_size`, `--body_line_height`, `--content_max_width`, `--text_color`, `--background_color`. 원본 입력은 별도 monospace 글꼴을 사용한다. 폰트 패키지는 번들하지 않는다.

## 파일·키보드

현재 저장 방식은 `embedded`만 허용한다. 외부 저장소 어댑터는 향후 확장 범위다. 이미지 MIME은 PNG·JPEG·GIF·WebP·AVIF를 인라인 표시하고, SVG 등 다른 유형은 일반 다운로드 첨부로 처리한다. Base64 파일명은 `attachment-uri:` 제목 필드에 URI 인코딩해 보존한다.

`keybindings`의 키는 `mod+shift+...` 형식이며 값은 명령 이름이다. 전체 목록과 기본 키는 [API 문서](api.md)에 기록한다. 브라우저 예약 키는 대체 조합 또는 명령 팔레트로 실행한다.

## 생성 옵션과 실행 중 설정

`markdown`(string), `config_url`(string 또는 URL), `wasm_url`(string 또는 URL), `css_text`(string), 공유 옵션 `replica`는 생성 시에만 전달한다. `set_options()`로 바꾸면 TypeError다. 문서 변경에는 `set_markdown()`을 사용한다. `filename`은 선택적 문자열이며 기본 다운로드 이름은 document.md다. 나머지 문서화한 설정은 실행 중 부분 객체로 변경할 수 있다.

설정 파일의 최상위 값도 일반 객체여야 한다. `replica` 인스턴스는 JSON 파일에서 지정할 수 없고 생성 함수의 객체 옵션으로만 제공한다. 잘못된 설정은 편집기를 만들기 전에 거절한다. 같은 컨테이너에 생성 요청이 진행 중이면 두 번째 요청을 거절하며, 첫 요청이 실패하면 재시도할 수 있다.

생성 시 옵션과 `get_options()`의 알려진 설정 객체는 복사한다. 원래 객체나 반환 사본을 바꿔도 설정이 바뀌지 않는다. IME 조합 중 `set_options()`를 여러 번 호출하면 변경을 누적하고, 같은 키는 마지막 값이 우선한다. 조합이 끝날 때 한 번 적용하며 `get_options()`는 적용 전까지 기존 설정을 반환한다. 잘못된 요청은 앞서 대기 중인 유효한 변경도 취소하지 않는다.
