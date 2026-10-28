---
title: Sohjae Markdown 문법 예제
layout: default
tags:
  - demo
  - collaboration
---

# 함께 쓰는 문서

리치·하이브리드·마크다운·원본·HTML·읽기 화면을 전환하며 같은 문서를 확인해 보세요. 아래 예제는 Sohjae에서 현재 지원하는 기본 문법과 확장 문법을 포함합니다.

## 인라인 서식

**굵은 글자**, __다른 굵게__, *기울임*, _다른 기울임_, ***굵게와 기울임***을 쓸 수 있습니다.

~~취소선~~, ==하이라이트==, ==**굵은 하이라이트**==, H~2~O, x^2^를 확인하세요.

`인라인 코드`, ``백틱 ` 기호가 포함된 코드``, `**서식으로 변환하지 않는 코드**`도 지원합니다.

\*기울임 아님\*, \[링크 아님\], \# 제목 아님처럼 문법 기호를 이스케이프할 수 있습니다.

## 제목과 사용자 지정 앵커 {#heading-demo}

### 제목 3

#### 제목 4

##### 제목 5

###### 제목 6

밑줄형 제목 1
=============

밑줄형 제목 2
-------------

일반 문단입니다. [사용자 지정 제목](#heading-demo)으로 이동할 수 있습니다.

## 문단과 줄 바꿈

한 번의 원문 개행은
같은 문단 안의 연속된 문장입니다.

이 문장은 별도 문단입니다.

역슬래시로 줄을 바꿉니다.\
같은 문단의 다음 줄입니다.

HTML로도 줄을 바꿀 수 있습니다.<br>같은 문단의 다음 줄입니다.

명시적인 빈 문단:

&nbsp;

문자 참조: A&nbsp;B, A&ensp;B, A&emsp;B, &amp;, &lt;태그&gt;, &#169;, &#x1F600;.

---

## 순서 없는 목록

- 첫 번째 항목
- 두 번째 항목
    - 중첩 항목
    - **서식이 있는 중첩 항목**
        - 세 번째 단계
- 마지막 항목

+ 더하기 기호 목록
+ 두 번째 항목

* 별표 기호 목록
* 두 번째 항목

## 순서 목록

1. 첫 번째 항목
2. 두 번째 항목
    1. 중첩 순서 항목
    2. 다음 중첩 항목
3. 마지막 항목

3) 괄호 기호로 시작한 목록
4) 다음 항목

## 작업 목록과 여러 문단 목록

- [x] WASM으로 렌더링
- [ ] 확인할 작업
    - [ ] 중첩된 작업
- [ ] 완료되지 않은 마지막 작업

- 첫 번째 문단이 있는 항목입니다.

    같은 목록 항목 안의 두 번째 문단입니다.

- 다음 항목입니다.

## 인용문

> 기본 인용문입니다.
>
> **강조**, *기울임*, [링크](https://example.com/)도 사용할 수 있습니다.
>
> > 중첩된 인용문입니다.

## 알림 블록

> [!NOTE]
> 참고할 내용을 표시합니다.

> [!TIP]
> 유용한 팁을 표시합니다.

> [!IMPORTANT]
> 중요한 내용을 표시합니다.

> [!WARNING]
> 주의할 내용을 표시합니다.

> [!CAUTION]
> 위험하거나 신중히 확인할 내용을 표시합니다.

## 표

| 항목 | 상태 | 숫자 |
| :--- | :---: | ---: |
| 공동 편집 | **준비** | 1 |
| 원본 편집 | ==동기화== | 2 |
| 표 순서 이동 | 사용 가능 | 3 |
| 셀 안의 줄 바꿈 | 첫 줄<br>둘째 줄 | 4 |
| 파이프와 인라인 코드 | `a\|b` | 5 |

## 코드 블록

```javascript
const editor = new Sohjae({
    selector: '#editor',
    mode: 'hybrid'
});
```

~~~rust
fn main() {
    println!("한글과 😀도 코드로 유지됩니다.");
}
~~~

들여쓰기 코드:

    # 이것은 제목이 아닙니다.
    **이것은 굵게가 아닙니다.**
    let value = 42;

## 링크와 자동 링크

[일반 링크](https://example.com/ "링크 설명"), [상대 경로](./markdown-examples.md), [섹션 링크](#heading-demo).

[참조 링크][example], [축약 참조][], [단축 참조].

명시적 자동 링크: <https://example.com/> 및 <hello@example.com>.

자동 인식: https://example.com/path, www.example.com, hello@example.com.

[example]: https://example.com/ "참조 링크 설명"
[축약 참조]: https://example.com/collapsed
[단축 참조]: https://example.com/shortcut

## 이미지와 첨부 링크

![로컬 예제 이미지](./syntax-example.svg "Sohjae 문법 예제")

[예제 Markdown 파일](./markdown-examples.md)을 열어 원문을 확인할 수 있습니다.

[작은 텍스트 첨부.txt](data:text/plain;base64,U29oamFlIE1hcmtkb3duIGV4YW1wbGUuCg== "attachment-uri:%EC%9E%91%EC%9D%80%20%ED%85%8D%EC%8A%A4%ED%8A%B8%20%EC%B2%A8%EB%B6%80.txt")는 문서 안에 포함된 다운로드 첨부 예제입니다.

## 각주

첫 번째 각주[^first]와 두 번째 각주[^second]입니다. 첫 번째 각주를 다시 참조[^first]합니다.

[^first]: 첫 번째 각주의 **설명**입니다.

[^second]: 여러 문단으로 된 각주입니다.

    두 번째 설명 문단입니다.

## 정의 목록

Markdown
: 읽고 쓰기 쉬운 일반 텍스트 문법입니다.
: HTML로 렌더링할 수 있습니다.

Sohjae
: Rust/WASM 기반 편집기와 렌더러입니다.

## 접기 영역

<details open>
<summary>열려 있는 접기 영역</summary>

접기 영역 안의 **굵은 글자**와 일반 문단입니다.

- 접힌 영역의 목록
- 다음 항목

</details>

<details>
<summary>눌러서 펼치는 영역</summary>

숨겨져 있던 설명입니다.

</details>

## 허용 HTML

<mark>HTML 하이라이트</mark>, H<sub>2</sub>O, x<sup>2</sup>, <ins>추가된 내용</ins>.

<a name="html-anchor"></a>

[HTML 앵커로 이동](#html-anchor).

HTML 이미지 크기 지정:

<img src="./syntax-example.svg" alt="너비를 지정한 예제 이미지" width="320" height="90">

<picture>
<source srcset="./syntax-example.svg" media="(min-width: 600px)" type="image/svg+xml">
<img src="./syntax-example.svg" alt="picture 대체 이미지" width="320" height="90">
</picture>

<!-- 한 줄 HTML 주석: 읽기 화면에서는 표시하지 않습니다. -->

<!--
여러 줄 HTML 주석입니다.
원문 편집과 읽기 화면을 비교해 보세요.
-->

## 이모지

😀 한글과 Unicode 이모지. 별칭: :smile: :+1: :heart: :warning: :check: :rocket: :tada: :fire: :eyes: :tent: :joy: :thumbsup:.

***

## 편집 확인

- [ ] 인라인 문법의 진입·이탈과 삭제
- [ ] 목록 이어쓰기·들여쓰기·빈 항목 종료
- [ ] 표 행 추가·이동과 셀 편집
- [ ] 한글 조합·실행 취소·다시 실행
- [ ] 양쪽 편집기의 내용 동기화
- [ ] 임시 저장과 새로고침 후 복원
