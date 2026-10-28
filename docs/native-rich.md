# Source-based rich editing

Rich mode now uses the same source-preserving surface and input pipeline as hybrid mode with syntax revealing disabled for every construct. It no longer installs the native HTML editing controller or serializes browser DOM mutations back into Markdown. `elements.*.reveal_markdown` cannot reveal source in rich mode.

The rendered editing surface retains source-coordinate wrappers internally. The HTML view and standalone renderer continue to export clean semantic HTML. Paragraph commands, tables, IME, undo and collaboration use the shared source-coordinate model.

Run `web/live-preview-tests.html` for current rich-mode policy tests: parity with hybrid configured to keep all syntax rich, source-preserving inline edits, undo, mode switches and empty-paragraph Enter in standalone and shared editors. `web/source-rich-tests.js` and `web/native-rich-tests.html` record the superseded native HTML controller behavior and is not the current rich-mode acceptance suite.
