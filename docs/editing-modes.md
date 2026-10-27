# 편집 모드

모드 이름은 `rich`, `hybrid`, `markdown` 세 가지이며 기본값은 `rich`다. 드롭다운 순서도 리치 → 하이브리드 → 마크다운이다. 원본·HTML·읽기는 별도의 화면 전환이다.

| 모드 | 표시 및 편집 |
| --- | --- |
| `rich` / 리치 | 의미론적 HTML 직접 편집. Markdown 구분자는 표시하지 않는다. |
| `hybrid` / 하이브리드 | 렌더링한 결과를 표시하고 커서가 진입한 문법의 원문을 노출한다. 문법별 생성자 옵션으로 리치 유지를 지정할 수 있다. |
| `markdown` / 마크다운 | 모든 원문을 항상 표시한다. 제목 크기, 강조, 코드 등의 스타일을 적용하며 Markdown 기호·빈 줄·HTML 원문·문자 참조를 숨기지 않는다. |

기존 하이브리드의 고정된 문법 노출 목록은 제거했다. 기존 Markdown 모드의 커서 진입 노출 동작은 새 하이브리드로 이동했다. `mode: 'markdown'`의 의미는 항상 보이는 스타일 적용 원문 편집으로 변경되었다. 기존 통합 코드는 이 동작 변경을 고려해야 한다.

## 생성자 설정

```html
<script src="./sohjae.js"></script>
<div id="editor"></div>
<script>
const editor = new Sohjae({
  selector: '#editor',
  mode: 'hybrid',
  elements: {
    table: { reveal_markdown: false },      // 표는 리치 유지
    image: { reveal_markdown: false },      // 이미지는 리치 유지
    code_block: { reveal_markdown: false }, // 코드 블록은 리치 유지
    bold: { reveal_markdown: true },        // 커서 진입 시 **원문** 표시
    heading: { reveal_markdown: true }
  }
});
</script>
```

생략한 문법의 하이브리드 기본값은 `reveal_markdown: true`다. `false`는 리치 유지, `true`는 커서가 해당 문법 범위 안에 있을 때 원문 노출이다. 중첩된 문법에서는 해당 위치의 가장 안쪽 노출 대상이 우선한다. 옵션은 `set_options({ elements: ... })`로도 변경할 수 있다.

주요 키: `heading`, `bold`, `italic`, `strikethrough`, `highlight`, `subscript`, `superscript`, `inline_code`, `link`, `image`, `list`, `quote`, `table`, `code_block`, `rule`, `footnote`, `definition_list`, `definition_term`, `definition`, `html`, `comment`.

이 옵션은 문법 지원을 켜고 끄는 설정이 아니다. 원문 텍스트로 처리되는 이모지·문자 참조 등은 별도 노출 대상이 아니다. 리치 모드와 마크다운 모드는 이 옵션에 따라 표시를 전환하지 않는다.

## 마크다운 모드

```js
new Sohjae({ selector: '#editor', mode: 'markdown' });
```

원문 각 행의 UTF-8 좌표를 유지하는 스타일 적용 편집 화면이다. `#`·`**`·링크 URL·코드 fence·표 구분자도 항상 표시된다. 구분자는 흐린 색으로 표시하고, 본문에는 제목·굵게·기울임·취소선·하이라이트·코드·링크 스타일을 적용한다. 코드 블록 안의 `#`는 제목 스타일을 적용하지 않는다. Enter는 원문에 개행 하나를 삽입한다. 임의 원문 HTML은 실행하지 않고 텍스트로 표시한다.

표·이미지를 실제 요소로 렌더링하지 않으므로 마크다운 모드에는 표 행 이동 핸들과 블록 전환 드롭다운을 표시하지 않는다. 선택·입력·실행 취소·IME·협업은 기존 원문 기반 모델을 사용한다. ‘원본’ 화면은 스타일 없는 textarea다.

## 블록 전환 단축키

블록 드롭다운은 다음 순서를 사용하며, 단축키도 같은 블록 전체 전환을 실행한다. Windows/Linux는 Ctrl+Alt, macOS는 Cmd+Option을 누른다.

| 순서 | 유형 | 단축키 |
| --- | --- | --- |
| 1–6 | h1–h6 | Ctrl/Cmd + Alt/Option + 1–6 |
| 7 | pre > code | Ctrl/Cmd + Alt/Option + 7 |
| 8 | blockquote > p | Ctrl/Cmd + Alt/Option + 8 |
| 9 | div > details | Ctrl/Cmd + Alt/Option + 9 |
| 10 | p | Ctrl/Cmd + Alt/Option + 0 |

단축키는 리치·하이브리드·마크다운 편집에서 현재 최상위 블록에 적용한다. 표·목록 내부에는 적용하지 않는다. 읽기 전용·원본·HTML·읽기 화면과 IME 조합 중에는 실행하지 않는다. macOS Option 조합으로 key 값이 특수문자가 되어도 숫자 키의 code로 판별한다.

표 작성 중 이스케이프하지 않은 `|` 바로 뒤에서 Enter를 누르면 원문에 `\n` 하나만 삽입한다. 리치·하이브리드의 세 가지 문단 Enter 규칙보다 우선한다. 코드 안이나 이스케이프된 `\|`는 이 규칙의 대상이 아니다. 마크다운 모드는 원래의 한 개행 Enter 동작을 사용한다.

리치 모드와 표를 리치로 유지하는 하이브리드 모드에서 마지막 셀의 Tab은 맨 아래에 빈 행을 추가하고 새 행 첫 번째 셀로 이동한다. 그 외 셀의 Tab과 Shift+Tab은 기존 셀 간 이동을 사용한다. 빈 셀의 편집용 자리표시자는 원문이나 내보낸 HTML에 추가되지 않는다. 읽기 전용에서는 행을 추가하지 않는다.
