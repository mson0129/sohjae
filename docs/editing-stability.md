# Editing stability

The editor keeps its authoritative selection in UTF-8 source byte offsets. Rich, hybrid and Markdown views share this source model; a hybrid region only selects the rich or literal editing policy.

## 1. Presentation is not an edit

Rendering, revealing syntax and restoring selection must preserve the source, logical anchor/focus and undo/redo availability. Moving into a rendered inline element resolves its semantic boundary when capturing a user selection, rather than moving the logical cursor during rendering. Malformed delimiters remain editable source.

## 2. One coordinate mapping layer

`web/source-map.js` owns DOM-to-source, source-to-DOM, visual projection and selection restoration. Raw text uses UTF-16 DOM offsets and UTF-8 source offsets with explicit conversion. A source-aware projection cache retains logical positions that have no visible equivalent, including hidden delimiters and block separators. Empty cells are resolved before nearby text; decorative break marks and controls are not editable text.

Exact round trips are tested at raw code-point boundaries, including Korean, emoji, combining marks, entities and blank lines. Hidden rich syntax cannot have a bijective visual representation; its logical position is retained independently of the projected DOM caret. Reverse selections retain anchor/focus direction.

## 3. Collaboration commits exact source or keeps a local draft

The additive collaboration command 33 (`preview_replace_markdown`) evaluates replacement on a cloned replica. It changes neither the live replica nor events, history or exported state. Literal edits publish only when the projected result equals the requested source. Incomplete input remains a local draft with local undo/redo; completing it commits the accumulated change once.

Remote changes preserve a pending draft and flag its conflict. They never overwrite its text. Non-conflicting drafts can explicitly accept normalization through `editor.commit_pending_draft()` or **정규화 후 초안 공유**. Conflicting drafts reject that operation; save the draft and compare with the shared source, or explicitly discard it. A normalization-only commit creates no fake shared undo entry.

Ship matching JS and WASM artifacts: older collaboration WASM without command 33 raises `UnsupportedFeature`. The wire protocol and document schema are unchanged. Preview clones and evaluates a replica before a literal edit; performance on large documents still needs measurement.

## 4. Verify behavior beyond final strings

`/live-preview-tests.html` checks source, logical selection, rendering invariants, raw Unicode round trips, mode-specific deletion, local draft undo/redo, publication and remote conflicts. `scripts/check_collab_contracts.mjs` checks the read-only preview contract against the real WASM.

`/stability.html` is a disposable native-keyboard fixture with two connected editors, mode/case selectors, a remote edit button and source/caret diagnostics. Verify Backspace → follow-up typing → undo, incomplete table input → completion → peer synchronization, and repeated display restoration. It uses real MessageChannel transport in the same-page mode.

Real OS IME composition, Firefox/Safari and mobile devices remain separate validation work. Synthetic composition events are regression coverage, not proof of an actual input method.

## Inline boundaries and rich deletion requirements

For `ma**rkdo**wn`, the outer boundaries are after `a` and before `w`.

| Presentation and action | Before the inline element | After the inline element |
| --- | --- | --- |
| Rich: Left / Backspace | Previous visible character (`m` boundary) | Last content character inside the element |
| Source: Left / Backspace | Previous source character (`m` boundary) | Closing delimiter, one source character at a time |
| Rich: Right / Delete | First content character inside the element | Next visible character (`n` boundary) |
| Source: Right / Delete | Opening delimiter, one source character at a time | Next source character (`n` boundary) |

Arrow keys move; Backspace/Delete remove the respective character and leave the caret at the deletion boundary. For example, rich Backspace after the inline element yields `ma**rkd**wn`; source Backspace yields `ma**rkdo*wn`. Rich Delete before it yields `ma**kdo**wn`; source Delete yields `ma*rkdo**wn`. Empty inline constructs are removed with their delimiters. Source presentation retains malformed delimiters for continued editing.

In rich presentation, task markers are atomic: Backspace immediately after a checkbox removes `[ ]`/`[x]` and its separating space, retaining the list item and label. Hidden source punctuation must not become visible through partial deletion.

Deleting across the boundary of a block other than `h1`–`h6` or `p` requires a modal confirmation with **예** and **취소**. Cancellation changes neither source nor history. Confirmation deletes the entire block; if the shared source changed while the dialog was open, deletion is rejected and the user must check the block again. Editing text inside a block remains normal character editing. Hybrid uses source deletion for revealed regions and rich deletion for rich regions.

## Scoped hybrid source presentation

Hybrid reveals the inline syntax element approached by the caret, rather than the entire paragraph. Sibling inline elements retain their rich presentation. Leaving the source range restores that element's rich presentation without changing source, selection or history. For nested inline elements, the innermost eligible element is revealed. Lists, tables and fenced code retain structural source presentation. Constructor `elements[kind].reveal_markdown` overrides remain authoritative.

If editing breaks the delimiters, the active source range remains an inline source island until the caret leaves it. Partial extraction removes obsolete empty coordinate wrappers so selection restoration cannot choose a deleted DOM text segment. Plain paragraphs retain literal typing without displaying additional source decorations.
