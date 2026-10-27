# 브라우저 Markdown 저장

도구 막대의 **브라우저 저장**은 현재 Markdown 원문을 localStorage에 저장하고, **브라우저 불러오기**는 저장한 원문으로 현재 문서를 교체한다. 기존 **저장**은 `.md` 파일 다운로드를 계속 담당한다. localStorage는 실제 파일 생성이나 서버 저장이 아니다.

```js
const editor = new Sohjae({
  selector: '#editor',
  local_storage: {
    key: 'my-app:document:42',
    auto_save: true
  }
});
await editor.ready;
// 저장된 내용을 적용하려는 시점에 명시적으로 호출한다.
editor.load_local(); // 저장된 값이 없으면 false
// 수동 저장도 가능하다.
editor.save_local();
```

`auto_save` 기본값은 false다. 키를 생략하면 `sohjae:${location.pathname}:${container.id || 'document'}`를 사용한다. 여러 문서를 제공하거나 ID 없는 호스트를 여러 개 사용하는 경우 고유한 key를 지정한다. 협업 에디터에서도 키를 문서별로 지정해야 한다.

`save_local()`은 `{version:1, markdown, saved_at}`를 반환한다. 정규화하지 않은 원문을 저장하고, 복구 대기 중인 로컬 초안이 있으면 초안을 우선 저장한다. `load_local()`은 데이터가 없으면 false, 적용하면 true를 반환하며 전체 교체를 기존 history/CRDT 경로에 적용한다. 따라서 실행 취소가 가능하고 협업 연결 중에는 불러온 문서가 상대에게도 반영된다. 읽기 전용·읽기 화면·IME 조합 중에는 불러올 수 없다. 저장은 파일 저장 여부를 나타내는 dirty 상태를 초기화하지 않는다.

자동 저장은 change 이벤트가 발생하는 편집·실행 취소·원격 변경에 적용한다. `set_markdown()`으로 외부 문서를 지정한 직후에는 필요하면 `save_local()`을 호출한다. 생성 시 자동 불러오기는 하지 않으며, 다른 탭의 저장을 현재 문서에 자동 적용하지 않는다.

브라우저·프로필·origin별 저장이므로 포트나 도메인이 달라지면 별도 저장 공간이다. 브라우저 데이터 삭제 시 사라질 수 있고 저장 용량도 브라우저 제한을 따른다. 용량 초과·저장 차단은 오류 이벤트와 상태 영역에 표시하며 편집 내용은 유지한다. 잘못된 형식의 저장값은 문서에 적용하지 않는다. 중요한 문서는 별도의 `.md` 파일로도 저장한다.
