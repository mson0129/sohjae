import { create_editor } from './editor.js';
import { create_renderer } from './renderer.js';
const results = [], assert = (value, message = 'Contract failed') => { if (!value) throw new Error(message); };
const equal = (a,b) => assert(a === b, `${String(a)} !== ${String(b)}`);
const throws = action => { let error; try { action(); } catch (caught) { error = caught; } assert(error instanceof Error, 'Expected an Error'); return error; };
async function fixture(options = {}, container = document.createElement('div')) {
  document.querySelector('#fixtures').append(container);
  return create_editor(container, {markdown:'한😀', ...options});
}
async function test(name, action) {
  const item = document.createElement('li');
  try { await action(); item.textContent=`PASS ${name}`; item.className='pass'; results.push(true); }
  catch(error) { item.textContent=`FAIL ${name}: ${error.stack}`; item.className='fail'; results.push(false); }
  document.querySelector('#results').append(item);
}
await test('Renderer lifecycle, input types and independent instances', async () => {
  const a=await create_renderer(), b=await create_renderer();
  try { assert(a.render('**한😀**').includes('<strong')); assert(throws(()=>a.render(null)) instanceof TypeError); a.destroy(); a.destroy(); throws(()=>a.render('x')); assert(b.render('# Alive').includes('<h1')); }
  finally { a.destroy(); b.destroy(); }
});
await test('Editor UTF-8 selection, revision, event timing and export purity', async () => {
  const editor=await fixture();
  try {
    const initial=editor.get_selection(); equal(typeof initial.revision,'bigint');
    editor.set_selection(7,3); equal(editor.get_selection().anchor,7);
    let changes=0;
    editor.addEventListener('change',event=>{ changes++; equal(event.detail.revision,editor.get_selection().revision); equal(event.detail.dirty,true); equal(editor.get_markdown({normalize:false}),'한글'); });
    editor.replace('글'); equal(changes,1);
    const revision=editor.get_selection().revision;
    editor.get_markdown(); equal(editor.get_selection().revision,revision);
    editor.mark_saved(); equal(changes,1);
    for (const caret of [-1, 0.5, NaN, Infinity, 1, 999]) { throws(()=>editor.replace('😀',0,3,caret)); equal(editor.get_markdown({normalize:false}),'한글'); }
    for(const offset of [-1,0.5,NaN,Infinity,2**32,1]) { throws(()=>editor.set_selection(offset)); equal(editor.get_markdown({normalize:false}),'한글'); }
  } finally { editor.destroy(); }
});
await test('Read-only edits, option copies, replacement validation and document reset', async () => {
  const editor=await fixture({read_only:true});
  try {
    editor.replace('ignored'); await editor.execute_command('bold'); equal(editor.get_markdown({normalize:false}),'한😀');
    const options=editor.get_options(); options.auto_close.enabled=false; equal(editor.get_options().auto_close.enabled,true);
    throws(()=>editor.set_options({mode:'invalid'})); equal(editor.get_options().mode,'hybrid');
    throws(()=>editor.set_markdown(null)); equal(editor.get_markdown({normalize:false}),'한😀');
    editor.set_markdown('new\r\ntext'); equal(editor.get_markdown({normalize:false}),'new\ntext'); equal(editor.get_selection().anchor,0);
  } finally { editor.destroy(); }
});
await test('IME contracts: reject reset, defer options, ignore replace', async () => {
  const editor=await fixture();
  try {
    editor.surface.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
    throws(()=>editor.set_markdown('bad')); editor.replace('ignored'); editor.set_options({mode:'rich'});
    equal(editor.get_options().mode,'hybrid'); equal(editor.get_markdown({normalize:false}),'한😀');
    editor.surface.dispatchEvent(new CompositionEvent('compositionend',{data:'',bubbles:true}));
    equal(editor.get_options().mode,'rich');
  } finally { editor.destroy(); }
});
await test('Destroy is repeatable, public calls reject, run reports and container can be reused', async () => {
  const container=document.createElement('div'), editor=await fixture({},container);
  editor.destroy(); editor.destroy(); equal(container.shadowRoot.childNodes.length,0);
  for(const action of [()=>editor.get_markdown(),()=>editor.get_selection(),()=>editor.get_options(),()=>editor.set_markdown('x'),()=>editor.set_options({}),()=>editor.set_selection(0),()=>editor.replace('x'),()=>editor.mark_saved(),()=>editor.get_pending_draft(),()=>editor.discard_pending_draft(),()=>editor.focus()]) assert(/destroyed/.test(throws(action).message));
  let rejected=false; try { await editor.execute_command('bold'); } catch(error) { rejected=/destroyed/.test(error.message); } assert(rejected);
  let error; editor.addEventListener('error',event=>error=event.detail); await editor.run('bold'); assert(error instanceof Error);
  const next=await fixture({},container); next.destroy();
});
await test('Invalid construction and failed CSS load leave container reusable', async () => {
  const container=document.createElement('div'); let rejected=false;
  try { await fixture({mode:'invalid'},container); } catch(error) { rejected=error instanceof TypeError; } assert(rejected); equal(container.shadowRoot,null);
  const original=globalThis.fetch;
  try {
    globalThis.fetch=(url,...rest)=>String(url).endsWith('/editor.css') ? Promise.resolve(new Response('',{status:500})) : original(url,...rest);
    rejected=false; try { await fixture({},container); } catch(error) { rejected=/styles/.test(error.message); } assert(rejected);
  } finally { globalThis.fetch=original; }
  const editor=await fixture({},container); editor.destroy();
});
await test('Strict settings and unknown commands reject without changing document or configuration', async () => {
  const editor=await fixture();
  try {
    const before=JSON.stringify(editor.get_options());
    for(const patch of [null, [], {layouts:[]}, {keybindings:true}, {layout:{css_url:1}}, {layout:{css_url:'http://['}}, {layouts:{x:null}}, {auto_close:{pairs:[]}}, {filename:7}, {keybindings:{'mod+x':'not_a_command'}}, {wasm_url:'other.wasm'}, {markdown:'other'}]) {
      throws(()=>editor.set_options(patch)); equal(JSON.stringify(editor.get_options()),before); equal(editor.get_markdown({normalize:false}),'한😀');
    }
    for(const command of [null, {}, 'heading_7', 'heading_99', '__proto__', 'missing']) {
      let error; try { await editor.execute_command(command); } catch(caught) { error=caught; } assert(error instanceof TypeError);
      equal(editor.get_markdown({normalize:false}),'한😀');
    }
    for(const options of [null, [], {normalize:1}]) throws(()=>editor.get_markdown(options));
    let reported; editor.addEventListener('error',event=>reported=event.detail); await editor.run('missing'); assert(reported instanceof TypeError);
  } finally { editor.destroy(); }
});
await test('Multiple deferred options merge, last value wins and caller mutations are isolated', async () => {
  const editor=await fixture();
  try {
    editor.surface.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
    const patch={auto_close:{enabled:false},mode:'rich'}; editor.set_options(patch); patch.mode='markdown'; patch.auto_close.enabled=true;
    editor.set_options({show_heading_levels:true,auto_close:{skip_closing:false}});
    editor.set_options({mode:'markdown'});
    throws(()=>editor.set_options({mode:'bad'}));
    equal(editor.get_options().mode,'hybrid');
    editor.surface.dispatchEvent(new CompositionEvent('compositionend',{data:'',bubbles:true}));
    const settings=editor.get_options(); equal(settings.mode,'markdown'); equal(settings.auto_close.enabled,false); equal(settings.auto_close.skip_closing,false); equal(settings.show_heading_levels,true);
  } finally { editor.destroy(); }
});
await test('Construction serializes per container and validates config before allocating an editor', async () => {
  const container=document.createElement('div'); document.querySelector('#fixtures').append(container);
  const original=globalThis.fetch; let release;
  try {
    globalThis.fetch=(url,...rest)=>String(url)==='contract-config' ? new Promise(resolve=>{release=()=>resolve(new Response(JSON.stringify({mode:'markdown',auto_close:{enabled:false}})));}) : original(url,...rest);
    const options={config_url:'contract-config',mode:'rich'};
    const pending=create_editor(container,options); options.mode='markdown';
    let error; try { await create_editor(container); } catch(caught) { error=caught; } assert(error instanceof Error);
    release(); const editor=await pending;
    try { equal(editor.get_options().mode,'rich'); equal(editor.get_options().auto_close.enabled,false); } finally { editor.destroy(); }
    for(const config of [null, [], {layouts:{broken:null}}]) {
      globalThis.fetch=(url,...rest)=>String(url)==='contract-config' ? Promise.resolve(new Response(JSON.stringify(config))) : original(url,...rest);
      error=null; try { await create_editor(container,{config_url:'contract-config'}); } catch(caught) { error=caught; } assert(error instanceof TypeError); equal(container.shadowRoot.childNodes.length,0);
    }
  } finally { globalThis.fetch=original; }
  const editor=await create_editor(container); editor.destroy();
});
await test('Every toolbar command is typed and the host save/reload lifecycle preserves clean export', async () => {
  const editor=await fixture();
  try {
    const declaration=await fetch('./editor.d.ts').then(response=>response.text());
    const commands=declaration.split('export type EditorCommand =')[1].split(';')[0];
    for(const button of editor.toolbar.querySelectorAll('[data-command]')) assert(commands.includes("'"+button.dataset.command+"'"),button.dataset.command);
    editor.set_selection(3,7); editor.replace('글'); const saved=editor.get_markdown(); const revision=editor.get_selection().revision;
    editor.mark_saved(); equal(editor.get_selection().revision,revision);
    editor.set_markdown(saved); equal(editor.get_markdown(),saved);
    const copy=editor.get_selection(); copy.anchor=999; equal(editor.get_selection().anchor,0);
    await editor.execute_command('undo'); equal(editor.get_markdown(),saved);
  } finally { editor.destroy(); }
});
await test('File-open completion cannot overwrite a changed or destroyed editor', async () => {
  const editor=await fixture(), original=document.createElement; let input;
  try {
    document.createElement=function(name,...rest) { const element=original.call(this,name,...rest); if(name==='input') { input=element; element.click=()=>{}; } return element; };
    await editor.execute_command('open');
    let resolve; Object.defineProperty(input,'files',{value:[{text:()=>new Promise(done=>resolve=done)}]});
    let error; editor.addEventListener('error',event=>error=event.detail);
    const reading=input.onchange(); editor.set_markdown('new document'); resolve('old file'); await reading;
    assert(error instanceof Error); equal(editor.get_markdown({normalize:false}),'new document');
    await editor.execute_command('open'); Object.defineProperty(input,'files',{value:[{text:()=>new Promise(done=>resolve=done)}]});
    const late=input.onchange(); error=null; editor.destroy(); resolve('late file'); await late; equal(error,null);
  } finally { document.createElement=original; editor.destroy(); }
});
document.querySelector('#summary').textContent=`${results.filter(Boolean).length}/${results.length} passed`;
document.body.dataset.passed=String(results.every(Boolean));
