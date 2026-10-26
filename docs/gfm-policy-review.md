# 확장 또는 정책상의 차이로 인한 GFM 예제와의 불일치 결과

2026-10-23: 동일 비교에서 **585/672 일치, 87개 불일치**다. 아래는 자동 진단 분류와 별도로 원문·기대·실제 출력을 검토한 잔여 예제 목록이다. 합격 예제로 면제하거나 비교를 완화하지 않는다. 각 항목은 적어도 하나의 유지 중인 정책/확장 차이가 있다는 기록이며, 정책을 변경하면 자동으로 모두 통과한다거나 잠재적인 혼합 파싱 문제가 전혀 없다는 보장은 아니다.

<a id="policy-summary"></a>

| 유지하는 동작 | 건수 | 예제 ID | 근거 |
| --- | ---: | --- | --- |
| Front Matter 확장 우선순위 | 2 | [66](#example-66), [68](#example-68) | 문서 첫 --- 쌍을 Front Matter로 처리한다. |
| URL 허용 목록 | 11 | [171](#example-171), [316](#example-316), [317](#example-317), [508](#example-508), [510](#example-510), [604](#example-604), [606](#example-606), [607](#example-607), [609](#example-609), [611](#example-611), [628](#example-628) | 원문의 역슬래시, 허용하지 않는 scheme, 첫 경로의 colon을 차단한다. 628의 FTP도 이 정책에 포함된다. |
| 확장 자동 링크 활성화 | 4 | [610](#example-610), [616](#example-616), [619](#example-619), [620](#example-620) | 기본 CommonMark 자동 링크 예제도 GFM의 일반 URL·이메일 자동 링크가 켜진 상태에서 검사한다. |
| www 링크 HTTPS 기본값 | 7 | [621](#example-621), [622](#example-622), [623](#example-623), [624](#example-624), [625](#example-625), [626](#example-626), [627](#example-627) | GFM 기대값 http 대신 기존 https 기본값을 유지한다. 괄호·엔티티 접미사 경계는 수정했다. |
| 원본 a 속성 허용 목록 | 10 | [132](#example-132), [156](#example-156), [327](#example-327), [354](#example-354), [485](#example-485), [486](#example-486), [649](#example-649), [650](#example-650), [662](#example-662), [663](#example-663) | 원본 HTML의 a는 name 속성만 허용한다. Markdown 링크의 href 지원과 구분한다. |
| 주석 제거 | 2 | [146](#example-146), [645](#example-645) | 읽기 출력에서 HTML 주석을 제거한다. |
| 기타 원본 HTML 제한 | 51 | [118](#example-118), [119](#example-119), [120](#example-120), [121](#example-121), [122](#example-122), [123](#example-123), [124](#example-124), [125](#example-125), [126](#example-126), [127](#example-127), [128](#example-128), [129](#example-129), [130](#example-130), [131](#example-131), [133](#example-133), [134](#example-134), [136](#example-136), [137](#example-137), [138](#example-138), [139](#example-139), [140](#example-140), [141](#example-141), [142](#example-142), [143](#example-143), [144](#example-144), [145](#example-145), [147](#example-147), [149](#example-149), [150](#example-150), [151](#example-151), [153](#example-153), [154](#example-154), [155](#example-155), [157](#example-157), [158](#example-158), [159](#example-159), [160](#example-160), [170](#example-170), [500](#example-500), [503](#example-503), [532](#example-532), [544](#example-544), [632](#example-632), [633](#example-633), [634](#example-634), [636](#example-636), [642](#example-642), [646](#example-646), [647](#example-647), [648](#example-648), [652](#example-652) | 허용하지 않는 태그·선언·처리 명령을 실행 가능한 HTML로 출력하지 않고 원문으로 보존/표시한다. 관련 블록·인라인 구조 차이도 남는다. |

이번에 정책과 독립적으로 수정한 항목: 탭 열 계산과 원문 매핑, 여러 줄 setext, 들여쓰기/펜스 코드의 경계와 빈 줄, 인용문 lazy continuation, 중첩 목록의 loose 범위, 잘못된 인라인 링크의 참조 재해석, 목적지의 NBSP, 자동 링크 괄호·엔티티·메일 도메인, HTML 태그 문법 검증과 허용 HTML 블록의 문자 그대로 처리, 구조 주변 HTML 공백.

기존 정규화 테스트의 `<br />` 다음에는 빈 줄을 넣었다. GFM에서 독립된 HTML 태그 줄은 빈 줄 전까지 HTML 블록이므로, 뒤 문단의 hard break 변환을 검사하려면 블록을 먼저 끝내야 한다. 별도 회귀 검사는 HTML 블록 내부 Markdown이 정규화되지 않는 점과 문단 중간의 HTML 태그가 문단을 끊지 않는 점을 확인한다.

모든 예제의 원문과 출력: `web/gfm-results.json`. 출처·라이선스: `spec/NOTICE.md`.

## 87건의 실제 렌더링 결과 비교

87개는 렌더러의 확장 또는 정책상 차이로 전체 GFM과의 차이가 있다.

고정 GFM 0.29-gfm 예제의 기준 HTML과 `web/gfm-results.json`의 Sohjae HTML을 같은 브라우저·동일한 기본 스타일로 렌더링한 결과다. 이미지이므로 Wiki 자체의 HTML 정리 정책이 비교 결과를 바꾸지 않는다. 링크는 클릭하지 않았으며 스크립트 실행과 외부 리소스 로딩은 차단했다. 따라서 외부 이미지·리소스는 로드되지 않으며, 제품 테마의 시각 디자인 비교가 아니라 출력 내용과 구조의 비교다. 빈 결과도 그대로 표시한다. 각 항목에는 원문과 두 HTML 출력도 함께 기록한다. `section`·`span`, 원문 좌표 속성 등 편집기 보조 요소는 구조 비교에서 제외되며 아래 설명의 불일치 원인과 구분한다.

출처: [cmark-gfm 공식 예제](https://github.com/github/cmark-gfm/blob/master/test/spec.txt), John MacFarlane 및 기여자. 예제와 이를 재현한 비교 결과는 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)을 따른다. 자세한 출처는 [NOTICE](https://github.com/mson0129/sohjae/blob/main/spec/NOTICE.md)를 참고한다.

<a id="example-66"></a>

### 예제 66 · Setext headings

**불일치 원인 — Front Matter 확장 우선순위:** 문서 시작의 `---`부터 다음 `---`까지를 Front Matter로 먼저 소비한다. GFM은 첫 줄을 수평선, `Foo`와 그 밑줄을 H2로 출력하지만, Sohjae는 이 부분을 본문에 표시하지 않고 `Bar` 제목과 `Baz` 문단부터 출력한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 66 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/66-gfm.jpg) | ![Sohjae 예제 66 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/66-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
---
Foo
---
Bar
---
Baz
```

GFM 기준 HTML

<pre><code>&lt;hr /&gt;
&lt;h2&gt;Foo&lt;/h2&gt;
&lt;h2&gt;Bar&lt;/h2&gt;
&lt;p&gt;Baz&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;12&quot; data-end=&quot;19&quot;&gt;&lt;h2 id=&quot;bar&quot; data-kind=&quot;heading&quot; data-start=&quot;12&quot; data-end=&quot;19&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;12&quot; data-end=&quot;15&quot;&gt;Bar&lt;/span&gt;&lt;/h2&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;20&quot; data-end=&quot;23&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;20&quot; data-end=&quot;23&quot;&gt;Baz&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-68"></a>

### 예제 68 · Setext headings

**불일치 원인 — Front Matter 확장 우선순위:** 두 줄의 `---`를 빈 Front Matter의 시작·종료 구분자로 소비한다. GFM의 수평선 두 개와 달리 Sohjae 본문 출력은 비어 있다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 68 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/68-gfm.jpg) | ![Sohjae 예제 68 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/68-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
---
---
```

GFM 기준 HTML

<pre><code>&lt;hr /&gt;
&lt;hr /&gt;</code></pre>

Sohjae 출력 HTML

<pre><code></code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-118"></a>

### 예제 118 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 원문 HTML의 `table`·`tr`·`td`·`pre`를 허용하지 않아 전체를 문자 그대로 보존하는 raw 블록으로 표시한다. GFM의 HTML 표 구조 및 빈 줄 뒤 `_world_`의 강조 처리와 달라진다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 118 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/118-gfm.jpg) | ![Sohjae 예제 118 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/118-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<table><tr><td>
<pre>
**Hello**,

_world_.
</pre>
</td></tr></table>
```

GFM 기준 HTML

<pre><code>&lt;table&gt;&lt;tr&gt;&lt;td&gt;
&lt;pre&gt;
**Hello**,
&lt;p&gt;&lt;em&gt;world&lt;/em&gt;.
&lt;/pre&gt;&lt;/p&gt;
&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;68&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;68&quot;&gt;&amp;lt;table&amp;gt;&amp;lt;tr&amp;gt;&amp;lt;td&amp;gt;
&amp;lt;pre&amp;gt;
**Hello**,

_world_.
&amp;lt;/pre&amp;gt;
&amp;lt;/td&amp;gt;&amp;lt;/tr&amp;gt;&amp;lt;/table&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-119"></a>

### 예제 119 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 원문 HTML 표를 실제 표로 삽입하지 않고 태그를 포함한 텍스트 블록으로 표시한다. 표 뒤 `okay.` 문단은 별도로 유지된다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 119 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/119-gfm.jpg) | ![Sohjae 예제 119 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/119-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<table>
  <tr>
    <td>
           hi
    </td>
  </tr>
</table>

okay.
```

GFM 기준 HTML

<pre><code>&lt;table&gt;
  &lt;tr&gt;
    &lt;td&gt;
           hi
    &lt;/td&gt;
  &lt;/tr&gt;
&lt;/table&gt;
&lt;p&gt;okay.&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;64&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;64&quot;&gt;&amp;lt;table&amp;gt;
  &amp;lt;tr&amp;gt;
    &amp;lt;td&amp;gt;
           hi
    &amp;lt;/td&amp;gt;
  &amp;lt;/tr&amp;gt;
&amp;lt;/table&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;66&quot; data-end=&quot;71&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;66&quot; data-end=&quot;71&quot;&gt;okay.&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-120"></a>

### 예제 120 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 원문의 `div`·`foo`는 허용 태그가 아니다. GFM은 이 영역을 HTML 블록으로 보존하지만, Sohjae는 `div`를 텍스트 블록으로 표시하고 뒤의 `*hello*`를 강조로 파싱한다. `a`는 허용되므로 태그별 처리도 달라진다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 120 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/120-gfm.jpg) | ![Sohjae 예제 120 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/120-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
 <div>
  *hello*
         <foo><a>
```

GFM 기준 HTML

<pre><code> &lt;div&gt;
  *hello*
         &lt;foo&gt;&lt;a&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;6&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;6&quot;&gt; &amp;lt;div&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;7&quot; data-end=&quot;34&quot;&gt;&lt;p&gt;&lt;em data-kind=&quot;italic&quot; data-start=&quot;9&quot; data-end=&quot;16&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;10&quot; data-end=&quot;15&quot;&gt;hello&lt;/span&gt;&lt;/em&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;16&quot; data-end=&quot;17&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;26&quot; data-end=&quot;31&quot;&gt;&amp;lt;foo&amp;gt;&lt;/span&gt;&lt;a&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-121"></a>

### 예제 121 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 닫는 `</div>`를 실행 가능한 HTML로 내보내지 않고 원문 텍스트로 표시한다. 그 뒤 `*foo*`도 GFM의 같은 HTML 블록 안의 리터럴 텍스트와 달리 Sohjae에서는 강조로 처리된다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 121 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/121-gfm.jpg) | ![Sohjae 예제 121 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/121-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
</div>
*foo*
```

GFM 기준 HTML

<pre><code>&lt;/div&gt;
*foo*</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;6&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;6&quot;&gt;&amp;lt;/div&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;7&quot; data-end=&quot;12&quot;&gt;&lt;p&gt;&lt;em data-kind=&quot;italic&quot; data-start=&quot;7&quot; data-end=&quot;12&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;8&quot; data-end=&quot;11&quot;&gt;foo&lt;/span&gt;&lt;/em&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-122"></a>

### 예제 122 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 대문자 `DIV`도 소문자 `div`와 동일하게 허용 대상에서 제외한다. Sohjae는 전체 블록을 텍스트로 보존하므로 GFM이 빈 줄 뒤에 생성하는 `Markdown` 강조 문단도 생성하지 않는다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 122 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/122-gfm.jpg) | ![Sohjae 예제 122 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/122-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<DIV CLASS="foo">

*Markdown*

</DIV>
```

GFM 기준 HTML

<pre><code>&lt;DIV CLASS=&quot;foo&quot;&gt;
&lt;p&gt;&lt;em&gt;Markdown&lt;/em&gt;&lt;/p&gt;
&lt;/DIV&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;37&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;37&quot;&gt;&amp;lt;DIV CLASS=&amp;quot;foo&amp;quot;&amp;gt;

*Markdown*

&amp;lt;/DIV&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-123"></a>

### 예제 123 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 속성이 여러 줄에 걸친 원본 `div`도 허용하지 않는다. GFM의 HTML 요소 대신 `id`·`class`와 줄바꿈까지 포함한 원문을 표시한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 123 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/123-gfm.jpg) | ![Sohjae 예제 123 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/123-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<div id="foo"
  class="bar">
</div>
```

GFM 기준 HTML

<pre><code>&lt;div id=&quot;foo&quot;
  class=&quot;bar&quot;&gt;
&lt;/div&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;35&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;35&quot;&gt;&amp;lt;div id=&amp;quot;foo&amp;quot;
  class=&amp;quot;bar&amp;quot;&amp;gt;
&amp;lt;/div&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-124"></a>

### 예제 124 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** `class` 값 안에 줄바꿈이 있는 `div`도 원본 HTML 허용 목록 밖이다. GFM이 유지하는 HTML 요소를 Sohjae는 태그 문자열로 표시한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 124 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/124-gfm.jpg) | ![Sohjae 예제 124 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/124-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<div id="foo" class="bar
  baz">
</div>
```

GFM 기준 HTML

<pre><code>&lt;div id=&quot;foo&quot; class=&quot;bar
  baz&quot;&gt;
&lt;/div&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;39&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;39&quot;&gt;&amp;lt;div id=&amp;quot;foo&amp;quot; class=&amp;quot;bar
  baz&amp;quot;&amp;gt;
&amp;lt;/div&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-125"></a>

### 예제 125 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 닫히지 않은 원본 `div`를 HTML 블록으로 이어 붙이지 않는다. `div` 자체는 텍스트로 표시하고 뒤의 `*foo*`·`*bar*`를 일반 Markdown 강조 문단으로 처리하므로 블록 경계도 달라진다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 125 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/125-gfm.jpg) | ![Sohjae 예제 125 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/125-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<div>
*foo*

*bar*
```

GFM 기준 HTML

<pre><code>&lt;div&gt;
*foo*
&lt;p&gt;&lt;em&gt;bar&lt;/em&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;5&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;5&quot;&gt;&amp;lt;div&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;6&quot; data-end=&quot;11&quot;&gt;&lt;p&gt;&lt;em data-kind=&quot;italic&quot; data-start=&quot;6&quot; data-end=&quot;11&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;7&quot; data-end=&quot;10&quot;&gt;foo&lt;/span&gt;&lt;/em&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;13&quot; data-end=&quot;18&quot;&gt;&lt;p&gt;&lt;em data-kind=&quot;italic&quot; data-start=&quot;13&quot; data-end=&quot;18&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;14&quot; data-end=&quot;17&quot;&gt;bar&lt;/span&gt;&lt;/em&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-126"></a>

### 예제 126 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 완성되지 않은 `<div id="foo"`를 원본 HTML 블록으로 통과시키지 않는다. Sohjae는 이를 문단 텍스트로 표시하고 다음 줄의 `*hi*`를 강조로 처리한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 126 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/126-gfm.jpg) | ![Sohjae 예제 126 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/126-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<div id="foo"
*hi*
```

GFM 기준 HTML

<pre><code>&lt;div id=&quot;foo&quot;
*hi*</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;18&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;4&quot;&gt;&amp;lt;div&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;4&quot; data-end=&quot;5&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;5&quot; data-end=&quot;7&quot;&gt;id&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;7&quot; data-end=&quot;13&quot;&gt;=&amp;quot;foo&amp;quot;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;13&quot; data-end=&quot;14&quot;&gt;
&lt;/span&gt;&lt;em data-kind=&quot;italic&quot; data-start=&quot;14&quot; data-end=&quot;18&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;15&quot; data-end=&quot;17&quot;&gt;hi&lt;/span&gt;&lt;/em&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-127"></a>

### 예제 127 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 완성되지 않은 `<div class`를 GFM처럼 HTML 블록 시작으로 유지하지 않고 문단 텍스트로 보존한다. 화면에서 비슷해 보여도 원본 HTML 노드와 텍스트 노드의 구조가 다르다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 127 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/127-gfm.jpg) | ![Sohjae 예제 127 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/127-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<div class
foo
```

GFM 기준 HTML

<pre><code>&lt;div class
foo</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;14&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;4&quot;&gt;&amp;lt;div&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;4&quot; data-end=&quot;5&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;5&quot; data-end=&quot;10&quot;&gt;class&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;10&quot; data-end=&quot;11&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;11&quot; data-end=&quot;14&quot;&gt;foo&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-128"></a>

### 예제 128 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 잘못된 속성 모양의 `<div *???-&&&-<---`를 HTML 블록으로 통과시키지 않는다. Sohjae에서는 해당 원문이 텍스트이며 다음 줄 `*foo*`는 강조로 해석된다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 128 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/128-gfm.jpg) | ![Sohjae 예제 128 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/128-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<div *???-&&&-<---
*foo*
```

GFM 기준 HTML

<pre><code>&lt;div *???-&amp;&amp;&amp;-&lt;---
*foo*</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;24&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;4&quot;&gt;&amp;lt;div&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;4&quot; data-end=&quot;5&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;5&quot; data-end=&quot;10&quot;&gt;*???-&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;10&quot; data-end=&quot;11&quot;&gt;&amp;amp;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;11&quot; data-end=&quot;12&quot;&gt;&amp;amp;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;12&quot; data-end=&quot;14&quot;&gt;&amp;amp;-&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;14&quot; data-end=&quot;18&quot;&gt;&amp;lt;---&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;18&quot; data-end=&quot;19&quot;&gt;
&lt;/span&gt;&lt;em data-kind=&quot;italic&quot; data-start=&quot;19&quot; data-end=&quot;24&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;20&quot; data-end=&quot;23&quot;&gt;foo&lt;/span&gt;&lt;/em&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-129"></a>

### 예제 129 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 바깥 `div`가 허용되지 않아 안쪽 `a`까지 포함한 전체 원문을 텍스트 블록으로 보존한다. 따라서 GFM이 유지하는 `div`·링크 요소를 생성하지 않는다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 129 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/129-gfm.jpg) | ![Sohjae 예제 129 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/129-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<div><a href="bar">*foo*</a></div>
```

GFM 기준 HTML

<pre><code>&lt;div&gt;&lt;a href=&quot;bar&quot;&gt;*foo*&lt;/a&gt;&lt;/div&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;34&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;34&quot;&gt;&amp;lt;div&amp;gt;&amp;lt;a href=&amp;quot;bar&amp;quot;&amp;gt;*foo*&amp;lt;/a&amp;gt;&amp;lt;/div&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-130"></a>

### 예제 130 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 원본 HTML의 `table`·`tr`·`td`를 허용하지 않는다. GFM의 표 노드 대신 태그와 `foo`를 포함한 원문 텍스트를 표시한다. Markdown 표 문법의 지원 여부와는 별개다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 130 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/130-gfm.jpg) | ![Sohjae 예제 130 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/130-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<table><tr><td>
foo
</td></tr></table>
```

GFM 기준 HTML

<pre><code>&lt;table&gt;&lt;tr&gt;&lt;td&gt;
foo
&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;38&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;38&quot;&gt;&amp;lt;table&amp;gt;&amp;lt;tr&amp;gt;&amp;lt;td&amp;gt;
foo
&amp;lt;/td&amp;gt;&amp;lt;/tr&amp;gt;&amp;lt;/table&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-131"></a>

### 예제 131 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** `<div></div>`를 원문 텍스트 블록으로 끝내고 다음 펜스를 코드 블록으로 해석한다. GFM은 빈 줄 전까지 펜스까지 HTML 블록에 포함하므로 코드 블록을 만들지 않는다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 131 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/131-gfm.jpg) | ![Sohjae 예제 131 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/131-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

````markdown
<div></div>
``` c
int x = 33;
```
````

GFM 기준 HTML

`<pre><code>&lt;div&gt;&lt;/div&gt;</code></pre> c
int x = 33;
```
````

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;11&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;11&quot;&gt;&amp;lt;div&amp;gt;&amp;lt;/div&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;12&quot; data-end=&quot;33&quot;&gt;&lt;pre data-kind=&quot;code_block&quot; data-start=&quot;12&quot; data-end=&quot;33&quot;&gt;&lt;code data-language=&quot;c&quot;&gt;&lt;span class=&quot;code_line&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;18&quot; data-end=&quot;29&quot;&gt;int x = 33;&lt;/span&gt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;29&quot; data-end=&quot;30&quot;&gt;
&lt;/span&gt;&lt;/code&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-132"></a>

### 예제 132 · HTML blocks

**불일치 원인 — 원본 a 속성 허용 목록:** 원본 HTML의 `a`는 `name` 속성만 허용하므로 `href="foo"`를 제거한다. GFM은 해당 속성을 유지하지만 Sohjae는 목적지 없는 `a`를 출력한다. Markdown 문법으로 작성한 링크의 `href` 지원과는 별개의 정책이다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 132 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/132-gfm.jpg) | ![Sohjae 예제 132 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/132-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<a href="foo">
*bar*
</a>
```

GFM 기준 HTML

<pre><code>&lt;a href=&quot;foo&quot;&gt;
*bar*
&lt;/a&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;25&quot;&gt;&lt;a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;14&quot; data-end=&quot;21&quot;&gt;
*bar*
&lt;/span&gt;&lt;/a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;25&quot; data-end=&quot;26&quot;&gt;
&lt;/span&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-133"></a>

### 예제 133 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 사용자 정의 `Warning` 태그는 허용 목록 밖이다. Sohjae는 시작·종료 태그와 `*bar*`를 텍스트로 보존하며 HTML 요소로 출력하지 않는다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 133 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/133-gfm.jpg) | ![Sohjae 예제 133 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/133-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<Warning>
*bar*
</Warning>
```

GFM 기준 HTML

<pre><code>&lt;Warning&gt;
*bar*
&lt;/Warning&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;26&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;26&quot;&gt;&amp;lt;Warning&amp;gt;
*bar*
&amp;lt;/Warning&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-134"></a>

### 예제 134 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 원본 HTML의 `i`와 `class`를 그대로 삽입하지 않는다. GFM의 HTML 요소 대신 `*bar*`까지 포함한 원문 블록을 표시한다. Markdown 강조 문법의 지원과는 별개다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 134 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/134-gfm.jpg) | ![Sohjae 예제 134 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/134-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<i class="foo">
*bar*
</i>
```

GFM 기준 HTML

<pre><code>&lt;i class=&quot;foo&quot;&gt;
*bar*
&lt;/i&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;26&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;26&quot;&gt;&amp;lt;i class=&amp;quot;foo&amp;quot;&amp;gt;
*bar*
&amp;lt;/i&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-136"></a>

### 예제 136 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 원본 `del` 태그는 허용 목록에 없다. Sohjae는 `del`과 내부 `*foo*`를 문자 그대로 표시하고 HTML 삭제선 요소를 생성하지 않는다. Markdown의 `~~취소선~~` 지원과는 별개다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 136 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/136-gfm.jpg) | ![Sohjae 예제 136 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/136-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<del>
*foo*
</del>
```

GFM 기준 HTML

<pre><code>&lt;del&gt;
*foo*
&lt;/del&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;18&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;18&quot;&gt;&amp;lt;del&amp;gt;
*foo*
&amp;lt;/del&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-137"></a>

### 예제 137 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 원본 `del` 블록 전체를 텍스트로 보존한다. GFM은 빈 줄 안의 `*foo*`를 강조 문단으로 만들지만 Sohjae의 보존 블록 내부에서는 Markdown을 다시 파싱하지 않는다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 137 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/137-gfm.jpg) | ![Sohjae 예제 137 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/137-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<del>

*foo*

</del>
```

GFM 기준 HTML

<pre><code>&lt;del&gt;
&lt;p&gt;&lt;em&gt;foo&lt;/em&gt;&lt;/p&gt;
&lt;/del&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;20&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;20&quot;&gt;&amp;lt;del&amp;gt;

*foo*

&amp;lt;/del&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-138"></a>

### 예제 138 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 원본 `del` 태그가 들어 있는 줄을 보존 블록으로 표시한다. GFM의 삭제선 요소 안의 강조와 달리, Sohjae에서는 `<del>*foo*</del>` 자체가 표시된다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 138 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/138-gfm.jpg) | ![Sohjae 예제 138 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/138-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<del>*foo*</del>
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;del&gt;&lt;em&gt;foo&lt;/em&gt;&lt;/del&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;16&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;16&quot;&gt;&amp;lt;del&amp;gt;*foo*&amp;lt;/del&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-139"></a>

### 예제 139 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 원본 `pre`·`code` 요소를 허용하지 않아 `language` 속성과 코드 내용을 포함한 전체 HTML을 텍스트로 보존한다. 뒤의 `okay`는 별도 문단으로 처리한다. Markdown 코드 블록과 구분되는 정책이다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 139 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/139-gfm.jpg) | ![Sohjae 예제 139 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/139-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<pre language="haskell"><code>
import Text.HTML.TagSoup

main :: IO ()
main = print $ parseTags tags
</code></pre>
okay
```

GFM 기준 HTML

<pre><code>&lt;pre language=&quot;haskell&quot;&gt;&lt;code&gt;
import Text.HTML.TagSoup

main :: IO ()
main = print $ parseTags tags
&lt;/code&gt;&lt;/pre&gt;
&lt;p&gt;okay&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;114&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;114&quot;&gt;&amp;lt;pre language=&amp;quot;haskell&amp;quot;&amp;gt;&amp;lt;code&amp;gt;
import Text.HTML.TagSoup

main :: IO ()
main = print $ parseTags tags
&amp;lt;/code&amp;gt;&amp;lt;/pre&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;115&quot; data-end=&quot;119&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;115&quot; data-end=&quot;119&quot;&gt;okay&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-140"></a>

### 예제 140 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 원본 `script`를 실행 가능한 HTML로 삽입하지 않는다. GFM 기준 HTML에 남는 스크립트 태그와 내용을 Sohjae는 원문 텍스트로 표시하고, 뒤 `okay`는 문단으로 처리한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 140 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/140-gfm.jpg) | ![Sohjae 예제 140 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/140-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<script type="text/javascript">
// JavaScript example

document.getElementById("demo").innerHTML = "Hello JavaScript!";
</script>
okay
```

GFM 기준 HTML

<pre><code>&lt;script type=&quot;text/javascript&quot;&gt;
// JavaScript example

document.getElementById(&quot;demo&quot;).innerHTML = &quot;Hello JavaScript!&quot;;
&lt;/script&gt;
&lt;p&gt;okay&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;129&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;129&quot;&gt;&amp;lt;script type=&amp;quot;text/javascript&amp;quot;&amp;gt;
// JavaScript example

document.getElementById(&amp;quot;demo&amp;quot;).innerHTML = &amp;quot;Hello JavaScript!&amp;quot;;
&amp;lt;/script&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;130&quot; data-end=&quot;134&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;130&quot; data-end=&quot;134&quot;&gt;okay&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-141"></a>

### 예제 141 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 여러 줄의 원본 `style` 선언을 CSS 요소로 삽입하지 않는다. Sohjae에서는 선언과 CSS가 문단·보존 블록 등으로 표시되어, GFM의 단일 style 블록과 요소 구조·빈 줄 처리도 다르다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 141 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/141-gfm.jpg) | ![Sohjae 예제 141 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/141-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<style
  type="text/css">
h1 {color:red;}

p {color:blue;}
</style>
okay
```

GFM 기준 HTML

<pre><code>&lt;style
  type=&quot;text/css&quot;&gt;
h1 {color:red;}

p {color:blue;}
&lt;/style&gt;
&lt;p&gt;okay&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;41&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;6&quot;&gt;&amp;lt;style&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;6&quot; data-end=&quot;7&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;9&quot; data-end=&quot;13&quot;&gt;type&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;13&quot; data-end=&quot;25&quot;&gt;=&amp;quot;text/css&amp;quot;&amp;gt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;25&quot; data-end=&quot;26&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;26&quot; data-end=&quot;28&quot;&gt;h1&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;28&quot; data-end=&quot;29&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;29&quot; data-end=&quot;35&quot;&gt;{color&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;35&quot; data-end=&quot;41&quot;&gt;:red;}&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;43&quot; data-end=&quot;58&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;43&quot; data-end=&quot;44&quot;&gt;p&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;44&quot; data-end=&quot;45&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;45&quot; data-end=&quot;51&quot;&gt;{color&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;51&quot; data-end=&quot;58&quot;&gt;:blue;}&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;59&quot; data-end=&quot;67&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;59&quot; data-end=&quot;67&quot;&gt;&amp;lt;/style&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;68&quot; data-end=&quot;72&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;68&quot; data-end=&quot;72&quot;&gt;okay&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-142"></a>

### 예제 142 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 닫히지 않은 여러 줄 `style`을 GFM처럼 HTML 블록으로 유지하지 않는다. 태그 원문과 뒤의 `foo`가 일반 텍스트 문단으로 표시된다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 142 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/142-gfm.jpg) | ![Sohjae 예제 142 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/142-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<style
  type="text/css">

foo
```

GFM 기준 HTML

<pre><code>&lt;style
  type=&quot;text/css&quot;&gt;

foo</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;25&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;6&quot;&gt;&amp;lt;style&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;6&quot; data-end=&quot;7&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;9&quot; data-end=&quot;13&quot;&gt;type&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;13&quot; data-end=&quot;25&quot;&gt;=&amp;quot;text/css&amp;quot;&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;27&quot; data-end=&quot;30&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;27&quot; data-end=&quot;30&quot;&gt;foo&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-143"></a>

### 예제 143 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 인용문 안에서도 원본 `div`는 허용하지 않는다. 인용문 자체는 유지하지만 `div`는 텍스트 블록으로 표시하므로 GFM의 인용문 내부 HTML 구조와 다르다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 143 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/143-gfm.jpg) | ![Sohjae 예제 143 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/143-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
> <div>
> foo

bar
```

GFM 기준 HTML

<pre><code>&lt;blockquote&gt;
&lt;div&gt;
foo
&lt;/blockquote&gt;
&lt;p&gt;bar&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;13&quot;&gt;&lt;blockquote data-kind=&quot;quote&quot; data-start=&quot;0&quot; data-end=&quot;13&quot;&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;2&quot; data-end=&quot;7&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;2&quot; data-end=&quot;7&quot;&gt;&amp;lt;div&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;10&quot; data-end=&quot;13&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;10&quot; data-end=&quot;13&quot;&gt;foo&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;&lt;/blockquote&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;15&quot; data-end=&quot;18&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;15&quot; data-end=&quot;18&quot;&gt;bar&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-144"></a>

### 예제 144 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 목록 항목 안의 원본 `div`를 HTML 노드 대신 태그 문자열로 표시한다. 두 목록 항목은 유지되지만 첫 항목의 내부 구조가 GFM과 다르다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 144 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/144-gfm.jpg) | ![Sohjae 예제 144 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/144-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
- <div>
- foo
```

GFM 기준 HTML

<pre><code>&lt;ul&gt;
&lt;li&gt;
&lt;div&gt;
&lt;/li&gt;
&lt;li&gt;foo&lt;/li&gt;
&lt;/ul&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;13&quot;&gt;&lt;ul&gt;&lt;li class=&quot;list_item&quot; data-depth=&quot;0&quot; data-kind=&quot;list&quot; data-start=&quot;0&quot; data-end=&quot;7&quot;&gt;
&lt;section data-block=&quot;1&quot; data-start=&quot;2&quot; data-end=&quot;7&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;2&quot; data-end=&quot;7&quot;&gt;&amp;lt;div&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;
&lt;/li&gt;&lt;li class=&quot;list_item&quot; data-depth=&quot;0&quot; data-kind=&quot;list&quot; data-start=&quot;8&quot; data-end=&quot;13&quot;&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;10&quot; data-end=&quot;13&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;10&quot; data-end=&quot;13&quot;&gt;foo&lt;/span&gt;&lt;/section&gt;&lt;/li&gt;&lt;/ul&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-145"></a>

### 예제 145 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 원본 `style`을 CSS로 적용하지 않고 태그와 스타일 문자열을 표시한다. 다음 줄 `*foo*`의 강조 문단은 별도로 처리된다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 145 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/145-gfm.jpg) | ![Sohjae 예제 145 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/145-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<style>p{color:red;}</style>
*foo*
```

GFM 기준 HTML

<pre><code>&lt;style&gt;p{color:red;}&lt;/style&gt;
&lt;p&gt;&lt;em&gt;foo&lt;/em&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;28&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;28&quot;&gt;&amp;lt;style&amp;gt;p{color:red;}&amp;lt;/style&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;29&quot; data-end=&quot;34&quot;&gt;&lt;p&gt;&lt;em data-kind=&quot;italic&quot; data-start=&quot;29&quot; data-end=&quot;34&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;30&quot; data-end=&quot;33&quot;&gt;foo&lt;/span&gt;&lt;/em&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-146"></a>

### 예제 146 · HTML blocks

**불일치 원인 — 주석 제거:** 읽기 출력에서 HTML 주석을 제거한다. GFM은 주석 및 바로 뒤 `*bar*`를 HTML 블록에 남기지만, Sohjae는 주석을 제거한 뒤 `bar`와 `baz`를 강조로 처리하므로 주변 파싱 결과도 달라진다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 146 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/146-gfm.jpg) | ![Sohjae 예제 146 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/146-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<!-- foo -->*bar*
*baz*
```

GFM 기준 HTML

<pre><code>&lt;!-- foo --&gt;*bar*
&lt;p&gt;&lt;em&gt;baz&lt;/em&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;23&quot;&gt;&lt;p&gt;&lt;em data-kind=&quot;italic&quot; data-start=&quot;12&quot; data-end=&quot;17&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;13&quot; data-end=&quot;16&quot;&gt;bar&lt;/span&gt;&lt;/em&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;17&quot; data-end=&quot;18&quot;&gt;
&lt;/span&gt;&lt;em data-kind=&quot;italic&quot; data-start=&quot;18&quot; data-end=&quot;23&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;19&quot; data-end=&quot;22&quot;&gt;baz&lt;/span&gt;&lt;/em&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-147"></a>

### 예제 147 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 원본 `script` 및 종료 태그 뒤 같은 줄의 텍스트를 실행 가능한 HTML로 출력하지 않고 보존 블록에 표시한다. GFM이 원본 HTML로 유지하는 영역과 출력 노드 종류가 다르다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 147 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/147-gfm.jpg) | ![Sohjae 예제 147 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/147-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<script>
foo
</script>1. *bar*
```

GFM 기준 HTML

<pre><code>&lt;script&gt;
foo
&lt;/script&gt;1. *bar*</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;30&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;30&quot;&gt;&amp;lt;script&amp;gt;
foo
&amp;lt;/script&amp;gt;1. *bar*&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-149"></a>

### 예제 149 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** `<?php … ?>` 처리 명령을 원본 HTML 블록으로 통과시키지 않고 텍스트로 표시한다. 빈 줄과 들여쓰기도 일반 Markdown 경계로 처리되어 GFM의 단일 처리 명령 블록과 구조가 달라진다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 149 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/149-gfm.jpg) | ![Sohjae 예제 149 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/149-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<?php

  echo '>';

?>
okay
```

GFM 기준 HTML

<pre><code>&lt;?php

  echo &#x27;&gt;&#x27;;

?&gt;
&lt;p&gt;okay&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;5&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;5&quot;&gt;&amp;lt;?php&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;7&quot; data-end=&quot;18&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;9&quot; data-end=&quot;13&quot;&gt;echo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;13&quot; data-end=&quot;14&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;14&quot; data-end=&quot;18&quot;&gt;&amp;#39;&amp;gt;&amp;#39;;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;20&quot; data-end=&quot;27&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;20&quot; data-end=&quot;22&quot;&gt;?&amp;gt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;22&quot; data-end=&quot;23&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;23&quot; data-end=&quot;27&quot;&gt;okay&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-150"></a>

### 예제 150 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** `<!DOCTYPE html>` 문서 선언을 본문에 적용되는 HTML 선언으로 내보내지 않고 문단 안의 텍스트로 표시한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 150 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/150-gfm.jpg) | ![Sohjae 예제 150 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/150-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<!DOCTYPE html>
```

GFM 기준 HTML

<pre><code>&lt;!DOCTYPE html&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;15&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;1&quot;&gt;&amp;lt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;1&quot; data-end=&quot;9&quot;&gt;!DOCTYPE&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;9&quot; data-end=&quot;10&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;10&quot; data-end=&quot;15&quot;&gt;html&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-151"></a>

### 예제 151 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** CDATA 선언을 원본 HTML 블록으로 통과시키지 않는다. 선언과 내용이 텍스트로 표시되고, 내부 빈 줄·들여쓰기가 일반 Markdown으로 처리되어 문단·코드 블록 구조도 GFM과 달라진다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 151 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/151-gfm.jpg) | ![Sohjae 예제 151 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/151-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<![CDATA[
function matchwo(a,b)
{
  if (a < b && a < 0) then {
    return 1;

  } else {

    return 0;
  }
}
]]>
okay
```

GFM 기준 HTML

<pre><code>&lt;![CDATA[
function matchwo(a,b)
{
  if (a &lt; b &amp;&amp; a &lt; 0) then {
    return 1;

  } else {

    return 0;
  }
}
]]&gt;
&lt;p&gt;okay&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;76&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;1&quot;&gt;&amp;lt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;1&quot; data-end=&quot;2&quot;&gt;!&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;2&quot; data-end=&quot;8&quot;&gt;[CDATA&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;8&quot; data-end=&quot;9&quot;&gt;[&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;9&quot; data-end=&quot;10&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;10&quot; data-end=&quot;18&quot;&gt;function&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;18&quot; data-end=&quot;19&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;19&quot; data-end=&quot;31&quot;&gt;matchwo(a,b)&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;31&quot; data-end=&quot;32&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;32&quot; data-end=&quot;33&quot;&gt;{&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;33&quot; data-end=&quot;34&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;36&quot; data-end=&quot;38&quot;&gt;if&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;38&quot; data-end=&quot;39&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;39&quot; data-end=&quot;41&quot;&gt;(a&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;41&quot; data-end=&quot;42&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;42&quot; data-end=&quot;43&quot;&gt;&amp;lt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;43&quot; data-end=&quot;44&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;44&quot; data-end=&quot;45&quot;&gt;b&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;45&quot; data-end=&quot;46&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;46&quot; data-end=&quot;47&quot;&gt;&amp;amp;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;47&quot; data-end=&quot;48&quot;&gt;&amp;amp;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;48&quot; data-end=&quot;49&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;49&quot; data-end=&quot;50&quot;&gt;a&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;50&quot; data-end=&quot;51&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;51&quot; data-end=&quot;52&quot;&gt;&amp;lt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;52&quot; data-end=&quot;53&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;53&quot; data-end=&quot;55&quot;&gt;0)&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;55&quot; data-end=&quot;56&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;56&quot; data-end=&quot;60&quot;&gt;then&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;60&quot; data-end=&quot;61&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;61&quot; data-end=&quot;62&quot;&gt;{&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;62&quot; data-end=&quot;63&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;67&quot; data-end=&quot;73&quot;&gt;return&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;73&quot; data-end=&quot;74&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;74&quot; data-end=&quot;76&quot;&gt;1;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;78&quot; data-end=&quot;88&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;80&quot; data-end=&quot;81&quot;&gt;}&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;81&quot; data-end=&quot;82&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;82&quot; data-end=&quot;86&quot;&gt;else&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;86&quot; data-end=&quot;87&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;87&quot; data-end=&quot;88&quot;&gt;{&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;90&quot; data-end=&quot;103&quot;&gt;&lt;pre data-kind=&quot;code_block&quot; data-start=&quot;90&quot; data-end=&quot;103&quot;&gt;&lt;code data-language=&quot;&quot;&gt;&lt;span class=&quot;code_line&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;94&quot; data-end=&quot;103&quot;&gt;return 0;&lt;/span&gt;&lt;/span&gt;
&lt;/code&gt;&lt;/pre&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;104&quot; data-end=&quot;118&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;106&quot; data-end=&quot;107&quot;&gt;}&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;107&quot; data-end=&quot;108&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;108&quot; data-end=&quot;109&quot;&gt;}&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;109&quot; data-end=&quot;110&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;110&quot; data-end=&quot;113&quot;&gt;]]&amp;gt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;113&quot; data-end=&quot;114&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;114&quot; data-end=&quot;118&quot;&gt;okay&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-153"></a>

### 예제 153 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 첫 번째 원본 `div`는 허용하지 않아 태그 문자열로 표시한다. 네 칸 들여쓴 두 번째 `div`는 코드 블록으로 처리하므로 GFM의 첫 HTML 요소와 차이가 생긴다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 153 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/153-gfm.jpg) | ![Sohjae 예제 153 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/153-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
  <div>

    <div>
```

GFM 기준 HTML

<pre><code>  &lt;div&gt;
&lt;pre&gt;&lt;code&gt;&amp;lt;div&amp;gt;
&lt;/code&gt;&lt;/pre&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;7&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;7&quot;&gt;  &amp;lt;div&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;9&quot; data-end=&quot;18&quot;&gt;&lt;pre data-kind=&quot;code_block&quot; data-start=&quot;9&quot; data-end=&quot;18&quot;&gt;&lt;code data-language=&quot;&quot;&gt;&lt;span class=&quot;code_line&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;13&quot; data-end=&quot;18&quot;&gt;&amp;lt;div&amp;gt;&lt;/span&gt;&lt;/span&gt;
&lt;/code&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-154"></a>

### 예제 154 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 일반 문단 뒤 `div` 블록을 HTML 요소로 삽입하지 않고 태그를 포함한 텍스트로 표시한다. 앞의 `Foo` 문단은 유지된다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 154 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/154-gfm.jpg) | ![Sohjae 예제 154 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/154-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
Foo
<div>
bar
</div>
```

GFM 기준 HTML

<pre><code>&lt;p&gt;Foo&lt;/p&gt;
&lt;div&gt;
bar
&lt;/div&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;3&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;3&quot;&gt;Foo&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;4&quot; data-end=&quot;20&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;4&quot; data-end=&quot;20&quot;&gt;&amp;lt;div&amp;gt;
bar
&amp;lt;/div&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-155"></a>

### 예제 155 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 닫힌 `div` 구간은 원문 텍스트 블록으로 끝낸 뒤 다음 `*foo*`를 강조로 파싱한다. GFM은 빈 줄이 없어 뒤 줄까지 HTML 블록에 유지하므로 별도의 강조를 만들지 않는다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 155 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/155-gfm.jpg) | ![Sohjae 예제 155 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/155-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<div>
bar
</div>
*foo*
```

GFM 기준 HTML

<pre><code>&lt;div&gt;
bar
&lt;/div&gt;
*foo*</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;16&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;16&quot;&gt;&amp;lt;div&amp;gt;
bar
&amp;lt;/div&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;17&quot; data-end=&quot;22&quot;&gt;&lt;p&gt;&lt;em data-kind=&quot;italic&quot; data-start=&quot;17&quot; data-end=&quot;22&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;18&quot; data-end=&quot;21&quot;&gt;foo&lt;/span&gt;&lt;/em&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-156"></a>

### 예제 156 · HTML blocks

**불일치 원인 — 원본 a 속성 허용 목록:** 원본 HTML의 `a`는 `name` 속성만 허용하므로 `href="bar"`를 제거한다. GFM은 해당 속성을 유지하지만 Sohjae는 목적지 없는 `a`를 출력한다. Markdown 문법으로 작성한 링크의 `href` 지원과는 별개의 정책이다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 156 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/156-gfm.jpg) | ![Sohjae 예제 156 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/156-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
Foo
<a href="bar">
baz
```

GFM 기준 HTML

<pre><code>&lt;p&gt;Foo
&lt;a href=&quot;bar&quot;&gt;
baz&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;22&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;3&quot;&gt;Foo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;3&quot; data-end=&quot;4&quot;&gt;
&lt;/span&gt;&lt;a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;18&quot; data-end=&quot;19&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;19&quot; data-end=&quot;22&quot;&gt;baz&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-157"></a>

### 예제 157 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 빈 줄이 있어도 원본 `div` 전체를 텍스트 보존 블록으로 처리한다. GFM의 HTML 컨테이너 안에 생성되는 강조 문단 대신 `*Emphasized*` 구문 자체가 표시된다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 157 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/157-gfm.jpg) | ![Sohjae 예제 157 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/157-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<div>

*Emphasized* text.

</div>
```

GFM 기준 HTML

<pre><code>&lt;div&gt;
&lt;p&gt;&lt;em&gt;Emphasized&lt;/em&gt; text.&lt;/p&gt;
&lt;/div&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;33&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;33&quot;&gt;&amp;lt;div&amp;gt;

*Emphasized* text.

&amp;lt;/div&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-158"></a>

### 예제 158 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 원본 `div` 요소를 생성하지 않고 태그와 내부 텍스트를 그대로 표시한다. GFM도 이 입력의 내부 별표를 리터럴로 남기지만, HTML 컨테이너와 텍스트 보존 블록이라는 구조 차이가 있다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 158 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/158-gfm.jpg) | ![Sohjae 예제 158 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/158-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<div>
*Emphasized* text.
</div>
```

GFM 기준 HTML

<pre><code>&lt;div&gt;
*Emphasized* text.
&lt;/div&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;31&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;31&quot;&gt;&amp;lt;div&amp;gt;
*Emphasized* text.
&amp;lt;/div&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-159"></a>

### 예제 159 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 빈 줄을 포함한 HTML 표 전체를 텍스트로 보존한다. GFM이 생성하는 `table`·`tr`·`td` 요소를 Sohjae는 생성하지 않는다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 159 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/159-gfm.jpg) | ![Sohjae 예제 159 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/159-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<table>

<tr>

<td>
Hi
</td>

</tr>

</table>
```

GFM 기준 HTML

<pre><code>&lt;table&gt;
&lt;tr&gt;
&lt;td&gt;
Hi
&lt;/td&gt;
&lt;/tr&gt;
&lt;/table&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;45&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;45&quot;&gt;&amp;lt;table&amp;gt;

&amp;lt;tr&amp;gt;

&amp;lt;td&amp;gt;
Hi
&amp;lt;/td&amp;gt;

&amp;lt;/tr&amp;gt;

&amp;lt;/table&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-160"></a>

### 예제 160 · HTML blocks

**불일치 원인 — 기타 원본 HTML 제한:** 원본 HTML 표 전체를 보존 블록으로 처리한다. GFM에서는 들여쓴 `td` 부분이 코드 블록으로 나뉘지만 Sohjae에서는 그 내부를 다시 Markdown으로 파싱하지 않아 구조도 달라진다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 160 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/160-gfm.jpg) | ![Sohjae 예제 160 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/160-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<table>

  <tr>

    <td>
      Hi
    </td>

  </tr>

</table>
```

GFM 기준 HTML

<pre><code>&lt;table&gt;
  &lt;tr&gt;
&lt;pre&gt;&lt;code&gt;&amp;lt;td&amp;gt;
  Hi
&amp;lt;/td&amp;gt;
&lt;/code&gt;&lt;/pre&gt;
  &lt;/tr&gt;
&lt;/table&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;63&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;63&quot;&gt;&amp;lt;table&amp;gt;

  &amp;lt;tr&amp;gt;

    &amp;lt;td&amp;gt;
      Hi
    &amp;lt;/td&amp;gt;

  &amp;lt;/tr&amp;gt;

&amp;lt;/table&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-170"></a>

### 예제 170 · Link reference definitions

**불일치 원인 — 기타 원본 HTML 제한:** 유효한 참조 정의가 아닌 이 입력에서 GFM은 `<bar>`를 원본 HTML 태그로 유지한다. Sohjae는 허용되지 않은 `bar` 태그를 텍스트로 표시한다. 링크 정의를 지원하지 않아서 생긴 차이는 아니다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 170 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/170-gfm.jpg) | ![Sohjae 예제 170 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/170-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
[foo]: <bar>(baz)

[foo]
```

GFM 기준 HTML

<pre><code>&lt;p&gt;[foo]: &lt;bar&gt;(baz)&lt;/p&gt;
&lt;p&gt;[foo]&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;17&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;5&quot;&gt;[foo]&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;5&quot; data-end=&quot;6&quot;&gt;:&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;6&quot; data-end=&quot;7&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;7&quot; data-end=&quot;12&quot;&gt;&amp;lt;bar&amp;gt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;12&quot; data-end=&quot;17&quot;&gt;(baz)&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;19&quot; data-end=&quot;24&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;19&quot; data-end=&quot;24&quot;&gt;[foo]&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-171"></a>

### 예제 171 · Link reference definitions

**불일치 원인 — URL 허용 목록:** 참조 목적지에 남는 역슬래시를 URL 정책이 거부한다. GFM은 역슬래시를 `%5C`로 인코딩해 링크를 만들지만 Sohjae는 해당 참조를 링크로 사용하지 않아 `[foo]`가 텍스트로 남는다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 171 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/171-gfm.jpg) | ![Sohjae 예제 171 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/171-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
[foo]: /url\bar\*baz "foo\"bar\baz"

[foo]
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;/url%5Cbar*baz&quot; title=&quot;foo&amp;quot;bar\baz&quot;&gt;foo&lt;/a&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;37&quot; data-end=&quot;42&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;37&quot; data-end=&quot;42&quot;&gt;[foo]&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-316"></a>

### 예제 316 · Backslash escapes

**불일치 원인 — URL 허용 목록:** 자동 링크 목적지에 포함된 역슬래시를 허용하지 않는다. GFM은 `%5C`로 인코딩해 링크를 생성하지만 Sohjae는 링크를 생성하지 않고 일반 인라인 텍스트로 처리한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 316 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/316-gfm.jpg) | ![Sohjae 예제 316 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/316-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<http://example.com?find=\*>
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;http://example.com?find=%5C*&quot;&gt;http://example.com?find=\*&lt;/a&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;28&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;1&quot;&gt;&amp;lt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;1&quot; data-end=&quot;5&quot;&gt;http&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;5&quot; data-end=&quot;24&quot;&gt;://example.com?find&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;24&quot; data-end=&quot;25&quot;&gt;=&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;25&quot; data-end=&quot;27&quot;&gt;*&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;27&quot; data-end=&quot;28&quot;&gt;&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-317"></a>

### 예제 317 · Backslash escapes

**불일치 원인 — URL 허용 목록:** 원본 `a`의 `href`를 제거하는 속성 허용 목록이 직접 적용된다. 또한 목적지의 역슬래시는 URL 정책에서도 허용하지 않는 값이다. GFM이 유지하는 href가 Sohjae 출력에는 없다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 317 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/317-gfm.jpg) | ![Sohjae 예제 317 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/317-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<a href="/bar\/)">
```

GFM 기준 HTML

<pre><code>&lt;a href=&quot;/bar\/)&quot;&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;18&quot;&gt;&lt;a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;18&quot; data-end=&quot;19&quot;&gt;
&lt;/span&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-327"></a>

### 예제 327 · Entity and numeric character references

**불일치 원인 — 원본 a 속성 허용 목록:** 원본 HTML의 `a`는 `name` 속성만 허용하므로 엔티티를 포함한 `href="&ouml;&ouml;.html"`를 제거한다. GFM은 해당 속성을 유지하지만 Sohjae는 목적지 없는 `a`를 출력한다. Markdown 문법으로 작성한 링크의 `href` 지원과는 별개의 정책이다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 327 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/327-gfm.jpg) | ![Sohjae 예제 327 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/327-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<a href="&ouml;&ouml;.html">
```

GFM 기준 HTML

<pre><code>&lt;a href=&quot;&amp;ouml;&amp;ouml;.html&quot;&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;28&quot;&gt;&lt;a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;28&quot; data-end=&quot;29&quot;&gt;
&lt;/span&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-354"></a>

### 예제 354 · Code spans

**불일치 원인 — 원본 a 속성 허용 목록:** 원본 HTML의 `a`는 `name` 속성만 허용하므로 백틱을 값으로 갖는 `href`를 제거한다. GFM은 해당 속성을 유지하지만 Sohjae는 목적지 없는 `a`를 출력한다. Markdown 문법으로 작성한 링크의 `href` 지원과는 별개의 정책이다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 354 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/354-gfm.jpg) | ![Sohjae 예제 354 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/354-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<a href="`">`
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;`&quot;&gt;`&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;13&quot;&gt;&lt;p&gt;&lt;a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;12&quot; data-end=&quot;13&quot;&gt;`&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-485"></a>

### 예제 485 · Emphasis and strong emphasis

**불일치 원인 — 원본 a 속성 허용 목록:** 원본 HTML의 `a`는 `name` 속성만 허용하므로 별표 두 개를 값으로 갖는 `href`를 제거한다. GFM은 해당 속성을 유지하지만 Sohjae는 목적지 없는 `a`를 출력한다. Markdown 문법으로 작성한 링크의 `href` 지원과는 별개의 정책이다. 앞의 강조 구분자가 리터럴로 남는 점이 아니라 href 제거가 이 예제의 차이다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 485 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/485-gfm.jpg) | ![Sohjae 예제 485 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/485-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
**<a href="**">
```

GFM 기준 HTML

<pre><code>&lt;p&gt;**&lt;a href=&quot;**&quot;&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;15&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;1&quot;&gt;*&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;1&quot; data-end=&quot;2&quot;&gt;*&lt;/span&gt;&lt;a&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-486"></a>

### 예제 486 · Emphasis and strong emphasis

**불일치 원인 — 원본 a 속성 허용 목록:** 원본 HTML의 `a`는 `name` 속성만 허용하므로 밑줄 두 개를 값으로 갖는 `href`를 제거한다. GFM은 해당 속성을 유지하지만 Sohjae는 목적지 없는 `a`를 출력한다. Markdown 문법으로 작성한 링크의 `href` 지원과는 별개의 정책이다. 앞의 강조 구분자가 리터럴로 남는 점이 아니라 href 제거가 이 예제의 차이다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 486 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/486-gfm.jpg) | ![Sohjae 예제 486 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/486-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
__<a href="__">
```

GFM 기준 HTML

<pre><code>&lt;p&gt;__&lt;a href=&quot;__&quot;&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;15&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;1&quot;&gt;_&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;1&quot; data-end=&quot;2&quot;&gt;_&lt;/span&gt;&lt;a&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-500"></a>

### 예제 500 · Links

**불일치 원인 — 기타 원본 HTML 제한:** 완성된 Markdown 링크가 아닌 구간에서 GFM은 여러 줄에 걸친 `<foo …>`를 원본 HTML로 유지한다. Sohjae는 이 태그를 허용하지 않아 문자열로 표시한다. 링크 구문 자체의 지원 여부가 아니라 남은 원본 HTML의 처리 차이다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 500 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/500-gfm.jpg) | ![Sohjae 예제 500 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/500-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
[link](<foo
bar>)
```

GFM 기준 HTML

<pre><code>&lt;p&gt;[link](&lt;foo
bar&gt;)&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;17&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;7&quot;&gt;[link](&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;7&quot; data-end=&quot;11&quot;&gt;&amp;lt;foo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;11&quot; data-end=&quot;12&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;12&quot; data-end=&quot;17&quot;&gt;bar&amp;gt;)&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-503"></a>

### 예제 503 · Links

**불일치 원인 — 기타 원본 HTML 제한:** 완성된 Markdown 링크가 아닌 구간에서 GFM은 유효한 태그로 읽힐 수 있는 `<b>`를 원본 HTML로 유지한다. Sohjae는 이 태그를 허용하지 않아 문자열로 표시한다. 링크 구문 자체의 지원 여부가 아니라 남은 원본 HTML의 처리 차이다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 503 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/503-gfm.jpg) | ![Sohjae 예제 503 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/503-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
[a](<b)c
[a](<b)c>
[a](<b>c)
```

GFM 기준 HTML

<pre><code>&lt;p&gt;[a](&amp;lt;b)c
[a](&amp;lt;b)c&amp;gt;
[a](&lt;b&gt;c)&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;28&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;4&quot;&gt;[a](&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;4&quot; data-end=&quot;8&quot;&gt;&amp;lt;b)c&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;8&quot; data-end=&quot;9&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;9&quot; data-end=&quot;13&quot;&gt;[a](&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;13&quot; data-end=&quot;18&quot;&gt;&amp;lt;b)c&amp;gt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;18&quot; data-end=&quot;19&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;19&quot; data-end=&quot;23&quot;&gt;[a](&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;23&quot; data-end=&quot;26&quot;&gt;&amp;lt;b&amp;gt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;26&quot; data-end=&quot;28&quot;&gt;c)&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-508"></a>

### 예제 508 · Links

**불일치 원인 — URL 허용 목록:** 이스케이프를 해제한 목적지 `foo):`의 첫 경로 부분에 콜론이 있고 허용된 scheme도 아니다. GFM은 이 상대 목적지를 링크로 허용하지만 Sohjae의 URL 정책은 거부한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 508 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/508-gfm.jpg) | ![Sohjae 예제 508 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/508-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
[link](foo\)\:)
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;foo):&quot;&gt;link&lt;/a&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;15&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;10&quot;&gt;[link](foo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;10&quot; data-end=&quot;12&quot;&gt;)&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;12&quot; data-end=&quot;14&quot;&gt;:&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;14&quot; data-end=&quot;15&quot;&gt;)&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-510"></a>

### 예제 510 · Links

**불일치 원인 — URL 허용 목록:** 목적지의 역슬래시를 허용하지 않는다. GFM은 이를 `%5C`로 인코딩한 링크를 출력하지만 Sohjae는 Markdown 링크를 활성화하지 않고 원문을 텍스트로 표시한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 510 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/510-gfm.jpg) | ![Sohjae 예제 510 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/510-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
[link](foo\bar)
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;foo%5Cbar&quot;&gt;link&lt;/a&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;15&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;10&quot;&gt;[link](foo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;10&quot; data-end=&quot;15&quot;&gt;\bar)&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-532"></a>

### 예제 532 · Links

**불일치 원인 — 기타 원본 HTML 제한:** 완성된 Markdown 링크가 아닌 구간에서 GFM은 속성 값에 링크처럼 보이는 문자열이 있는 `bar`를 원본 HTML로 유지한다. Sohjae는 이 태그를 허용하지 않아 문자열로 표시한다. 링크 구문 자체의 지원 여부가 아니라 남은 원본 HTML의 처리 차이다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 532 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/532-gfm.jpg) | ![Sohjae 예제 532 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/532-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
[foo <bar attr="](baz)">
```

GFM 기준 HTML

<pre><code>&lt;p&gt;[foo &lt;bar attr=&quot;](baz)&quot;&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;24&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;4&quot;&gt;[foo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;4&quot; data-end=&quot;5&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;5&quot; data-end=&quot;24&quot;&gt;&amp;lt;bar attr=&amp;quot;](baz)&amp;quot;&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-544"></a>

### 예제 544 · Links

**불일치 원인 — 기타 원본 HTML 제한:** 완성된 Markdown 링크가 아닌 구간에서 GFM은 속성 값에 참조 링크처럼 보이는 문자열이 있는 `bar`를 원본 HTML로 유지한다. Sohjae는 이 태그를 허용하지 않아 문자열로 표시한다. 링크 구문 자체의 지원 여부가 아니라 남은 원본 HTML의 처리 차이다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 544 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/544-gfm.jpg) | ![Sohjae 예제 544 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/544-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
[foo <bar attr="][ref]">

[ref]: /uri
```

GFM 기준 HTML

<pre><code>&lt;p&gt;[foo &lt;bar attr=&quot;][ref]&quot;&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;24&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;4&quot;&gt;[foo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;4&quot; data-end=&quot;5&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;5&quot; data-end=&quot;24&quot;&gt;&amp;lt;bar attr=&amp;quot;][ref]&amp;quot;&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-604"></a>

### 예제 604 · Autolinks

**불일치 원인 — URL 허용 목록:** GFM은 `irc:` scheme을 자동 링크로 허용한다. Sohjae의 일반 링크 scheme 허용 목록에는 `http:`·`https:`·`mailto:`만 있어 이 링크를 활성화하지 않는다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 604 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/604-gfm.jpg) | ![Sohjae 예제 604 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/604-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<irc://foo.bar:2233/baz>
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;irc://foo.bar:2233/baz&quot;&gt;irc://foo.bar:2233/baz&lt;/a&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;24&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;4&quot;&gt;&amp;lt;irc&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;4&quot; data-end=&quot;14&quot;&gt;://foo.bar&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;14&quot; data-end=&quot;24&quot;&gt;:2233/baz&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-606"></a>

### 예제 606 · Autolinks

**불일치 원인 — URL 허용 목록:** 문법상 가능한 사용자 정의 scheme `a+b+c:`를 GFM은 자동 링크로 허용한다. Sohjae의 scheme 허용 목록에는 없어 텍스트로 표시한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 606 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/606-gfm.jpg) | ![Sohjae 예제 606 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/606-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<a+b+c:d>
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;a+b+c:d&quot;&gt;a+b+c:d&lt;/a&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;9&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;6&quot;&gt;&amp;lt;a+b+c&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;6&quot; data-end=&quot;9&quot;&gt;:d&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-607"></a>

### 예제 607 · Autolinks

**불일치 원인 — URL 허용 목록:** 사용자 정의 `made-up-scheme:`을 GFM은 자동 링크로 허용하지만 Sohjae의 URL 허용 목록은 거부하므로 링크가 생성되지 않는다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 607 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/607-gfm.jpg) | ![Sohjae 예제 607 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/607-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<made-up-scheme://foo,bar>
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;made-up-scheme://foo,bar&quot;&gt;made-up-scheme://foo,bar&lt;/a&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;26&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;15&quot;&gt;&amp;lt;made-up-scheme&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;15&quot; data-end=&quot;26&quot;&gt;://foo,bar&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-609"></a>

### 예제 609 · Autolinks

**불일치 원인 — URL 허용 목록:** GFM은 `<localhost:5001/foo>`를 scheme이 있는 자동 링크로 해석한다. Sohjae는 첫 경로의 `localhost:`를 허용된 scheme으로 인정하지 않아 텍스트로 표시한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 609 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/609-gfm.jpg) | ![Sohjae 예제 609 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/609-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<localhost:5001/foo>
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;localhost:5001/foo&quot;&gt;localhost:5001/foo&lt;/a&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;20&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;10&quot;&gt;&amp;lt;localhost&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;10&quot; data-end=&quot;20&quot;&gt;:5001/foo&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-610"></a>

### 예제 610 · Autolinks

**불일치 원인 — 확장 자동 링크 활성화:** 공백 때문에 GFM의 꺾쇠 자동 링크 문법에는 맞지 않아 기준 결과는 전체가 텍스트다. Sohjae는 별도로 켜진 일반 URL 자동 링크 확장으로 내부 `http://foo.bar/baz`만 링크로 만든다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 610 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/610-gfm.jpg) | ![Sohjae 예제 610 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/610-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<http://foo.bar/baz bim>
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&amp;lt;http://foo.bar/baz bim&amp;gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;24&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;1&quot;&gt;&amp;lt;&lt;/span&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;1&quot; data-end=&quot;19&quot; href=&quot;http://foo.bar/baz&quot; rel=&quot;noopener noreferrer&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;1&quot; data-end=&quot;19&quot;&gt;http://foo.bar/baz&lt;/span&gt;&lt;/a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;19&quot; data-end=&quot;20&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;20&quot; data-end=&quot;24&quot;&gt;bim&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-611"></a>

### 예제 611 · Autolinks

**불일치 원인 — URL 허용 목록:** 자동 링크 목적지에 역슬래시가 포함되어 URL 정책에 의해 거부된다. GFM은 이를 퍼센트 인코딩해 링크를 만들지만 Sohjae는 일반 인라인 텍스트로 처리한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 611 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/611-gfm.jpg) | ![Sohjae 예제 611 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/611-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<http://example.com/\[\>
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;http://example.com/%5C%5B%5C&quot;&gt;http://example.com/\[\&lt;/a&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;24&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;1&quot;&gt;&amp;lt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;1&quot; data-end=&quot;5&quot;&gt;http&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;5&quot; data-end=&quot;20&quot;&gt;://example.com/&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;20&quot; data-end=&quot;22&quot;&gt;[&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;22&quot; data-end=&quot;24&quot;&gt;&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-616"></a>

### 예제 616 · Autolinks

**불일치 원인 — 확장 자동 링크 활성화:** 꺾쇠 안의 앞뒤 공백 때문에 GFM 기준은 링크를 만들지 않는다. Sohjae에서는 일반 URL 자동 링크 확장이 내부 `http://foo.bar`를 인식하므로 꺾쇠·공백 사이에 링크가 생긴다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 616 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/616-gfm.jpg) | ![Sohjae 예제 616 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/616-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
< http://foo.bar >
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&amp;lt; http://foo.bar &amp;gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;18&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;1&quot;&gt;&amp;lt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;1&quot; data-end=&quot;2&quot;&gt; &lt;/span&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;2&quot; data-end=&quot;16&quot; href=&quot;http://foo.bar&quot; rel=&quot;noopener noreferrer&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;2&quot; data-end=&quot;16&quot;&gt;http://foo.bar&lt;/span&gt;&lt;/a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;16&quot; data-end=&quot;17&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;17&quot; data-end=&quot;18&quot;&gt;&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-619"></a>

### 예제 619 · Autolinks

**불일치 원인 — 확장 자동 링크 활성화:** 이 기본 자동 링크 예제의 GFM 기준 결과는 꺾쇠 없는 URL을 텍스트로 남긴다. Sohjae는 일반 URL 자동 링크 확장을 항상 적용하여 같은 문자열에 링크를 생성한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 619 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/619-gfm.jpg) | ![Sohjae 예제 619 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/619-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
http://example.com
```

GFM 기준 HTML

<pre><code>&lt;p&gt;http://example.com&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;18&quot;&gt;&lt;p&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;0&quot; data-end=&quot;18&quot; href=&quot;http://example.com&quot; rel=&quot;noopener noreferrer&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;18&quot;&gt;http://example.com&lt;/span&gt;&lt;/a&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-620"></a>

### 예제 620 · Autolinks

**불일치 원인 — 확장 자동 링크 활성화:** 이 기본 자동 링크 예제의 GFM 기준 결과는 이메일을 텍스트로 남긴다. Sohjae는 확장 이메일 자동 링크가 켜져 있어 `mailto:foo@bar.example.com` 링크를 생성한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 620 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/620-gfm.jpg) | ![Sohjae 예제 620 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/620-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
foo@bar.example.com
```

GFM 기준 HTML

<pre><code>&lt;p&gt;foo@bar.example.com&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;19&quot;&gt;&lt;p&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;0&quot; data-end=&quot;19&quot; href=&quot;mailto:foo@bar.example.com&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;19&quot;&gt;foo@bar.example.com&lt;/span&gt;&lt;/a&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-621"></a>

### 예제 621 · Autolinks (extension)

**불일치 원인 — www 링크 HTTPS 기본값:** `www.` 자동 링크의 기본 scheme을 HTTPS로 지정하는 정책이다. 이 예제의 단독 `www.commonmark.org`에서 GFM의 `http://` 대신 Sohjae는 `https://`를 사용한다. 텍스트와 링크 경계를 감싸는 `section`·`span`은 편집기 좌표용 보조 요소이며 불일치 판정에서는 제외된다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 621 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/621-gfm.jpg) | ![Sohjae 예제 621 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/621-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
www.commonmark.org
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;http://www.commonmark.org&quot;&gt;www.commonmark.org&lt;/a&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;18&quot;&gt;&lt;p&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;0&quot; data-end=&quot;18&quot; href=&quot;https://www.commonmark.org&quot; rel=&quot;noopener noreferrer&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;18&quot;&gt;www.commonmark.org&lt;/span&gt;&lt;/a&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-622"></a>

### 예제 622 · Autolinks (extension)

**불일치 원인 — www 링크 HTTPS 기본값:** `www.` 자동 링크의 기본 scheme을 HTTPS로 지정하는 정책이다. 이 예제의 문장 안의 `www.commonmark.org/help`에서 GFM의 `http://` 대신 Sohjae는 `https://`를 사용한다. 텍스트와 링크 경계를 감싸는 `section`·`span`은 편집기 좌표용 보조 요소이며 불일치 판정에서는 제외된다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 622 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/622-gfm.jpg) | ![Sohjae 예제 622 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/622-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
Visit www.commonmark.org/help for more information.
```

GFM 기준 HTML

<pre><code>&lt;p&gt;Visit &lt;a href=&quot;http://www.commonmark.org/help&quot;&gt;www.commonmark.org/help&lt;/a&gt; for more information.&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;51&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;5&quot;&gt;Visit&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;5&quot; data-end=&quot;6&quot;&gt; &lt;/span&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;6&quot; data-end=&quot;29&quot; href=&quot;https://www.commonmark.org/help&quot; rel=&quot;noopener noreferrer&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;6&quot; data-end=&quot;29&quot;&gt;www.commonmark.org/help&lt;/span&gt;&lt;/a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;29&quot; data-end=&quot;30&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;30&quot; data-end=&quot;33&quot;&gt;for&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;33&quot; data-end=&quot;34&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;34&quot; data-end=&quot;38&quot;&gt;more&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;38&quot; data-end=&quot;39&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;39&quot; data-end=&quot;51&quot;&gt;information.&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-623"></a>

### 예제 623 · Autolinks (extension)

**불일치 원인 — www 링크 HTTPS 기본값:** `www.` 자동 링크의 기본 scheme을 HTTPS로 지정하는 정책이다. 이 예제의 두 문단의 도메인·경로 링크에서 GFM의 `http://` 대신 Sohjae는 `https://`를 사용한다. 텍스트와 링크 경계를 감싸는 `section`·`span`은 편집기 좌표용 보조 요소이며 불일치 판정에서는 제외된다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 623 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/623-gfm.jpg) | ![Sohjae 예제 623 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/623-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
Visit www.commonmark.org.

Visit www.commonmark.org/a.b.
```

GFM 기준 HTML

<pre><code>&lt;p&gt;Visit &lt;a href=&quot;http://www.commonmark.org&quot;&gt;www.commonmark.org&lt;/a&gt;.&lt;/p&gt;
&lt;p&gt;Visit &lt;a href=&quot;http://www.commonmark.org/a.b&quot;&gt;www.commonmark.org/a.b&lt;/a&gt;.&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;25&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;5&quot;&gt;Visit&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;5&quot; data-end=&quot;6&quot;&gt; &lt;/span&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;6&quot; data-end=&quot;24&quot; href=&quot;https://www.commonmark.org&quot; rel=&quot;noopener noreferrer&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;6&quot; data-end=&quot;24&quot;&gt;www.commonmark.org&lt;/span&gt;&lt;/a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;24&quot; data-end=&quot;25&quot;&gt;.&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;27&quot; data-end=&quot;56&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;27&quot; data-end=&quot;32&quot;&gt;Visit&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;32&quot; data-end=&quot;33&quot;&gt; &lt;/span&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;33&quot; data-end=&quot;55&quot; href=&quot;https://www.commonmark.org/a.b&quot; rel=&quot;noopener noreferrer&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;33&quot; data-end=&quot;55&quot;&gt;www.commonmark.org/a.b&lt;/span&gt;&lt;/a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;55&quot; data-end=&quot;56&quot;&gt;.&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-624"></a>

### 예제 624 · Autolinks (extension)

**불일치 원인 — www 링크 HTTPS 기본값:** `www.` 자동 링크의 기본 scheme을 HTTPS로 지정하는 정책이다. 이 예제의 괄호가 섞인 검색 URL들에서 GFM의 `http://` 대신 Sohjae는 `https://`를 사용한다. 텍스트와 링크 경계를 감싸는 `section`·`span`은 편집기 좌표용 보조 요소이며 불일치 판정에서는 제외된다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 624 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/624-gfm.jpg) | ![Sohjae 예제 624 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/624-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
www.google.com/search?q=Markup+(business)

www.google.com/search?q=Markup+(business)))

(www.google.com/search?q=Markup+(business))

(www.google.com/search?q=Markup+(business)
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;http://www.google.com/search?q=Markup+(business)&quot;&gt;www.google.com/search?q=Markup+(business)&lt;/a&gt;&lt;/p&gt;
&lt;p&gt;&lt;a href=&quot;http://www.google.com/search?q=Markup+(business)&quot;&gt;www.google.com/search?q=Markup+(business)&lt;/a&gt;))&lt;/p&gt;
&lt;p&gt;(&lt;a href=&quot;http://www.google.com/search?q=Markup+(business)&quot;&gt;www.google.com/search?q=Markup+(business)&lt;/a&gt;)&lt;/p&gt;
&lt;p&gt;(&lt;a href=&quot;http://www.google.com/search?q=Markup+(business)&quot;&gt;www.google.com/search?q=Markup+(business)&lt;/a&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;41&quot;&gt;&lt;p&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;0&quot; data-end=&quot;41&quot; href=&quot;https://www.google.com/search?q=Markup+(business)&quot; rel=&quot;noopener noreferrer&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;41&quot;&gt;www.google.com/search?q=Markup+(business)&lt;/span&gt;&lt;/a&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;43&quot; data-end=&quot;86&quot;&gt;&lt;p&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;43&quot; data-end=&quot;84&quot; href=&quot;https://www.google.com/search?q=Markup+(business)&quot; rel=&quot;noopener noreferrer&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;43&quot; data-end=&quot;84&quot;&gt;www.google.com/search?q=Markup+(business)&lt;/span&gt;&lt;/a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;84&quot; data-end=&quot;86&quot;&gt;))&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;88&quot; data-end=&quot;131&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;88&quot; data-end=&quot;89&quot;&gt;(&lt;/span&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;89&quot; data-end=&quot;130&quot; href=&quot;https://www.google.com/search?q=Markup+(business)&quot; rel=&quot;noopener noreferrer&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;89&quot; data-end=&quot;130&quot;&gt;www.google.com/search?q=Markup+(business)&lt;/span&gt;&lt;/a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;130&quot; data-end=&quot;131&quot;&gt;)&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;133&quot; data-end=&quot;175&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;133&quot; data-end=&quot;134&quot;&gt;(&lt;/span&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;134&quot; data-end=&quot;175&quot; href=&quot;https://www.google.com/search?q=Markup+(business)&quot; rel=&quot;noopener noreferrer&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;134&quot; data-end=&quot;175&quot;&gt;www.google.com/search?q=Markup+(business)&lt;/span&gt;&lt;/a&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-625"></a>

### 예제 625 · Autolinks (extension)

**불일치 원인 — www 링크 HTTPS 기본값:** `www.` 자동 링크의 기본 scheme을 HTTPS로 지정하는 정책이다. 이 예제의 괄호와 `+ok`가 섞인 검색 URL에서 GFM의 `http://` 대신 Sohjae는 `https://`를 사용한다. 텍스트와 링크 경계를 감싸는 `section`·`span`은 편집기 좌표용 보조 요소이며 불일치 판정에서는 제외된다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 625 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/625-gfm.jpg) | ![Sohjae 예제 625 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/625-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
www.google.com/search?q=(business))+ok
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;http://www.google.com/search?q=(business))+ok&quot;&gt;www.google.com/search?q=(business))+ok&lt;/a&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;38&quot;&gt;&lt;p&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;0&quot; data-end=&quot;38&quot; href=&quot;https://www.google.com/search?q=(business))+ok&quot; rel=&quot;noopener noreferrer&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;38&quot;&gt;www.google.com/search?q=(business))+ok&lt;/span&gt;&lt;/a&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-626"></a>

### 예제 626 · Autolinks (extension)

**불일치 원인 — www 링크 HTTPS 기본값:** `www.` 자동 링크의 기본 scheme을 HTTPS로 지정하는 정책이다. 이 예제의 쿼리의 앰퍼샌드·엔티티 모양을 포함한 URL들에서 GFM의 `http://` 대신 Sohjae는 `https://`를 사용한다. 텍스트와 링크 경계를 감싸는 `section`·`span`은 편집기 좌표용 보조 요소이며 불일치 판정에서는 제외된다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 626 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/626-gfm.jpg) | ![Sohjae 예제 626 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/626-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
www.google.com/search?q=commonmark&hl=en

www.google.com/search?q=commonmark&hl;
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;http://www.google.com/search?q=commonmark&amp;amp;hl=en&quot;&gt;www.google.com/search?q=commonmark&amp;amp;hl=en&lt;/a&gt;&lt;/p&gt;
&lt;p&gt;&lt;a href=&quot;http://www.google.com/search?q=commonmark&quot;&gt;www.google.com/search?q=commonmark&lt;/a&gt;&amp;amp;hl;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;40&quot;&gt;&lt;p&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;0&quot; data-end=&quot;40&quot; href=&quot;https://www.google.com/search?q=commonmark&amp;amp;hl=en&quot; rel=&quot;noopener noreferrer&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;40&quot;&gt;www.google.com/search?q=commonmark&amp;amp;hl=en&lt;/span&gt;&lt;/a&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;42&quot; data-end=&quot;80&quot;&gt;&lt;p&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;42&quot; data-end=&quot;76&quot; href=&quot;https://www.google.com/search?q=commonmark&quot; rel=&quot;noopener noreferrer&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;42&quot; data-end=&quot;76&quot;&gt;www.google.com/search?q=commonmark&lt;/span&gt;&lt;/a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;76&quot; data-end=&quot;80&quot;&gt;&amp;amp;hl;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-627"></a>

### 예제 627 · Autolinks (extension)

**불일치 원인 — www 링크 HTTPS 기본값:** `www.` 자동 링크의 기본 scheme을 HTTPS로 지정하는 정책이다. 이 예제의 `<` 앞에서 끝나는 `www.commonmark.org/he` 링크에서 GFM의 `http://` 대신 Sohjae는 `https://`를 사용한다. 텍스트와 링크 경계를 감싸는 `section`·`span`은 편집기 좌표용 보조 요소이며 불일치 판정에서는 제외된다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 627 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/627-gfm.jpg) | ![Sohjae 예제 627 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/627-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
www.commonmark.org/he<lp
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;http://www.commonmark.org/he&quot;&gt;www.commonmark.org/he&lt;/a&gt;&amp;lt;lp&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;24&quot;&gt;&lt;p&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;0&quot; data-end=&quot;21&quot; href=&quot;https://www.commonmark.org/he&quot; rel=&quot;noopener noreferrer&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;21&quot;&gt;www.commonmark.org/he&lt;/span&gt;&lt;/a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;21&quot; data-end=&quot;24&quot;&gt;&amp;lt;lp&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-628"></a>

### 예제 628 · Autolinks (extension)

**불일치 원인 — URL 허용 목록:** HTTP·HTTPS 자동 링크는 유지하지만 FTP는 일반 링크 scheme 허용 목록에 없다. GFM이 링크로 만드는 `ftp://foo.bar.baz`를 Sohjae는 텍스트로 남긴다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 628 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/628-gfm.jpg) | ![Sohjae 예제 628 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/628-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
http://commonmark.org

(Visit https://encrypted.google.com/search?q=Markup+(business))

Anonymous FTP is available at ftp://foo.bar.baz.
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;http://commonmark.org&quot;&gt;http://commonmark.org&lt;/a&gt;&lt;/p&gt;
&lt;p&gt;(Visit &lt;a href=&quot;https://encrypted.google.com/search?q=Markup+(business)&quot;&gt;https://encrypted.google.com/search?q=Markup+(business)&lt;/a&gt;)&lt;/p&gt;
&lt;p&gt;Anonymous FTP is available at &lt;a href=&quot;ftp://foo.bar.baz&quot;&gt;ftp://foo.bar.baz&lt;/a&gt;.&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;21&quot;&gt;&lt;p&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;0&quot; data-end=&quot;21&quot; href=&quot;http://commonmark.org&quot; rel=&quot;noopener noreferrer&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;21&quot;&gt;http://commonmark.org&lt;/span&gt;&lt;/a&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;23&quot; data-end=&quot;86&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;23&quot; data-end=&quot;29&quot;&gt;(Visit&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;29&quot; data-end=&quot;30&quot;&gt; &lt;/span&gt;&lt;a data-kind=&quot;link&quot; data-start=&quot;30&quot; data-end=&quot;85&quot; href=&quot;https://encrypted.google.com/search?q=Markup+(business)&quot; rel=&quot;noopener noreferrer&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;30&quot; data-end=&quot;85&quot;&gt;https://encrypted.google.com/search?q=Markup+(business)&lt;/span&gt;&lt;/a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;85&quot; data-end=&quot;86&quot;&gt;)&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;88&quot; data-end=&quot;136&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;88&quot; data-end=&quot;97&quot;&gt;Anonymous&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;97&quot; data-end=&quot;98&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;98&quot; data-end=&quot;101&quot;&gt;FTP&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;101&quot; data-end=&quot;102&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;102&quot; data-end=&quot;104&quot;&gt;is&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;104&quot; data-end=&quot;105&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;105&quot; data-end=&quot;114&quot;&gt;available&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;114&quot; data-end=&quot;115&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;115&quot; data-end=&quot;117&quot;&gt;at&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;117&quot; data-end=&quot;118&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;118&quot; data-end=&quot;121&quot;&gt;ftp&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;121&quot; data-end=&quot;136&quot;&gt;://foo.bar.baz.&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-632"></a>

### 예제 632 · Raw HTML

**불일치 원인 — 기타 원본 HTML 제한:** `a`는 허용하지만 사용자 정의 `bab`·`c2c`는 허용하지 않는다. GFM의 중첩 HTML 태그 대신 Sohjae에서는 두 태그의 문자열이 표시된다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 632 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/632-gfm.jpg) | ![Sohjae 예제 632 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/632-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<a><bab><c2c>
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a&gt;&lt;bab&gt;&lt;c2c&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;13&quot;&gt;&lt;p&gt;&lt;a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;3&quot; data-end=&quot;8&quot;&gt;&amp;lt;bab&amp;gt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;8&quot; data-end=&quot;13&quot;&gt;&amp;lt;c2c&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-633"></a>

### 예제 633 · Raw HTML

**불일치 원인 — 기타 원본 HTML 제한:** `a`는 허용 목록에 있으나 `b2`는 없다. GFM이 원본 `<b2/>`를 유지하는 것과 달리 Sohjae는 이를 텍스트로 표시하며, 허용한 `a`의 시작 태그도 정규화한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 633 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/633-gfm.jpg) | ![Sohjae 예제 633 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/633-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<a/><b2/>
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a/&gt;&lt;b2/&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;9&quot;&gt;&lt;p&gt;&lt;a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;4&quot; data-end=&quot;9&quot;&gt;&amp;lt;b2/&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-634"></a>

### 예제 634 · Raw HTML

**불일치 원인 — 기타 원본 HTML 제한:** 여러 줄 속성을 포함한 `b2`는 사용자 정의 태그로 허용하지 않는다. GFM의 HTML 요소 대신 `<b2 …>` 원문을 표시하며 허용된 `a`와는 다르게 처리한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 634 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/634-gfm.jpg) | ![Sohjae 예제 634 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/634-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<a  /><b2
data="foo" >
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a  /&gt;&lt;b2
data=&quot;foo&quot; &gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;22&quot;&gt;&lt;p&gt;&lt;a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;6&quot; data-end=&quot;9&quot;&gt;&amp;lt;b2&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;9&quot; data-end=&quot;10&quot;&gt;
&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;10&quot; data-end=&quot;14&quot;&gt;data&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;14&quot; data-end=&quot;20&quot;&gt;=&amp;quot;foo&amp;quot;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;20&quot; data-end=&quot;21&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;21&quot; data-end=&quot;22&quot;&gt;&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-636"></a>

### 예제 636 · Raw HTML

**불일치 원인 — 기타 원본 HTML 제한:** 사용자 정의 `responsive-image`는 허용 목록 밖이다. GFM이 원본 요소를 유지하는 것과 달리 Sohjae는 `src` 속성을 포함한 태그 전체를 텍스트로 표시한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 636 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/636-gfm.jpg) | ![Sohjae 예제 636 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/636-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
Foo <responsive-image src="foo.jpg" />
```

GFM 기준 HTML

<pre><code>&lt;p&gt;Foo &lt;responsive-image src=&quot;foo.jpg&quot; /&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;38&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;3&quot;&gt;Foo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;3&quot; data-end=&quot;4&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;4&quot; data-end=&quot;21&quot;&gt;&amp;lt;responsive-image&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;21&quot; data-end=&quot;22&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;22&quot; data-end=&quot;25&quot;&gt;src&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;25&quot; data-end=&quot;35&quot;&gt;=&amp;quot;foo.jpg&amp;quot;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;35&quot; data-end=&quot;36&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;36&quot; data-end=&quot;38&quot;&gt;/&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-642"></a>

### 예제 642 · Raw HTML

**불일치 원인 — 기타 원본 HTML 제한:** 닫는 `a`는 허용하지만 닫는 사용자 정의 `foo`는 허용하지 않는다. GFM이 원본 닫는 태그로 유지하는 `</foo >`를 Sohjae는 텍스트로 표시한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 642 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/642-gfm.jpg) | ![Sohjae 예제 642 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/642-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
</a></foo >
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;/a&gt;&lt;/foo &gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;11&quot;&gt;&lt;p&gt;&lt;/a&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;4&quot; data-end=&quot;11&quot;&gt;&amp;lt;/foo &amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-645"></a>

### 예제 645 · Raw HTML

**불일치 원인 — 주석 제거:** 읽기 출력에서 HTML 주석을 제거한다. 이 예제의 짧은 종료 모양 `<!-->`·`<!--->` 주변에서는 주석 경계 처리도 달라진다. Sohjae는 뒤의 `foo -->`를 텍스트로 남기고 두 문단을 출력하며, 현재 비교기의 GFM 기준 트리는 한 문단으로 읽혀 문단 수가 다르다. 주석 노드의 존재만으로 판정된 차이는 아니다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 645 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/645-gfm.jpg) | ![Sohjae 예제 645 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/645-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
foo <!--> foo -->

foo <!---> foo -->
```

GFM 기준 HTML

<pre><code>&lt;p&gt;foo &lt;!--&gt; foo --&amp;gt;&lt;/p&gt;
&lt;p&gt;foo &lt;!---&gt; foo --&amp;gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;17&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;3&quot;&gt;foo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;3&quot; data-end=&quot;4&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;9&quot; data-end=&quot;10&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;10&quot; data-end=&quot;13&quot;&gt;foo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;13&quot; data-end=&quot;14&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;14&quot; data-end=&quot;17&quot;&gt;--&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;19&quot; data-end=&quot;37&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;19&quot; data-end=&quot;22&quot;&gt;foo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;22&quot; data-end=&quot;23&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;29&quot; data-end=&quot;30&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;30&quot; data-end=&quot;33&quot;&gt;foo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;33&quot; data-end=&quot;34&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;34&quot; data-end=&quot;37&quot;&gt;--&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-646"></a>

### 예제 646 · Raw HTML

**불일치 원인 — 기타 원본 HTML 제한:** PHP 처리 명령 `<?php echo $a; ?>`를 HTML 처리 명령으로 내보내지 않고 문단 텍스트로 표시한다. GFM이 유지하는 원본 HTML 구문과 노드 종류가 다르다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 646 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/646-gfm.jpg) | ![Sohjae 예제 646 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/646-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
foo <?php echo $a; ?>
```

GFM 기준 HTML

<pre><code>&lt;p&gt;foo &lt;?php echo $a; ?&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;21&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;3&quot;&gt;foo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;3&quot; data-end=&quot;4&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;4&quot; data-end=&quot;9&quot;&gt;&amp;lt;?php&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;9&quot; data-end=&quot;10&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;10&quot; data-end=&quot;14&quot;&gt;echo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;14&quot; data-end=&quot;15&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;15&quot; data-end=&quot;18&quot;&gt;$a;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;18&quot; data-end=&quot;19&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;19&quot; data-end=&quot;21&quot;&gt;?&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-647"></a>

### 예제 647 · Raw HTML

**불일치 원인 — 기타 원본 HTML 제한:** `<!ELEMENT br EMPTY>` 선언을 원본 HTML로 유지하지 않고 문단 텍스트로 표시한다. GFM 기준에 남는 선언 노드와 차이가 있다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 647 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/647-gfm.jpg) | ![Sohjae 예제 647 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/647-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
foo <!ELEMENT br EMPTY>
```

GFM 기준 HTML

<pre><code>&lt;p&gt;foo &lt;!ELEMENT br EMPTY&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;23&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;3&quot;&gt;foo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;3&quot; data-end=&quot;4&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;4&quot; data-end=&quot;5&quot;&gt;&amp;lt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;5&quot; data-end=&quot;13&quot;&gt;!ELEMENT&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;13&quot; data-end=&quot;14&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;14&quot; data-end=&quot;16&quot;&gt;br&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;16&quot; data-end=&quot;17&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;17&quot; data-end=&quot;23&quot;&gt;EMPTY&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-648"></a>

### 예제 648 · Raw HTML

**불일치 원인 — 기타 원본 HTML 제한:** CDATA 구문을 원본 HTML로 통과시키지 않고 괄호·기호를 포함한 텍스트로 표시한다. GFM의 원본 CDATA 출력과 HTML 구조가 다르다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 648 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/648-gfm.jpg) | ![Sohjae 예제 648 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/648-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
foo <![CDATA[>&<]]>
```

GFM 기준 HTML

<pre><code>&lt;p&gt;foo &lt;![CDATA[&gt;&amp;&lt;]]&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;19&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;3&quot;&gt;foo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;3&quot; data-end=&quot;4&quot;&gt; &lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;4&quot; data-end=&quot;5&quot;&gt;&amp;lt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;5&quot; data-end=&quot;6&quot;&gt;!&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;6&quot; data-end=&quot;12&quot;&gt;[CDATA&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;12&quot; data-end=&quot;14&quot;&gt;[&amp;gt;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;14&quot; data-end=&quot;15&quot;&gt;&amp;amp;&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;15&quot; data-end=&quot;19&quot;&gt;&amp;lt;]]&amp;gt;&lt;/span&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-649"></a>

### 예제 649 · Raw HTML

**불일치 원인 — 원본 a 속성 허용 목록:** 원본 HTML의 `a`는 `name` 속성만 허용하므로 엔티티를 포함한 `href="&ouml;"`를 제거한다. GFM은 해당 속성을 유지하지만 Sohjae는 목적지 없는 `a`를 출력한다. Markdown 문법으로 작성한 링크의 `href` 지원과는 별개의 정책이다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 649 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/649-gfm.jpg) | ![Sohjae 예제 649 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/649-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
foo <a href="&ouml;">
```

GFM 기준 HTML

<pre><code>&lt;p&gt;foo &lt;a href=&quot;&amp;ouml;&quot;&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;21&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;3&quot;&gt;foo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;3&quot; data-end=&quot;4&quot;&gt; &lt;/span&gt;&lt;a&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-650"></a>

### 예제 650 · Raw HTML

**불일치 원인 — 원본 a 속성 허용 목록:** 원본 HTML의 `a`는 `name` 속성만 허용하므로 역슬래시와 별표를 포함한 `href`를 제거한다. GFM은 해당 속성을 유지하지만 Sohjae는 목적지 없는 `a`를 출력한다. Markdown 문법으로 작성한 링크의 `href` 지원과는 별개의 정책이다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 650 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/650-gfm.jpg) | ![Sohjae 예제 650 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/650-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
foo <a href="\*">
```

GFM 기준 HTML

<pre><code>&lt;p&gt;foo &lt;a href=&quot;\*&quot;&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;17&quot;&gt;&lt;p&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;3&quot;&gt;foo&lt;/span&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;3&quot; data-end=&quot;4&quot;&gt; &lt;/span&gt;&lt;a&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-652"></a>

### 예제 652 · Disallowed Raw HTML (extension)

**불일치 원인 — 기타 원본 HTML 제한:** GFM의 제한 HTML 확장은 `title`·`style`·`xmp` 등 일부 태그를 이스케이프하지만 다른 HTML 태그는 유지한다. Sohjae는 더 좁은 HTML 허용 목록을 사용하여 이 예제의 `strong`·`em`·`blockquote`까지 포함한 구간을 원문 보존 블록으로 표시한다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 652 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/652-gfm.jpg) | ![Sohjae 예제 652 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/652-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<strong> <title> <style> <em>

<blockquote>
  <xmp> is disallowed.  <XMP> is also disallowed.
</blockquote>
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;strong&gt; &amp;lt;title&gt; &amp;lt;style&gt; &lt;em&gt;&lt;/p&gt;
&lt;blockquote&gt;
  &amp;lt;xmp&gt; is disallowed.  &amp;lt;XMP&gt; is also disallowed.
&lt;/blockquote&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;29&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;29&quot;&gt;&amp;lt;strong&amp;gt; &amp;lt;title&amp;gt; &amp;lt;style&amp;gt; &amp;lt;em&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;&lt;section data-block=&quot;1&quot; data-start=&quot;31&quot; data-end=&quot;107&quot;&gt;&lt;pre class=&quot;raw_block&quot;&gt;&lt;span data-text=&quot;1&quot; data-start=&quot;31&quot; data-end=&quot;107&quot;&gt;&amp;lt;blockquote&amp;gt;
  &amp;lt;xmp&amp;gt; is disallowed.  &amp;lt;XMP&amp;gt; is also disallowed.
&amp;lt;/blockquote&amp;gt;&lt;/span&gt;&lt;/pre&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-662"></a>

### 예제 662 · Hard line breaks

**불일치 원인 — 원본 a 속성 허용 목록:** 원본 HTML의 `a`는 `name` 속성만 허용하므로 두 공백과 줄바꿈을 포함한 `href`를 제거한다. GFM은 해당 속성을 유지하지만 Sohjae는 목적지 없는 `a`를 출력한다. Markdown 문법으로 작성한 링크의 `href` 지원과는 별개의 정책이다. 두 출력 모두 눈에 보이는 링크 텍스트가 없어 비교 이미지가 비어 보이지만 HTML 속성에는 차이가 있다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 662 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/662-gfm.jpg) | ![Sohjae 예제 662 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/662-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

<pre><code>&lt;a href=&quot;foo&#32;&#32;
bar&quot;&gt;</code></pre>

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;foo&#32;&#32;
bar&quot;&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;20&quot;&gt;&lt;p&gt;&lt;a&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)

<a id="example-663"></a>

### 예제 663 · Hard line breaks

**불일치 원인 — 원본 a 속성 허용 목록:** 원본 HTML의 `a`는 `name` 속성만 허용하므로 역슬래시와 줄바꿈을 포함한 `href`를 제거한다. GFM은 해당 속성을 유지하지만 Sohjae는 목적지 없는 `a`를 출력한다. Markdown 문법으로 작성한 링크의 `href` 지원과는 별개의 정책이다. 두 출력 모두 눈에 보이는 링크 텍스트가 없어 비교 이미지가 비어 보이지만 HTML 속성에는 차이가 있다.

| GFM 기준 렌더링 | Sohjae 렌더링 |
| --- | --- |
| ![GFM 예제 663 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/663-gfm.jpg) | ![Sohjae 예제 663 렌더링](https://raw.githubusercontent.com/wiki/mson0129/sohjae/assets/gfm-comparison/663-sohjae.jpg) |

<details>
<summary>Markdown 원문 및 HTML 출력</summary>

Markdown 원문

```markdown
<a href="foo\
bar">
```

GFM 기준 HTML

<pre><code>&lt;p&gt;&lt;a href=&quot;foo\
bar&quot;&gt;&lt;/p&gt;</code></pre>

Sohjae 출력 HTML

<pre><code>&lt;section data-block=&quot;1&quot; data-start=&quot;0&quot; data-end=&quot;19&quot;&gt;&lt;p&gt;&lt;a&gt;&lt;/p&gt;&lt;/section&gt;</code></pre>

</details>

[분류표로 돌아가기](#policy-summary)
