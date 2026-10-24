// Classic standalone renderer. Only renderer.js, renderer.css and render WASM load.
(function () {
  'use strict';
  if (window.SeojaeRenderer) return;
  const entry = document.currentScript?.src;
  if (!entry) throw new Error('Load sohjae-renderer.js using a script src');
  const instances = new WeakMap();
  let stylesheet;
  function styles() {
    return stylesheet ??= new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = new URL('./renderer.css', entry).href;
      link.onload = resolve;
      link.onerror = () => { link.remove(); stylesheet = null; reject(new Error('Renderer CSS load failed')); };
      document.head.append(link);
    });
  }
  class SeojaeRenderer extends EventTarget {
    #renderer; #target; #markdown; #destroyed = false; #added_class = false;
    constructor(options) {
      super();
      const ready = this.#init(options).then(() => { this.dispatchEvent(new Event('ready')); return this; }).catch(error => {
        if (!this.#destroyed) this.dispatchEvent(new CustomEvent('error', { detail: error }));
        throw error;
      });
      Object.defineProperty(this, 'ready', { value: ready, enumerable: true });
      ready.catch(() => {});
    }
    #check() { if (this.#destroyed) throw new DOMException('Renderer destroyed', 'AbortError'); }
    async #init(options) {
      if (typeof options === 'string') options = { selector: options };
      if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Expected renderer options');
      const { selector, target: supplied, markdown, wasm_url } = options;
      if ((selector === undefined) === (supplied === undefined)) throw new TypeError('Specify exactly one selector or target');
      if (markdown !== undefined && typeof markdown !== 'string') throw new TypeError('Markdown must be a string');
      if (document.readyState === 'loading') await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
      this.#check();
      let target = supplied;
      if (selector !== undefined) {
        if (typeof selector !== 'string' || !selector.trim()) throw new TypeError('selector must be a nonempty string');
        const matches = document.querySelectorAll(selector);
        if (matches.length !== 1) throw new Error('selector must match exactly one element');
        target = matches[0];
      }
      if (!(target instanceof HTMLElement) || target.matches('input,textarea,select')) throw new TypeError('target must be an HTML content element');
      if (instances.has(target)) throw new Error('A renderer is already active or initializing on this element');
      this.#target = target; instances.set(target, this);
      try {
        const [{ create_renderer }] = await Promise.all([import(new URL('./renderer.js', entry).href), styles()]);
        this.#check();
        const renderer = await create_renderer({ wasm_url });
        if (this.#destroyed) { renderer.destroy(); this.#check(); }
        this.#renderer = renderer;
        this.render(markdown ?? target.textContent);
        this.#added_class = !target.classList.contains('sohjae_viewer');
        target.classList.add('sohjae_viewer');
      } catch (error) {
        this.#renderer?.destroy(); this.#renderer = null;
        if (instances.get(target) === this) instances.delete(target);
        throw error;
      }
    }
    #active() { this.#check(); if (!this.#renderer) throw new Error('Renderer is not ready; await renderer.ready'); return this.#renderer; }
    render(markdown) {
      const html = this.#active().render(markdown);
      this.#target.innerHTML = html; this.#markdown = markdown;
      return html;
    }
    get_markdown() { this.#active(); return this.#markdown; }
    destroy() {
      if (this.#destroyed) return;
      this.#destroyed = true;
      if (this.#renderer) {
        this.#renderer.destroy(); this.#renderer = null;
        this.#target.textContent = this.#markdown;
        if (this.#added_class) this.#target.classList.remove('sohjae_viewer');
      }
      if (this.#target && instances.get(this.#target) === this) instances.delete(this.#target);
    }
  }
  window.SeojaeRenderer = window.SohjaeRenderer = Object.freeze(SeojaeRenderer);
})();
