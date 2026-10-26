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
