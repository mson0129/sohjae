# Native rich editing

`mode: 'rich'` edits semantic HTML through the browser's contenteditable input path. Hybrid, Markdown and source views retain the source-preserving editing path. Rich mode does not reveal Markdown delimiters around the caret.

The rich surface unwraps source-coordinate sections and text spans. Text positions are held in a private DOM/source map; semantic elements retain internal metadata for toolbar and table commands. Exported HTML contains neither coordinate metadata nor editing controls.

## Markdown schema

Supported semantic elements include paragraphs, headings, strong/emphasis, deletion, highlight, inline/fenced code, links, images, breaks, lists/tasks, blockquotes, tables, definitions and disclosure blocks. Pasted styles and arbitrary attributes are removed. Unsupported wrappers are unwrapped; executable content is dropped. Rich editing may normalize or lose unsupported source syntax. Use hybrid or source mode when lexical preservation is required.

Tables use `thead > tr > th` and `tbody > tr > td`. Nested tables, merged cells, cross-cell deletion and block structures inside cells are rejected. Enter inside a cell inserts a line break. Table structure changes use the table tools.

## Synchronization

The editor serializes the changed DOM and compares it with a canonical baseline. Only the changed source range is applied to the existing text CRDT, rather than replacing the entire document. Composition uses stable CRDT capture positions. If the source changed during an ordinary native input transaction, the editor preserves that input as a local draft and renders the current shared document. `get_pending_draft()` and `discard_pending_draft()` expose that recovery state.

This remains a text CRDT, not a semantic tree CRDT. Concurrent edits to the same Markdown delimiters or structural boundaries can still yield an unintended Markdown structure even when replicas converge. Native rich editing does not guarantee preservation of simultaneous structural intent. Network WebRTC connectivity still depends on signaling and suitable STUN/TURN configuration.

## Validation

`web/native-rich-tests.html` exercises native DOM edits, paragraph splitting/merging, inline formatting, heading Enter, table guards, source mapping, shared cell edits, concurrent composition and draft recovery. Existing source-coordinate tests run on hybrid/source views. Actual browser keyboard checks additionally cover heading Enter followed by typing into the new paragraph.

## Paragraph Enter

Rich and hybrid paragraph/heading input uses the same source insertion policy: no text before the caret inserts `&nbsp;\n\n`; text before and none after inserts `\n\n&nbsp;`; text on both sides inserts `\n\n`. Inline delimiters are kept outside paragraph boundaries, reopening a split format when necessary. Existing table-cell, code-block and list structural Enter behavior is retained. Selection replacement and IME composition retain their own input paths.

## Block conversion control

Rich/hybrid mode shows an external icon dropdown at the hovered top-level block's upper left. It converts between h1–h6, paragraph, fenced code, blockquote and details. Table/list interiors are excluded. Body content is retained; leaving code discards its language, leaving an alert discards the alert category, and leaving details discards its summary. New details blocks use the summary “제목”. Conversion to code keeps visible text and removes inline styling. The operation uses one source replacement with existing history/CRDT synchronization. A menu selection captured before a remote source change is rejected instead of applying stale offsets. Controls are excluded from editable content and HTML export.

Empty rich paragraphs retain a UI-only BR to provide a native caret line. Element-offset selections on that paragraph or its placeholder resolve directly to the paragraph's original source range. IME capture replaces that placeholder entity range, rather than inserting at a serializer fallback position. The same captured range is used with shared CRDT composition so remote changes do not move the local text to the document end.

When paragraph Enter inserts `&nbsp;\n\n` before the caret, the caret advances by the inserted UTF-8 length and follows the original paragraph downward. Repeated Enter in an existing NBSP paragraph therefore leaves the caret in the final empty paragraph immediately before the following content, rather than in the newly inserted paragraph above it.

Rich table horizontal arrow navigation is handled by the native contenteditable surface. The source-based `cell_arrow` handler is reserved for the non-native surface: raw source cell edges do not describe wrapped visual lines or inline formatting. Arrow keys in rich mode do not invoke row insertion or `exit_table` document mutations. Tab retains the explicit next-cell/new-row behavior.

Rich table Up/Down preserve the current column when crossing a cell boundary. Within multiline or wrapped cells, native visual-line movement runs first; at the first/last visual line the editor moves to the adjacent row in the same column. At the outer table edge it keeps the caret in place without inserting rows or paragraphs.
