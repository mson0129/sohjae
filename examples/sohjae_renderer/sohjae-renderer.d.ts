export type RendererOptions = { markdown?: string; wasm_url?: string | URL } & (
  | { selector: string; target?: never } | { target: HTMLElement; selector?: never }
);
export interface RendererHandle extends EventTarget {
  readonly ready: Promise<RendererHandle>;
  render(markdown: string): string;
  get_markdown(): string;
  destroy(): void;
}
export interface RendererConstructor { new(options: string | RendererOptions): RendererHandle; }
declare global {
  const SeojaeRenderer: RendererConstructor;
  const SohjaeRenderer: RendererConstructor;
  interface Window { readonly SeojaeRenderer: RendererConstructor; readonly SohjaeRenderer: RendererConstructor; }
}
