# Sohjae

[English](README.md) | [Español](docs/readme/README.es.md) | [日本語](docs/readme/README.ja.md) | [한국어](docs/readme/README.ko.md)

An embeddable Markdown editor and renderer built with Rust/WASM, the Rust standard library, and native browser APIs. No external crates, JavaScript packages, or editor frameworks are required. Licensed under [MIT](LICENSE).

Renderer and single-user editor public APIs follow the [API v1 stability and compatibility policy](docs/api-stability.md). Collaboration follows the [API v2 and protocol stability contract](docs/collaboration-protocol.md), with explicit protocol/schema checks before document exchange.

Try the [live demos](https://mson0129.github.io/sohjae/): renderer, editor and same-page collaboration.

## Quick start

Serve the editor SDK folder and load one script. CSS, WASM, and internal modules load automatically relative to that script.

```html
<script src="./sohjae/sohjae.js"></script>
<textarea id="editor" name="markdown"># Hello, Sohjae!</textarea>
<script>new Sohjae({ selector: '#editor' });</script>
```

[Quick-start guide](docs/quick-start.md) · [Runnable example](http://127.0.0.1:8080/quick-start.html). A textarea keeps its form value synchronized; a div can also be used.

## Ready-to-run examples

| Example | WASM modules |
| --- | --- |
| [Markdown renderer](examples/sohjae_renderer/index.html) | `sohjae_render.wasm` |
| [Markdown editor](examples/sohjae_editor/index.html) | `sohjae_editor.wasm` |
| [Collaborative editor](examples/sohjae_collaborator/index.html) | `sohjae_editor.wasm` + optional `sohjae_collaborator.wasm` |

Each folder contains `index.html`, JavaScript, CSS, WASM binaries, and companions for opening local files. Keep the entire folder together. HTTP loads the adjacent WASM binary; `file://` uses a companion containing the same binary. Opening the examples requires no build tools. Direct local-file opening has not been verified end to end because browser automation restricts `file://`; use the local HTTP server if your browser restricts local scripts.

```sh
python3 scripts/serve_examples.py --port 8081
```

Open [renderer](http://127.0.0.1:8081/sohjae_renderer/index.html), [editor](http://127.0.0.1:8081/sohjae_editor/index.html), or [collaborative editor](http://127.0.0.1:8081/sohjae_collaborator/index.html). See the [example guide](examples/README.md).

## Features

- Rich, hybrid, and Markdown modes, a full-source view, and per-element syntax visibility.
- Highlighting (`==text==`), definition lists, custom heading IDs, and basic code highlighting. Subscript (`H~2~O`) and superscript (`X^2^`) extensions are supported.
- Formatting tools, undo/redo, Korean IME composition handling, and UTF-8/UTF-16 selection mapping.
- Table navigation, row/column insertion and removal, alignment, multiple selection, and drag handles for reordering rows and columns.
- Conversion of supported HTML paste structures, Base64 image/file embedding, and downloads.
- Front Matter, CSS layouts, reading and read-only views, and a keyboard command palette.
- Source-preserving editing and normalized export for supported syntax.

## Build and run

Install Rust and Python 3. Node.js is used for WASM checks and measurements.

```sh
rustup target add wasm32-unknown-unknown
sh scripts/build.sh
python3 scripts/serve.py --port 8080
```

- [Editor](http://127.0.0.1:8080/), [renderer](http://127.0.0.1:8080/renderer.html), and [extended syntax](http://127.0.0.1:8080/extended.html) ([source](web/extended.md)).
- [Browser tests](http://127.0.0.1:8080/tests.html) and [GFM audit](http://127.0.0.1:8080/gfm-audit.html).
- Editor WASM verification: `node scripts/check_wasm.mjs`.
- Build all three SDK archives: `sh scripts/package.sh`.

The renderer SDK uses `renderer.js` and `sohjae_render.wasm` without editing, history, CRDT, or WebRTC code. Build it separately with `sh scripts/package_renderer.sh`. See the [renderer API](docs/renderer.md).

## Embed the editor

Serve the built JavaScript modules, CSS, and WASM files from `web/` together, preserving their relative paths. Each editor uses Shadow DOM to isolate its styles from the host page.

```html
<div id="editor"></div>
<script type="module">
  import { create_editor } from './sohjae/editor.js';
  const editor = await create_editor(document.querySelector('#editor'), {
    markdown: '# Document\n\nContent',
    mode: 'hybrid',
    elements: { table: { reveal_markdown: false } }
  });
  editor.addEventListener('change', event => console.log(event.detail.dirty));
  // editor.get_markdown(); editor.set_markdown(source); editor.destroy();
</script>
```

The editor loads `sohjae_editor.wasm` by default and does not require the renderer WASM.

## Optional collaboration

The standalone editor WASM contains no collaboration ABI or CRDT. Add the collaboration SDK only when needed. When deploying the optional SDK archive, merge its contents into the same SDK root while preserving relative paths.

Use `create_editor(container, { replica })` to connect rich, hybrid, Markdown, and source views to a shared document. Omitting `replica` keeps single-user operation. Collaboration provides a character CRDT, stable table/row/column IDs, per-author undo/redo, relative cursor anchors, IME capture, a transport-independent WASM API, and a WebRTC adapter.

STUN/TURN settings belong to the transport configuration. Connecting participants on different devices also requires host-provided authentication and signaling. The same-page example uses local ICE candidates without external servers.

See the [collaboration design](docs/collaboration.md), [API](docs/collaboration_api.md), [rich/source demo](http://127.0.0.1:8080/collab/rich.html), [integration tests](http://127.0.0.1:8080/collab/rich-tests.html), and [IME verification page](http://127.0.0.1:8080/collab/ime.html). Verify the collaboration WASM with `node scripts/check_collab.mjs`.

## Validation and limitations

Sohjae is a development version. The recorded structural comparison against 672 official GFM examples has **585 matches and 87 differences**. Hierarchical lists and block quotes, emphasis delimiters, links, and reference definitions have been improved. This is not a claim of complete GFM conformance. The [GFM report](docs/gfm-conformance.md) documents the resolved cases and remaining differences.

Real macOS Korean two-set IME input was verified in Firefox, including remote insertion during composition in rich and source views. This does not replace mobile-device, other operating-system, or full browser-matrix testing. See [implementation status](docs/implementation_plan.md) and [compatibility](docs/compatibility.md) for the validation boundaries.

## Documentation

The detailed reference documents are currently written in Korean.

| Document | Contents |
| --- | --- |
| [Requirements](docs/requirements.md) | Agreed scope |
| [Formatting and storage](docs/formatting.md) | Normalization, HTML, and paste handling |
| [Architecture](docs/architecture.md) | Implementation and target design |
| [Configuration](docs/configuration.md) | Defaults and precedence |
| [API and ABI](docs/api.md) | Embedding, buffers, errors, and lifecycle |
| [Single-user API guide](docs/single-user-api.md) | Typed integration, settings, commands, and lifecycle |
| [Implementation plan](docs/implementation_plan.md) | Results and remaining work |
| [Validation](docs/validation.md) | GFM, OS input, and mobile testing |
| [Compatibility](docs/compatibility.md) | Syntax and browser coverage |
| [Editor hardening](docs/editor-hardening.md) | Caching, undo grouping, normalization, and accessibility |
| [Handoff record](docs/handoff.md) | Decisions and environment migration |

`tests/` is reserved for local verification and excluded from Git tracking. Official standard fixtures needed by build/audit tools are stored in `spec/`. Rust helper programs live in `tools/`; their Cargo example names and commands are preserved.

## Optional collaboration and div rendering

Enable collaboration with `new Sohjae({ selector: "#editor", plugins: ["collaboration"] })`. Render Markdown inside a div with `new SeojaeRenderer({ selector: "#preview" })` after loading `sohjae-renderer.js`. See [quick start](docs/quick-start.md) for deployment and connection details.
