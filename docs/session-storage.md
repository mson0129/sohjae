# 현재 탭의 Markdown 임시 저장

도구 막대의 **임시 저장**은 현재 원문을 `sessionStorage`에 저장하고 **임시 복원**은 저장된 원문으로 현재 문서를 교체한다. 기존 **브라우저 저장**은 `localStorage`, **저장**은 `.md` 파일 다운로드다.

```js
const editor = new Sohjae({
  selector: '#editor',
  session_storage: {
    key: 'my-app:document:42',
    auto_save: true
  }
});
await editor.ready;
// 생성 시 자동 덮어쓰기는 하지 않는다. 복원 시점은 호출자가 정한다.
editor.load_session(); // 저장값이 없으면 false
editor.save_session(); // { version: 1, markdown, saved_at }
editor.clear_session(); // 이 키의 임시 저장값만 삭제, 현재 문서는 유지
```

`auto_save` 기본값은 false다. 활성화하면 편집·실행 취소·원격 변경의 change 이벤트에 자동 저장한다. `set_markdown()`으로 외부 문서를 지정한 직후 저장하려면 `save_session()`을 호출한다. 키를 생략하면 `sohjae:${location.pathname}:${container.id || 'document'}`를 사용한다. 여러 문서·여러 편집기는 서로 다른 키를 지정한다.

저장값은 버전 1의 JSON 객체로 원문 Markdown과 ISO 시각을 포함한다. 공유되지 않은 로컬 초안이 있으면 그 초안을 저장한다. 파일 저장 여부인 dirty 상태는 바꾸지 않는다. IME 조합 중간 내용은 저장하지 않고 조합이 완료된 change 이벤트에서 자동 저장한다.

임시 저장값은 같은 origin의 **현재 탭**에 속한다. 새로고침 후에도 남지만 탭 세션이 끝나면 보통 사라지며, 브라우저의 세션 복원 정책에 따라 복구될 수 있다. 영구 보관은 브라우저 저장이나 파일 저장을 사용한다. 새 탭은 별도 저장 공간이며, 탭 복제 등에서는 초기 저장값이 복사될 수 있다. 다른 탭과 자동 동기화하지 않는다.

`load_session()`은 저장값이 없으면 false, 복원하면 true를 반환한다. 실행 취소가 가능하며 협업 연결 중에는 복원한 문서가 상대에게도 반영된다. 생성 직후 자동 복원하거나 저장값을 자동 삭제하지 않는다. 읽기 전용·읽기 화면·IME 조합 중에는 복원할 수 없다. 잘못된 JSON·알 수 없는 버전·문자열이 아닌 Markdown은 적용하지 않는다.

저장 차단·용량 초과 등은 수동 API에서는 오류를 던지고, 자동 저장에서는 error 이벤트와 상태 영역으로 알린다. 편집 내용은 그대로 유지된다. API 오류를 처리하려면 `try/catch` 또는 `error` 이벤트를 사용한다.

로컬 `collab/rich.html` 데모는 `sohjae:collab-demo:left`와 `sohjae:collab-demo:right`로 자동 저장한다. 새로고침 후 **임시 복원**을 눌러 복구할 수 있다.
