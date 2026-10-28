# Browser Markdown workspace

The GitHub Pages root is a Sohjae application with a full-height splash and **Start editing** entry point. The existing renderer, editor and collaboration examples remain available at their original subpaths.

## Documents and folders

The left **웹 브라우저 저장소** section persists a versioned hierarchy under `sohjae.workspace.v1` in LocalStorage. The plus menu creates root folders/documents; a folder menu creates children. New items immediately enter inline naming. Folder disclosure, names, content, ordering, active document, editor mode, layout and scroll-sync preference survive reloads.

Each item's menu provides rename and delete. Folder deletion requires confirmation and recursively removes descendants. Document removal selects another remaining document, or shows an empty-workspace state. Names are rendered as text rather than HTML.

Drag a row to the top/bottom of another row to reorder it. Drop in a folder's middle to move into that folder; dropping into blank space in the document tree moves to root. The drop indicator spans the entire sidebar row. Moving a folder retains descendants and cannot create cycles. Alt+Up/Down also reorders siblings.

Content changes autosave after 250 ms and flush when switching documents, layouts, creating an item or leaving the page. Storage failures display a notice; changes from another tab merge automatically. Documents can be downloaded from their item menus. Storage is per browser and origin; it is not a cloud backup.

## Four layouts

1. Full editor: rich, hybrid (default), or styled Markdown mode.
2. Styled Markdown editor and semantic renderer preview.
3. Plain source editor and semantic renderer preview.
4. Reading: renderer-only document with a right-hand outline and ten selectable themes.

The same editor instance survives layout changes, preserving its current document and undo state. Document switching starts that document's editing session.

## Preview outline and synchronized scrolling

The preview has a sticky outline on the right. H1–H6 entries indent by heading depth (12 px per level), update as content changes, highlight every heading currently visible in the preview viewport and scroll to the chosen heading. Existing heading IDs are preserved; missing or duplicate IDs receive unique targets.

**동시 스크롤** enables/disables bidirectional proportional scroll synchronization in either split layout. It synchronizes normalized scroll positions, not exact source-to-preview line alignment. Programmatic scroll events are suppressed to prevent feedback loops. The setting persists across reloads. With the setting disabled, either pane scrolls independently, including outline navigation.

## Build and validate

Sources: `web/app/`. `python3 scripts/build_examples.py` copies the application into `examples/` and resolves SDK/renderer assets relative to the Pages project root. Local development: `http://127.0.0.1:8080/app/` with `scripts/serve.py`; the Pages artifact is `examples/`.

Run `node scripts/check_workspace.mjs` and `node scripts/check_examples.mjs`. Verify actual browser flows for create/rename, recursive deletion/cancellation, dragging between folders, reload restoration, all layouts, H1–H6 outline indentation, outline navigation, and scroll sync on/off in both directions.

## Save and import Markdown files

Ctrl/Cmd+S and the editor's Markdown Save command use the current document name; each document menu also provides Download. Renaming or switching documents updates the editor filename; `.md` is added only when missing (case-insensitive).

Drop one or more UTF-8 `.md` files anywhere in the browser window to add documents. Dropping on a folder imports into that folder; other locations import at root. The final imported document opens automatically. File names and source text are preserved, and duplicate names create separate documents rather than overwrite existing content. Dropping from the splash opens the workspace first. Non-Markdown attachments dropped directly in the editor retain its normal attachment handling.

Run `node scripts/check_workspace.mjs` for filename and import model checks. `/app/file-import-tests.html` runs isolated browser integration checks with a dedicated temporary LocalStorage key: splash/multiple-file drop, folder-target drop, rename plus Ctrl/Cmd+S/toolbar save filename consistency. Existing workspace data is not used by these tests.


## Automatic same-browser collaboration

Opening the app in multiple tabs or windows of the same browser profile and origin automatically joins one browser workspace. No room, invitation, STUN/TURN or server configuration is required. BroadcastChannel delivers updates, with LocalStorage events as a fallback. Different browser profiles, private/normal sessions and different origins remain separate; this does not connect other devices.

Document bodies use the existing Sohjae collaboration WASM and CRDT, including stable source selection and local undo. LocalStorage saves the collaboration state as well as the projected Markdown so reloads preserve operation identity. Legacy documents are seeded deterministically once; they do not duplicate on a second tab. Folder/document metadata uses per-field Lamport registers, deterministic ordering and deletion tombstones. Concurrent edits of different fields survive; concurrent edits of the same metadata field resolve deterministically. Invalid folder cycles are recovered to root.

Each tab retains its own active document, layout and editor mode while other tabs' content and document-list updates appear automatically. Source drafts that cannot yet be represented by the shared model remain local until completed, as in the collaboration editor. This is browser-local collaboration, not a remote collaboration service.

Validation: `node scripts/check_browser_sync.mjs` covers concurrent CRDT input, metadata merging, inactive imported documents, deletion races and reload restoration. `/app/sync-tests.html` checks two independent browsing contexts, simultaneous input, selection independence, inactive updates, local undo and reload. Actual separate tabs were also checked with native keyboard input.


## Dark appearance and reading themes

The header appearance button switches the whole application and editor between light and dark. Reading mode has its own palette selector: Ivory, Dark Orange, White Paper, Midnight Blue, Forest, Sage, Rose, Ocean, Purple Ink and Sepia. Themes style the reading background, text, links, quotes, code, tables and outline without editing Markdown. Appearance and reading palette are separate choices.

All visible H1–H6 headings highlight together in the outline; headings outside the preview viewport are not highlighted. The same behavior applies in split and reading layouts. Each tab retains view preferences in SessionStorage for its own reload; the workspace also stores defaults for new tabs.

The document library footer controls have been removed. Download is available in each document's right-click/ellipsis menu and via Ctrl/Cmd+S. Dropping a row in blank tree space moves it to root.

## Printing

Browser printing uses `@media print` to output only a semantic copy of the active document. `beforeprint` refreshes that copy from the current source, including edits in full, split, source or reading layouts; `afterprint` clears the temporary copy. The workspace, sidebar, toolbar, outline, notices, dialogs and splash are excluded. Printing does not switch layouts or change source/history. Scroll height limits are removed, tables can repeat their headers, and code wraps to fit the page. All application/reading themes print on white paper with dark text.
