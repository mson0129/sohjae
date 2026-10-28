// Verify committed example artifacts, offline companions, and exclusive ABI boundaries.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
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

const landing=await readFile(new URL('../examples/index.html',import.meta.url),'utf8');
for(const [folder] of examples)assert(landing.includes('./'+folder+'/'));
assert(!landing.includes('id="workspace"'));
console.log('SDK demo index verified.');
