import { create_replica, new_identity, byte_length } from './core.js';
import { bind_field } from './input.js';
import { connect_local_pair } from './webrtc.js';
const status = document.querySelector('#status'), connect_button = document.querySelector('#connect');
let connection = null, busy = false;
const document_id = new_identity();
const replicas = await Promise.all([create_replica({ document_id }), create_replica({ document_id })]);
replicas[0].replace_text(0, 0, '# 함께 쓰는 문서\n\n한쪽을 편집하면 다른 쪽에도 반영됩니다.\n');
replicas[0].create_table(byte_length(replicas[0].snapshot.text), 2, 2);
replicas[1].merge(replicas[0].export_state());
function report(error) { status.textContent = error.message; console.error(error); }
replicas.forEach((replica, index) => {
  const section = document.querySelector('#peer').content.firstElementChild.cloneNode(true);
  section.querySelector('h2').textContent = `사용자 ${index + 1}`; document.querySelector('#peers').append(section);
  const fields = [bind_field(replica, section.querySelector('.source'), null, report, () => render())];
  let structure = '';
  const run = callback => { try { callback(); } catch (error) { report(error); } };
  const button = (label, action) => { const element = document.createElement('button'); element.textContent = label; element.onclick = () => run(action); return element; };
  const render = () => {
    const state = replica.snapshot;
    section.querySelector('[data-action="undo"]').disabled = !state.can_undo;
    section.querySelector('[data-action="redo"]').disabled = !state.can_redo;
    section.querySelector('.preview').innerHTML = state.html;
    section.querySelector('.markdown').textContent = state.markdown;
    section.querySelector('.state').textContent = `${state.operation_count}개 연산 · 수신 대기 ${state.pending}개 · ${state.actor_id.slice(0, 8)}`;
    const signature = JSON.stringify(state.tables.map(table => [table.id, table.rows, table.columns]));
    // Defer structural DOM changes while a cell has a native IME composition.
    if (signature !== structure && !fields.some(field => field.composing())) {
      structure = signature; fields.splice(1);
      const container = section.querySelector('.tables'); container.replaceChildren();
      for (const table of state.tables) {
        const controls = document.createElement('div'); controls.className = 'table_tools';
        controls.append(button('행 추가', () => replica.insert_row(table.id, table.rows.at(-1))), button('열 추가', () => replica.insert_column(table.id, table.columns.at(-1))));
        if (table.rows.length) controls.append(button('마지막 행 삭제', () => replica.delete_row(table.id, table.rows.at(-1))));
        if (table.columns.length) controls.append(button('마지막 열 삭제', () => replica.delete_column(table.id, table.columns.at(-1))));
        container.append(controls);
        const element = document.createElement('table');
        for (const [row_index, row] of table.rows.entries()) {
          const tr = element.insertRow();
          for (const [column_index, column] of table.columns.entries()) {
            const cell = document.createElement('textarea'); cell.setAttribute('aria-label', `사용자 ${index + 1} 표 ${row_index + 1}행 ${column_index + 1}열`);
            tr.insertCell().append(cell); fields.push(bind_field(replica, cell, { table: table.id, row, column }, report, () => render()));
          }
        }
        container.append(element);
      }
    }
    fields.forEach(field => field.refresh());
  };
  section.querySelector('[data-action="undo"]').onclick = () => run(() => replica.undo());
  section.querySelector('[data-action="redo"]').onclick = () => run(() => replica.redo());
  section.querySelector('[data-action="table"]').onclick = () => run(() => replica.create_table(byte_length(state_text(replica)), 2, 2));
  replica.addEventListener('change', render); render();
});
function state_text(replica) { return replica.snapshot.text; }
async function toggle_connection() {
  if (busy) return; busy = true; connect_button.disabled = true;
  try {
    if (connection) { connection.close(); connection = null; status.textContent = '연결 끊김 · 양쪽에서 독립 편집 가능'; }
    else {
      status.textContent = 'WebRTC 연결 중…';
      connection = await connect_local_pair(...replicas);
      status.textContent = 'WebRTC 연결됨 · 두 복제본 동기화';
      for (const transport of connection.transports) transport.addEventListener('error', event => { connection?.close(); connection = null; connect_button.textContent = '다시 연결'; report(event.detail); });
    }
  } catch (error) { connection?.close(); connection = null; report(error); }
  finally { busy = false; connect_button.disabled = false; connect_button.textContent = connection ? '연결 끊기' : '다시 연결'; }
}
connect_button.onclick = toggle_connection;
window.addEventListener('pagehide', () => { connection?.close(); replicas.forEach(replica => replica.destroy()); });
await toggle_connection();
