// Uses Node built-ins only. Exercises the actual compiled ABI, not a JavaScript fallback.
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { Core, byte_length } from '../web/core.js';

const wasm = await WebAssembly.compile(await readFile(new URL('../web/sohjae_editor.wasm', import.meta.url)));
const core = new Core((await WebAssembly.instantiate(wasm, {})).exports);
let state = core.request(0, '한😀');
state = core.request(3, '글', 3, 7); assert.equal(state.source, '한글');
state = core.request(5); assert.equal(state.source, '한😀');
state = core.request(6); assert.equal(state.source, '한글');
const revision = core.revision; core.revision = 0n;
assert.throws(() => core.request(3, 'invalid', 0, 0), /Stale/); core.revision = revision;
assert.throws(() => core.request(3, 'invalid', 1, 2), /InsideCodePoint/);
assert.equal(core.request(7).source, '한글'); core.request(1);

const measurements = [];
for (const count of [100, 1000, 10000]) {
  const source = '# 문서\n\n' + 'A paragraph with **bold** and 한글😀.\n\n'.repeat(count);
  const start = performance.now(); state = core.request(0, source); const load_ms = performance.now() - start;
  const offset = byte_length(source);
  const edit = performance.now(); state = core.request(3, 'x', offset, offset); const edit_ms = performance.now() - edit;
  assert.equal(state.source, source + 'x');
  const move = performance.now(); for (let i = 0; i < 100; i++) core.request(4, '', 0, 0); const selection_100_ms = performance.now() - move;
  measurements.push({ source_bytes: byte_length(source), lines: source.split('\n').length, load_ms: +load_ms.toFixed(2), edit_ms: +edit_ms.toFixed(2), selection_100_ms: +selection_100_ms.toFixed(2), wasm_memory_bytes: core.exports.memory.buffer.byteLength });
  core.request(1);
}
const report = { runtime: process.version, platform: process.platform, arch: process.arch, scope: 'WASM ABI only; excludes browser DOM layout and paint', measurements };
console.log(JSON.stringify(report, null, 2));
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n');
