import { create_renderer } from './renderer.js';
const source = document.querySelector('#source'), preview = document.querySelector('#preview'), status = document.querySelector('#status');
try {
  const renderer = await create_renderer();
  const update = () => {
    try { preview.innerHTML = renderer.render(source.value); status.textContent = '렌더러 전용 WASM · 읽기 화면'; }
    catch (error) { status.textContent = error.message; }
  };
  source.addEventListener('input', update); update();
} catch (error) { status.textContent = error.message; }
