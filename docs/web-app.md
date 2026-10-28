# Browser Markdown workspace

The GitHub Pages root is a Sohjae application with a full-height splash and **Start editing** entry point. The existing renderer, editor and collaboration examples remain available at their original subpaths.

## Documents and folders

The left **웹 브라우저 저장소** section persists a versioned hierarchy under `sohjae.workspace.v1` in LocalStorage. The plus menu creates root folders/documents; a folder menu creates children. New items immediately enter inline naming. Folder disclosure, names, content, ordering, active document, editor mode, layout and scroll-sync preference survive reloads.

Each item's menu provides rename and delete. Folder deletion requires confirmation and recursively removes descendants. Document removal selects another remaining document, or shows an empty-workspace state. Names are rendered as text rather than HTML.

Drag a row to the top/bottom of another row to reorder it. Drop in a folder's middle to move into that folder; **최상위로 이동** moves to root. The drop indicator spans the entire sidebar row. Moving a folder retains descendants and cannot create cycles. Alt+Up/Down also reorders siblings.

Content changes autosave after 250 ms and flush when switching documents, layouts, creating an item or leaving the page. Storage failures and changes from another tab stop overwriting and display a notice. The current document can be downloaded using the sidebar's down-arrow button. Storage is per browser and origin; it is not a cloud backup.

## Three layouts

1. Full editor: rich, hybrid (default), or styled Markdown mode.
2. Styled Markdown editor and semantic renderer preview.
3. Plain source editor and semantic renderer preview.

The same editor instance survives layout changes, preserving its current document and undo state. Document switching starts that document's editing session.

## Preview outline and synchronized scrolling

The preview has a sticky outline on the right. H1–H6 entries indent by heading depth (12 px per level), update as content changes, highlight the current section and scroll to the chosen heading. Existing heading IDs are preserved; missing or duplicate IDs receive unique targets.

**동시 스크롤** enables/disables bidirectional proportional scroll synchronization in either split layout. It synchronizes normalized scroll positions, not exact source-to-preview line alignment. Programmatic scroll events are suppressed to prevent feedback loops. The setting persists across reloads. With the setting disabled, either pane scrolls independently, including outline navigation.

## Build and validate

Sources: `web/app/`. `python3 scripts/build_examples.py` copies the application into `examples/` and resolves SDK/renderer assets relative to the Pages project root. Local development: `http://127.0.0.1:8080/app/` with `scripts/serve.py`; the Pages artifact is `examples/`.

Run `node scripts/check_workspace.mjs` and `node scripts/check_examples.mjs`. Verify actual browser flows for create/rename, recursive deletion/cancellation, dragging between folders, reload restoration, all layouts, H1–H6 outline indentation, outline navigation, and scroll sync on/off in both directions.

## Save and import Markdown files

The sidebar download button, Ctrl/Cmd+S and the editor's Markdown Save command use the current document name. Renaming or switching documents updates the editor filename; `.md` is added only when missing (case-insensitive).

Drop one or more UTF-8 `.md` files anywhere in the browser window to add documents. Dropping on a folder imports into that folder; other locations import at root. The final imported document opens automatically. File names and source text are preserved, and duplicate names create separate documents rather than overwrite existing content. Dropping from the splash opens the workspace first. Non-Markdown attachments dropped directly in the editor retain its normal attachment handling.

Run `node scripts/check_workspace.mjs` for filename and import model checks. `/app/file-import-tests.html` runs isolated browser integration checks with a dedicated temporary LocalStorage key: splash/multiple-file drop, folder-target drop, rename plus Ctrl/Cmd+S/toolbar/sidebar save filename consistency. Existing workspace data is not used by these tests.
