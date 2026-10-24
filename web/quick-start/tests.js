(async () => {
  'use strict';
  let passed = 0, failed = 0;
  const fixtures = document.querySelector('#fixtures');
  const assert = (value, message = 'Contract failed') => { if (!value) throw new Error(message); };
  const equal = (a,b) => assert(a === b, `${a} !== ${b}`);
  async function test(name, action) {
    const item = document.createElement('li');
    try { await action(); item.textContent = `PASS ${name}`; item.className='pass'; passed++; }
    catch(error) { item.textContent=`FAIL ${name}: ${error.stack}`; item.className='fail'; failed++; }
    document.querySelector('#results').append(item);
  }
  async function reject(promise) { let error; try { await promise; } catch(caught) { error=caught; } assert(error instanceof Error,'Expected rejection'); }
  function fixture(text='한😀') {
    const form=document.createElement('form'), textarea=document.createElement('textarea'); textarea.name='markdown'; textarea.defaultValue=text;
    form.append(textarea); form.addEventListener('submit',event=>event.preventDefault()); fixtures.append(form); return {form,textarea};
  }
  await test('Head initialization waits for the DOM and resolves all assets relative to the script',async()=>{
    const editor=await window.initial_editor_promise;
    equal(editor.get_markdown({normalize:false}),'# Before DOM ready');equal(Sohjae.get('initial-editor'),editor);
    editor.destroy();equal(Sohjae.get('initial-editor'),null);assert(!document.querySelector('#initial-editor').hidden);
  });
  await test('Textarea initial value, live editing, undo/redo and host replacement synchronize form data',async()=>{
    const {form,textarea}=fixture(); const other=document.createElement('input'); other.name='markdown'; other.value='second field';form.append(other);
    const editor=await Sohjae.init({target:textarea});
    try {
      assert(textarea.hidden);equal(textarea.name,'markdown');editor.set_selection(3,7);editor.replace('글');equal(new FormData(form).get('markdown'),'한글');
      await editor.execute_command('undo');equal(textarea.value,'한😀');await editor.execute_command('redo');equal(textarea.value,'한글');
      editor.set_markdown('# host update');equal(new FormData(form).getAll('markdown').join('|'),'# host update|second field');
      form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));equal(textarea.value,'# host update');
    }finally{editor.destroy();form.remove();}
  });
  await test('Form reset uses textarea defaultValue and canceled reset preserves the document',async()=>{
    const {form,textarea}=fixture('default');const editor=await Sohjae.init({target:textarea,markdown:'override'});
    try {
      equal(textarea.value,'override');form.reset();await Promise.resolve();equal(editor.get_markdown({normalize:false}),'default');
      editor.set_markdown('edited');form.addEventListener('reset',event=>event.preventDefault(),{once:true});form.reset();await Promise.resolve();equal(editor.get_markdown({normalize:false}),'edited');equal(textarea.value,'edited');
    }finally{editor.destroy();form.remove();}
  });
  await test('Failure leaves textarea visible and reusable; missing and multiple selectors reject',async()=>{
    const {form,textarea}=fixture('preserved');textarea.className='multiple';const second=document.createElement('div');second.className='multiple';fixtures.append(second);
    try {
      await reject(Sohjae.init({target:textarea,mode:'bad'}));assert(!textarea.hidden);equal(textarea.value,'preserved');equal(Sohjae.get(textarea),null);equal(form.children.length,1);
      await reject(Sohjae.init('#missing-element'));await reject(Sohjae.init('.multiple'));await reject(Sohjae.init({target:textarea,selector:'.multiple'}));
      const editor=await Sohjae.init({target:textarea});editor.destroy();assert(!textarea.hidden);
    }finally{form.remove();second.remove();}
  });
  await test('Duplicate initialization rejects and repeatable teardown restores the textarea with current Markdown',async()=>{
    const {form,textarea}=fixture();const first=Sohjae.init({target:textarea});const duplicate=Sohjae.init({target:textarea});await reject(duplicate);const editor=await first;
    editor.set_markdown('current');await reject(Sohjae.init({target:textarea}));editor.destroy();editor.destroy();assert(!textarea.hidden);equal(textarea.value,'current');equal(form.children.length,1);equal(Sohjae.get(textarea),null);
    const again=await Sohjae.init({target:textarea});equal(again.get_markdown({normalize:false}),'current');again.destroy();form.remove();
  });
  await test('Div targets and selector shorthand accept Markdown without requiring module scripts',async()=>{
    const div=document.createElement('div');div.id='markdown-div';div.textContent='# Div document';fixtures.append(div);
    const editor=await Sohjae.init('#markdown-div');equal(editor.get_markdown({normalize:false}),'# Div document');equal(Sohjae.get('markdown-div'),editor);editor.destroy();div.remove();
  });
  await test('Native readonly/disabled and required form attributes retain their semantics',async()=>{
    const {form,textarea}=fixture('readonly');textarea.readOnly=true;
    const editor=await Sohjae.init({target:textarea});equal(editor.get_options().read_only,true);editor.replace('bad');equal(textarea.value,'readonly');editor.destroy();
    textarea.readOnly=false;textarea.disabled=true;const disabled=await Sohjae.init({target:textarea});equal(disabled.get_options().read_only,true);equal(new FormData(form).has('markdown'),false);disabled.destroy();
    textarea.disabled=false;textarea.required=true;textarea.value='';const required=await Sohjae.init({target:textarea});assert(!form.checkValidity());required.set_markdown('valid');assert(form.checkValidity());required.destroy();form.remove();
  });
  await test('Associated labels focus the editor and disabled fieldsets remain read-only',async()=>{
    const {form,textarea}=fixture('label');textarea.id='labeled-markdown';const label=document.createElement('label');label.htmlFor=textarea.id;label.textContent='Document';form.prepend(label);
    const editor=await Sohjae.init({target:textarea});label.click();assert(editor.root.activeElement===editor.surface);editor.destroy();label.click();assert(document.activeElement===textarea);
    const fieldset=document.createElement('fieldset');fieldset.disabled=true;form.append(fieldset);fieldset.append(textarea);const disabled=await Sohjae.init({target:textarea});equal(disabled.get_options().read_only,true);disabled.destroy();form.remove();
  });
  await test('Reloading the entry script preserves the registry and API object',async()=>{
    const api=Sohjae;await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='../sohjae.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});equal(Sohjae,api);
  });
  await test('Constructor returns an instance immediately, then forwards editor methods and events after ready',async()=>{
    const {form,textarea}=fixture('constructor');const editor=new Sohjae({target:textarea});
    assert(editor instanceof Sohjae);assert(editor instanceof EventTarget);equal(Sohjae.get(textarea),null);
    let early;try{editor.get_markdown();}catch(error){early=error;}assert(early instanceof Error);
    let ready=0,changes=0;editor.addEventListener('ready',function(){ready++;equal(this,editor);equal(this.get_markdown({normalize:false}),'constructor');equal(Sohjae.get(textarea),editor);});
    editor.addEventListener('change',event=>{changes++;assert(typeof event.detail.revision==='bigint');});
    try {
      equal(await editor.ready,editor);equal(ready,1);editor.set_markdown('abc');editor.set_selection(3);editor.replace('!');equal(changes,1);equal(textarea.value,'abc!');await editor.execute_command('undo');equal(textarea.value,'abc');
      let error;editor.addEventListener('error',event=>error=event.detail);await editor.run('invalid');assert(error instanceof TypeError);
      editor.destroy();editor.destroy();equal(Sohjae.get(textarea),null);assert(!textarea.hidden);equal(textarea.value,'abc');
      let destroyed;try{editor.get_selection();}catch(error){destroyed=error;}assert(destroyed instanceof Error);
    }finally{editor.destroy();form.remove();}
  });
  await test('Constructor failure rejects ready, emits error once and leaves the textarea reusable',async()=>{
    const {form,textarea}=fixture('preserved');const editor=new Sohjae({target:textarea,mode:'invalid'});let error,count=0;
    editor.addEventListener('error',event=>{error=event.detail;count++;});await reject(editor.ready);equal(count,1);assert(error instanceof TypeError);assert(!textarea.hidden);equal(textarea.value,'preserved');equal(Sohjae.get(textarea),null);editor.destroy();
    const retry=new Sohjae({target:textarea});await retry.ready;retry.destroy();form.remove();
  });
  await test('Destroy before readiness cancels initialization and restores the original textarea',async()=>{
    const {form,textarea}=fixture('original');const editor=new Sohjae({target:textarea,markdown:'must not apply'});let errors=0;editor.addEventListener('error',()=>errors++);editor.destroy();editor.destroy();
    let aborted;try{await editor.ready;}catch(error){aborted=error;}equal(aborted.name,'AbortError');equal(errors,0);equal(textarea.value,'original');assert(!textarea.hidden);equal(form.children.length,1);equal(Sohjae.get(textarea),null);
    const next=new Sohjae({target:textarea});await next.ready;next.destroy();form.remove();
  });
  await test('Destroy during asset loading releases the initialized core without applying source overrides',async()=>{
    const {form,textarea}=fixture('kept');const original=globalThis.fetch;let release,editor;
    try {
      globalThis.fetch=(url,...args)=>String(url).endsWith('/editor.css')?new Promise(resolve=>release=()=>resolve(new Response(''))):original(url,...args);
      editor=new Sohjae({target:textarea,markdown:'must not apply'});
      for(let i=0;i<100&&!release;i++)await new Promise(resolve=>setTimeout(resolve,5));assert(release,'CSS request was not started');
      editor.destroy();release();let error;try{await editor.ready;}catch(caught){error=caught;}equal(error.name,'AbortError');equal(textarea.value,'kept');equal(form.children.length,1);assert(!textarea.hidden);equal(Sohjae.get(textarea),null);
    }finally{globalThis.fetch=original;editor?.destroy();form.remove();}
  });
  await test('Cancellation between mounting and constructor adoption restores the original source',async()=>{
    const {form,textarea}=fixture('original');let editor,canceled=false;
    const observer=new MutationObserver(()=>{if(textarea.hidden&&Sohjae.get(textarea)===null){canceled=true;editor.destroy();}});observer.observe(textarea,{attributes:true,attributeFilter:['hidden']});
    try {
      editor=new Sohjae({target:textarea,markdown:'override'});let error;try{await editor.ready;}catch(caught){error=caught;}assert(canceled);equal(error.name,'AbortError');equal(textarea.value,'original');assert(!textarea.hidden);equal(form.children.length,1);equal(Sohjae.get(textarea),null);
    }finally{observer.disconnect();editor?.destroy();form.remove();}
  });
  await test('Typing into a visible textarea during loading is preserved when the constructor becomes ready',async()=>{
    const {form,textarea}=fixture('initial');const original=globalThis.fetch;let release,editor;
    try {
      globalThis.fetch=(url,...args)=>String(url).endsWith('/editor.css')?new Promise(resolve=>release=()=>resolve(new Response(''))):original(url,...args);
      editor=new Sohjae({target:textarea});for(let i=0;i<100&&!release;i++)await new Promise(resolve=>setTimeout(resolve,5));assert(release);textarea.value='typed while loading';release();await editor.ready;equal(editor.get_markdown({normalize:false}),'typed while loading');equal(textarea.value,'typed while loading');
    }finally{globalThis.fetch=original;editor?.destroy();form.remove();}
  });
  await test('Normal editor loads no collaboration runtime',async()=>{
    assert(!performance.getEntriesByType('resource').some(item=>/collab\/(core|webrtc)\.js|sohjae_collaborator\.wasm/.test(item.name)));
  });
  await test('Collaboration plugin creates a shared document, syncs and owns its replica',async()=>{
    const a=fixture('shared'),b=fixture('');let x,y;
    try {
      x=new Sohjae({target:a.textarea,plugins:['collaboration']});await x.ready;
      const replica=x.collaboration.replica;
      y=new Sohjae({target:b.textarea,plugins:['collaboration'],collaboration:{document_id:replica.snapshot.document_id}});await y.ready;
      y.collaboration.replica.merge(replica.export_state());equal(y.get_markdown({normalize:false}),'shared');
      x.set_selection(6,6);x.replace('!');y.collaboration.replica.merge(replica.export_state());equal(y.get_markdown({normalize:false}),'shared!');
      const peer=new RTCPeerConnection();const channel=peer.createDataChannel('test');const connection=x.collaboration.connect(channel,{authorize_peer:()=>false});x.destroy();assert(connection.closed);peer.close();let error;try{replica.export_state();}catch(caught){error=caught;}assert(error);x=null;
    }finally{x?.destroy();y?.destroy();a.form.remove();b.form.remove();}
  });
  await test('Plugin preserves host-owned replica and rejects invalid configuration',async()=>{
    const {create_replica,new_identity}=await import('../collab/core.js');const replica=await create_replica({document_id:new_identity()});const a=fixture('host');let editor;
    try{editor=new Sohjae({target:a.textarea,plugins:['collaboration'],replica});await editor.ready;editor.destroy();replica.export_state();await reject(new Sohjae({target:a.textarea,plugins:['unknown']}).ready);await reject(new Sohjae({target:a.textarea,collaboration:{}}).ready);}
    finally{editor?.destroy();replica.destroy();a.form.remove();}
  });
  await test('Renderer constructor transforms div text, updates, restores and reinitializes',async()=>{
    const div=document.createElement('div');div.textContent='# 제목\n\n==highlight==';fixtures.append(div);let renderer;
    try{renderer=new SeojaeRenderer({target:div});equal(SeojaeRenderer,SohjaeRenderer);await renderer.ready;equal(div.querySelector('h1').textContent,'제목');assert(div.querySelector('mark'));equal(renderer.get_markdown(),'# 제목\n\n==highlight==');await reject(new SeojaeRenderer({target:div}).ready);renderer.render('**new**');equal(div.querySelector('strong').textContent,'new');renderer.destroy();equal(div.textContent,'**new**');renderer=new SeojaeRenderer({target:div});await renderer.ready;renderer.destroy();}
    finally{renderer?.destroy();div.remove();}
  });
  await test('Renderer rejects missing targets and cancellation preserves source',async()=>{
    await reject(new SeojaeRenderer({selector:'#missing-renderer'}).ready);const div=document.createElement('div');div.textContent='source';fixtures.append(div);const renderer=new SeojaeRenderer({target:div});renderer.destroy();await reject(renderer.ready);equal(div.textContent,'source');div.remove();
  });
  document.querySelector('#summary').textContent=`${passed} passed / ${failed} failed`;
  document.documentElement.dataset.result=failed?'failed':'passed';
})().catch(error=>{document.querySelector('#summary').textContent=`Harness failed: ${error.message}`;console.error(error);});
