// Verify committed example artifacts, offline companions, and exclusive ABI boundaries.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const packagedOnly=process.argv.includes('--packaged-only');
const binaries=new Map();
const examples=[['sohjae_renderer',['sohjae_render.wasm']],['sohjae_editor',['sohjae_editor.wasm']],['sohjae_collaborator',['sohjae_editor.wasm','sohjae_collaborator.wasm']]];
for(const [folder,names]of examples){
 const base=new URL(`../examples/${folder}/`,import.meta.url);
 assert.match(await readFile(new URL('index.html',base),'utf8'),/example\.js/);
 if(folder!=='sohjae_renderer')assert.match(await readFile(new URL('source-map.js',base),'utf8'),/export class SourceMap/);
 const bundle=await readFile(new URL('example.js',base),'utf8');
 assert.doesNotMatch(bundle,/import\.meta|\bimport\(/);
 for(const name of names){
  const bytes=await readFile(new URL(name,base));
  if(!packagedOnly)assert.deepEqual(bytes,await readFile(new URL(`../web/${name}`,import.meta.url)));
  if(binaries.has(name))assert.deepEqual(bytes,binaries.get(name));else binaries.set(name,bytes);
  const companion=await readFile(new URL(`${name}.js`,base),'utf8');
  const encoded=companion.match(/data:application\/wasm;base64,([A-Za-z0-9+/=]+)/)[1];
  assert.deepEqual(Buffer.from(encoded,'base64'),bytes);
  const module=await WebAssembly.compile(bytes),exports=WebAssembly.Module.exports(module).filter(item=>item.kind==='function').map(item=>item.name);
  assert.deepEqual(WebAssembly.Module.imports(module),[]);
  if(name==='sohjae_editor.wasm'){assert(exports.includes('dispatch'));assert(!exports.some(name=>name.startsWith('collab_')||name.startsWith('renderer_')));}
  if(name==='sohjae_collaborator.wasm'){assert(exports.includes('collab_dispatch'));assert(exports.every(name=>name.startsWith('collab_')));}
  if(name==='sohjae_render.wasm')assert(exports.every(name=>name.startsWith('renderer_')));
  console.log(`${folder}/${name}: ${bytes.length} bytes; isolated ABI and local-file companion verified`);
 }
}

for (const name of ['sohjae.js','sohjae.d.ts','quick-start.html','editor.js','editor.d.ts','core.js','clipboard.js','html.js','rich-dom.js','editor.css']) {
  assert.deepEqual(await readFile(new URL(`../examples/sohjae_editor/${name}`,import.meta.url)),await readFile(new URL(`../web/${name}`,import.meta.url)));
}
console.log('Classic-script quick start and SDK example assets verified.');

for(const name of ['app.js','app.css','store.js','browser-sync.js','offline.js','export-zip.js'])assert.deepEqual(await readFile(new URL('../examples/'+name,import.meta.url)),await readFile(new URL('../web/app/'+name,import.meta.url)));
const application=await readFile(new URL('../examples/index.html',import.meta.url),'utf8');
assert.match(application,/data-editor-base=".\/sohjae_collaborator\/"/);assert.match(application,/data-renderer-base=".\/sohjae_renderer\/"/);assert.match(application,/id="toc"/);assert.match(application,/id="sync-scroll"/);
console.log('Pages workspace and relative SDK assets verified.');

const worker=await readFile(new URL('../examples/sw.js',import.meta.url),'utf8');
const encoded=worker.match(/^const ASSETS=(\[.*\]);$/m)[1];
const assets=JSON.parse(encoded),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(JSON.parse(worker.match(/^const BUILD=(".*");$/m)[1]),hash(encoded).slice(0,20));
assert.equal(new Set(assets.map(asset=>asset.url)).size,assets.length);
for(const asset of assets){
 assert(!asset.url.includes('..')&&!asset.url.includes('://'));
 const path=asset.url==='./'?'index.html':asset.url;
 assert.equal(hash(await readFile(new URL('../examples/'+path,import.meta.url))),asset.sha256,asset.url);
}
for(const name of ['sohjae_editor.wasm','sohjae_collaborator.wasm','sohjae_render.wasm'])assert(assets.some(asset=>asset.url.endsWith('/'+name)));
assert.match(application,/오프라인에서도 사용 가능/);
assert.match(application,/편집 시작하기/);
console.log(`Offline manifest: ${assets.length} version-matched app assets verified.`);
