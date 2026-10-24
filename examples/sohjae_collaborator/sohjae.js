// Classic-script entry point. Modules, CSS and WASM resolve beside this script.
(function () {
  'use strict';
  if (window.Sohjae) return;
  const entry = document.currentScript?.src;
  if (!entry) throw new Error('Load sohjae.js using a script src');
  const module_url = new URL('./editor.js', entry).href;
  const instances = new WeakMap();
  let module;
  const load = () => module ??= import(module_url).catch(error => { module = null; throw error; });
  const ready = () => document.readyState === 'loading'
    ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }))
    : Promise.resolve();

  const check = signal => { if (signal?.aborted) throw new DOMException('Editor initialization canceled', 'AbortError'); };
  async function init(options, signal, owner) {
    check(signal);
    if (typeof options === 'string') options = { selector: options };
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Expected a selector or initialization options');
    const { selector, target: supplied_target, plugins = [], collaboration, ...settings } = options;
    if (!Array.isArray(plugins) || plugins.some(name => name !== 'collaboration') || new Set(plugins).size !== plugins.length) throw new TypeError('Supported plugins: collaboration (once)');
    if (collaboration !== undefined && (!plugins.includes('collaboration') || !collaboration || typeof collaboration !== 'object' || Array.isArray(collaboration))) throw new TypeError('collaboration options require the collaboration plugin');
    if ((selector === undefined) === (supplied_target === undefined)) throw new TypeError('Specify exactly one selector or target');
    await ready();
    check(signal);
    let target = supplied_target;
    if (selector !== undefined) {
      if (typeof selector !== 'string' || !selector.trim()) throw new TypeError('selector must be a nonempty string');
      const matches = document.querySelectorAll(selector);
      if (matches.length !== 1) throw new Error('selector must match exactly one element');
      target = matches[0];
    }
    if (!(target instanceof HTMLElement)) throw new TypeError('target must be an HTML element');
    if (instances.has(target)) throw new Error('An editor is already active or initializing on this element');
    const record = { editor: null, owner };
    instances.set(target, record);
    const textarea = target instanceof HTMLTextAreaElement;
    const container = textarea ? document.createElement('div') : target;
    const original_hidden = target.hidden;
    let original_value = textarea ? target.value : null;
    let editor, listeners, owned_replica, session;
    const transports = new Set();
    let session_closed = false;
    const close_session = () => {
      if (session_closed) return;
      session_closed = true;
      for (const transport of transports) transport.close();
      transports.clear();
      owned_replica?.destroy();
    };
    try {
      if (textarea) {
        if (!target.parentNode) throw new Error('Attach the textarea before initializing');
        container.hidden = true;
        target.before(container);
      }
      const from_target = settings.markdown === undefined;
      if (from_target) settings.markdown = textarea ? target.value : target.textContent;
      if (textarea && settings.read_only === undefined && (target.readOnly || target.matches(':disabled'))) settings.read_only = true;
      const sdk = await load();
      check(signal);
      if (plugins.includes('collaboration')) {
        const [core, transport] = await Promise.all([import(new URL('./collab/core.js', entry).href), import(new URL('./collab/webrtc.js', entry).href)]);
        check(signal);
        if (!settings.replica) {
          owned_replica = await core.create_replica({ ...collaboration, document_id: collaboration?.document_id ?? core.new_identity() });
          settings.replica = owned_replica;
        } else if (collaboration !== undefined) throw new TypeError('Use either replica or collaboration creation options');
        check(signal);
        session = Object.freeze({
          replica: settings.replica,
          connect(channel, options) {
            if (session_closed) throw new Error('Collaboration session has been destroyed');
            const connection = new transport.WebRTCTransport(settings.replica, channel, options);
            transports.add(connection);
            connection.addEventListener('close', () => transports.delete(connection), { once: true });
            return connection;
          }
        });
      }
      editor = await sdk.create_editor(container, settings);
      Object.defineProperty(editor, 'collaboration', { value: session ?? null, enumerable: true });
      check(signal);
      if (textarea && from_target && target.value !== settings.markdown) editor.set_markdown(target.value);
      let destroyed = false;
      listeners = new AbortController();
      const sync = () => { if (textarea && !destroyed) target.value = editor.get_markdown({ normalize: false }); };
      const original_destroy = editor.destroy.bind(editor);
      // These host methods intentionally do not emit a change event in the core API.
      for (const name of ['set_markdown', 'discard_pending_draft']) {
        const method = editor[name].bind(editor);
        editor[name] = (...args) => { const result = method(...args); sync(); return result; };
      }
      editor.addEventListener('change', sync, { signal: listeners.signal });
      if (textarea) {
        const form = target.form;
        for (const label of target.labels) label.addEventListener('click', event => {
          if (!destroyed && !event.composedPath().includes(container)) { event.preventDefault(); editor.focus(); }
        }, { signal: listeners.signal });
        form?.addEventListener('submit', sync, { capture: true, signal: listeners.signal });
        form?.addEventListener('reset', event => queueMicrotask(() => {
          if (!destroyed && !event.defaultPrevented) {
            try { editor.set_markdown(target.value); }
            catch (error) { sync(); editor.dispatchEvent(new CustomEvent('error', { detail: error })); }
          }
        }), { signal: listeners.signal });
        target.addEventListener('invalid', event => { event.preventDefault(); if (!destroyed) editor.focus(); }, { signal: listeners.signal });
      }
      editor.destroy = () => {
        if (destroyed) return;
        sync();
        original_destroy();
        close_session();
        destroyed = true;
        listeners.abort();
        instances.delete(target);
        if (textarea) { target.hidden = original_hidden; container.remove(); if (signal?.aborted) target.value = original_value; }
      };
      if (textarea) original_value = target.value;
      sync();
      if (textarea) { target.hidden = true; container.hidden = original_hidden; }
      record.editor = editor;
      return editor;
    } catch (error) {
      listeners?.abort();
      editor?.destroy();
      close_session();
      instances.delete(target);
      if (textarea) { target.hidden = original_hidden; container.remove(); }
      throw error;
    }
  }
  function record_for(target) {
    if (typeof target === 'string') target = document.getElementById(target);
    return target instanceof HTMLElement ? instances.get(target) ?? null : null;
  }
  class Sohjae extends EventTarget {
    #editor = null;
    #destroyed = false;
    #loading = new AbortController();
    #events = new AbortController();
    constructor(options) {
      super();
      const ready = init(options, this.#loading.signal, this).then(editor => {
        if (this.#destroyed) { editor.destroy(); check(this.#loading.signal); }
        this.#editor = editor;
        for (const type of ['change', 'error', 'save']) editor.addEventListener(type, event => {
          this.dispatchEvent(new CustomEvent(type, { detail: event.detail }));
        }, { signal: this.#events.signal });
        this.dispatchEvent(new Event('ready'));
        return this;
      }).catch(error => {
        if (!this.#destroyed) this.dispatchEvent(new CustomEvent('error', { detail: error }));
        throw error;
      });
      Object.defineProperty(this, 'ready', { value: ready, enumerable: true });
      // Bare construction is supported; callers can still observe ready's rejection.
      ready.catch(() => {});
    }
    #active() {
      if (this.#destroyed) throw new Error('Editor has been destroyed');
      if (!this.#editor) throw new Error('Editor is not ready; await editor.ready');
      return this.#editor;
    }
    get collaboration() { return this.#active().collaboration; }
    get_markdown(...args) { return this.#active().get_markdown(...args); }
    set_markdown(...args) { return this.#active().set_markdown(...args); }
    get_selection(...args) { return this.#active().get_selection(...args); }
    set_selection(...args) { return this.#active().set_selection(...args); }
    replace(...args) { return this.#active().replace(...args); }
    set_options(...args) { return this.#active().set_options(...args); }
    get_options(...args) { return this.#active().get_options(...args); }
    mark_saved(...args) { return this.#active().mark_saved(...args); }
    get_pending_draft(...args) { return this.#active().get_pending_draft(...args); }
    discard_pending_draft(...args) { return this.#active().discard_pending_draft(...args); }
    focus(...args) { return this.#active().focus(...args); }
    async execute_command(...args) { return this.#active().execute_command(...args); }
    async run(...args) {
      try { return await this.#active().run(...args); }
      catch (error) { this.dispatchEvent(new CustomEvent('error', { detail: error })); }
    }
    destroy() {
      if (this.#destroyed) return;
      this.#destroyed = true;
      if (!this.#editor) this.#loading.abort();
      this.#events.abort();
      const editor = this.#editor;
      this.#editor = null;
      if (editor) editor.destroy();
    }
    static init(options) { return init(options); }
    static get(target) {
      const record = record_for(target);
      return record?.owner ? (record.owner.#editor ? record.owner : null) : record?.editor ?? null;
    }
  }
  window.Sohjae = Object.freeze(Sohjae);
})();
