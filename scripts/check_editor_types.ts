import { create_editor, type Editor, type EditorCommand, type EditorOptions } from '../web/editor.js';
declare const container: HTMLElement;
declare const editor: Editor;
const options: EditorOptions = { markdown: '# Document', wasm_url: new URL('https://example.test/editor.wasm'), mode: 'hybrid', auto_close: { pairs: { bold: false } }, attachments: { max_file_size: 1024 }, keybindings: { 'mod+b': 'bold' } };
const created: Promise<Editor> = create_editor(container, options);
const command: EditorCommand = 'highlight';
const execution: Promise<void> = editor.execute_command(command);
const revision: bigint = editor.get_selection().revision;
editor.set_options({ layout: { css_url: './layout.css' }, mode: 'rich' });
editor.replace('한😀', 0, 0, 7);
editor.addEventListener('change', event => { const revision: bigint = event.detail.revision; const dirty: boolean = event.detail.dirty; void [revision, dirty]; });
editor.addEventListener('error', event => { const error: Error = event.detail; void error; });
editor.addEventListener('save', event => { const markdown: string = event.detail.markdown; void markdown; });
// @ts-expect-error Internal state is not a stable API.
editor.state;
// @ts-expect-error Commands are a closed, documented union.
editor.execute_command('heading_99');
// @ts-expect-error Creation-only settings cannot be replaced at runtime.
editor.set_options({ wasm_url: 'other.wasm' });
// @ts-expect-error Normalization requires a boolean.
editor.get_markdown({ normalize: 'yes' });
// @ts-expect-error Revisions are BigInt, not numbers.
const numberRevision: number = editor.get_selection().revision;
// @ts-expect-error Nested option values retain their types.
create_editor(container, { auto_close: { pairs: { bold: 1 } } });
// @ts-expect-error Events expose their documented detail shape.
editor.addEventListener('change', event => { const text: string = event.detail.dirty; void text; });
void [created, execution, revision, numberRevision];

import type { SohjaeAPI } from '../web/sohjae.js';
declare const classic: SohjaeAPI;
const quick: Promise<Editor> = classic.init({selector:'#editor',mode:'rich'});
classic.init({target:container});
classic.init('#editor');
const mounted: Editor | null = classic.get('editor');
// @ts-expect-error Exactly one target method is required.
classic.init({});
// @ts-expect-error selector and target cannot be combined.
classic.init({selector:'#editor',target:container});
// @ts-expect-error Existing editor options retain their types.
classic.init({selector:'#editor',mode:'invalid'});
void [quick,mounted];

const handle = new classic({selector:'#editor'});
const prepared: Promise<Editor> = handle.ready;
handle.addEventListener('change', event => { const dirty: boolean=event.detail.dirty; void dirty; });
handle.get_markdown();
// @ts-expect-error Constructor keeps selector/target exclusive.
new classic({selector:'#editor',target:container});
// @ts-expect-error ready is read-only.
handle.ready=Promise.resolve(handle);
void prepared;

handle.addEventListener('ready', function () { this.get_markdown(); const ready: Promise<Editor> = this.ready; void ready; });

import '../web/sohjae-renderer.js';
const shared = new classic({selector:'#editor',plugins:['collaboration'],collaboration:{document_id:'0123456789abcdef0123456789abcdef'}});
shared.ready.then(editor=>editor.collaboration?.replica.export_state());
// @ts-expect-error Unknown plugins are rejected.
new classic({selector:'#editor',plugins:['unknown']});
const preview = new SeojaeRenderer({selector:'#preview'});
preview.ready.then(renderer=>renderer.render('**hello**'));
// @ts-expect-error Exactly one target is required.
new SeojaeRenderer({selector:'#preview',target:container});
