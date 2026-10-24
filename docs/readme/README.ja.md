# Sohjae

[English](../../README.md) | [Español](README.es.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

Rust/WASM、Rust標準ライブラリ、ブラウザー標準APIで実装した、他のプロジェクトに組み込めるMarkdownエディター・レンダラーです。外部crate、JavaScriptパッケージ、エディターフレームワークは不要です。[MITライセンス](../../LICENSE)。

レンダラーと単独編集エディターの公開APIは[API v1の安定性・互換性ポリシー](../api-stability.md)に従います。共同編集は[API v2・プロトコルの安定契約](../collaboration-protocol.md)に従い、文書交換の前にバージョンとスキーマを確認します。

## クイックスタート

エディターSDKフォルダーを配信し、スクリプトを1つ読み込みます。CSS・WASM・内部モジュールはスクリプトの配置先から自動で読み込みます。

```html
<script src="./sohjae/sohjae.js"></script>
<textarea id="editor" name="markdown"># Hello, Sohjae!</textarea>
<script>new Sohjae({ selector: '#editor' });</script>
```

[クイックスタートガイド](../quick-start.md) · [実行サンプル](http://127.0.0.1:8080/quick-start.html)。textareaの値はフォームと同期され、divも指定できます。

## すぐに使えるサンプル

| サンプル | WASMモジュール |
| --- | --- |
| [Markdownレンダラー](../../examples/sohjae_renderer/index.html) | `sohjae_render.wasm` |
| [Markdownエディター](../../examples/sohjae_editor/index.html) | `sohjae_editor.wasm` |
| [共同編集エディター](../../examples/sohjae_collaborator/index.html) | `sohjae_editor.wasm` + 必要に応じて `sohjae_collaborator.wasm` |

各フォルダーには`index.html`、JavaScript、CSS、WASMバイナリー、ローカルファイル用の補助ファイルが含まれます。フォルダー内のファイルは一緒に保存してください。HTTPでは同じフォルダーのWASMを読み込み、`file://`では同一のバイナリーを含む補助ファイルを使用します。サンプルの起動にビルドツールは不要です。ブラウザー自動操作では`file://`が制限されるため、ローカルファイルの直接起動は一連の動作を検証できていません。ブラウザーがローカルスクリプトを制限する場合は、ローカルHTTPサーバーを使用してください。

```sh
python3 scripts/serve_examples.py --port 8081
```

[レンダラー](http://127.0.0.1:8081/sohjae_renderer/index.html)、[エディター](http://127.0.0.1:8081/sohjae_editor/index.html)、[共同編集エディター](http://127.0.0.1:8081/sohjae_collaborator/index.html)を開きます。[サンプルガイド](../../examples/README.md)も参照してください。

## 機能

- リッチ・ハイブリッド・Markdownモード、全文ソース表示、要素別の構文表示設定。
- ハイライト（`==text==`）、定義リスト、独自の見出しID、基本的なコードの色分け。上付き・下付き文字の拡張構文は対象外です。
- 書式ツール、元に戻す・やり直す、韓国語IMEの変換処理、UTF-8/UTF-16の選択位置変換。
- 表内の移動、行・列の追加と削除、配置、複数選択、ハンドルのドラッグによる行・列の並べ替え。
- 対応するHTML構造の貼り付け変換、画像・ファイルのBase64埋め込み、ダウンロード。
- Front Matter、CSSレイアウト、閲覧・読み取り専用表示、キーボードコマンドパレット。
- 元のMarkdownを保持する編集と、対応構文の正規化エクスポート。

## ビルドと起動

RustとPython 3をインストールしてください。Node.jsはWASMの検証と計測に使用します。

```sh
rustup target add wasm32-unknown-unknown
sh scripts/build.sh
python3 scripts/serve.py --port 8080
```

- [エディター](http://127.0.0.1:8080/)、[レンダラー](http://127.0.0.1:8080/renderer.html)、[拡張構文](http://127.0.0.1:8080/extended.html)（[原文](../../web/extended.md)）。
- [ブラウザーテスト](http://127.0.0.1:8080/tests.html)、[GFM検査](http://127.0.0.1:8080/gfm-audit.html)。
- エディターWASMの検証：`node scripts/check_wasm.mjs`。
- 3種類のSDKアーカイブの生成：`sh scripts/package.sh`。

レンダラーSDKは`renderer.js`と`sohjae_render.wasm`を使用し、編集・履歴・CRDT・WebRTCのコードを含みません。個別に生成する場合は`sh scripts/package_renderer.sh`を実行します。[レンダラーAPI](../../docs/renderer.md)を参照してください。

## エディターの組み込み

ビルドした`web/`のJavaScriptモジュール、CSS、WASMを、相対パスを維持して配信してください。各エディターはShadow DOMを使用し、ホストページのスタイルから分離します。

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

エディターは既定で`sohjae_editor.wasm`を読み込みます。レンダラーWASMは不要です。

## 任意の共同編集機能

単独編集用WASMには共同編集ABIやCRDTを含みません。共同編集SDKは必要な場合だけ追加します。追加SDKのアーカイブを配信するときは、相対パスを維持して同じSDKルートに内容を配置してください。

`create_editor(container, { replica })`を使うと、リッチ・ハイブリッド・Markdown・ソース表示を共有文書に接続できます。`replica`を省略すると単独編集になります。共同編集は、文字CRDT、表・行・列の安定したID、編集者別の履歴操作、相対カーソルアンカー、IME状態の捕捉、転送方式に依存しないWASM API、WebRTCアダプターを提供します。

STUN/TURN設定は転送設定に渡します。異なる端末の参加者を接続するには、ホスト側の認証とシグナリングも必要です。同一ページのサンプルは外部サーバーを使わず、ローカルICE候補で接続します。

[共同編集設計](../../docs/collaboration.md)、[API](../../docs/collaboration_api.md)、[リッチ・ソース表示デモ](http://127.0.0.1:8080/collab/rich.html)、[統合テスト](http://127.0.0.1:8080/collab/rich-tests.html)、[IME検証ページ](http://127.0.0.1:8080/collab/ime.html)を参照してください。共同編集WASMは`node scripts/check_collab.mjs`で検証できます。

## 検証状況と制限

Sohjaeは開発版です。公式GFMの672例との構造比較では、**585例が一致、87例が不一致**です。階層的なリストと引用、強調の区切り文字、リンク、参照定義の処理を改善しました。GFMへの完全準拠を意味するものではありません。[GFM報告](../../docs/gfm-conformance.md)に解決済みの例と残る差異を記録しています。

macOSの韓国語2ボル式IMEはFirefoxで実際の入力を検証し、リッチ・ソース表示での変換中のリモート挿入も確認しました。モバイル実機、他のOS、すべての対象ブラウザーの検証を代替するものではありません。検証範囲は[実装状況](../../docs/implementation_plan.md)と[互換性](../../docs/compatibility.md)を参照してください。

## ドキュメント

詳細なリファレンスは現在、韓国語で記載されています。

| 文書 | 内容 |
| --- | --- |
| [要件](../../docs/requirements.md) | 合意した対象範囲 |
| [書式と保存規則](../../docs/formatting.md) | 正規化、HTML、貼り付け |
| [アーキテクチャ](../../docs/architecture.md) | 現在の実装と目標設計 |
| [設定](../../docs/configuration.md) | 既定値と優先順位 |
| [APIとABI](../../docs/api.md) | 組み込み、バッファー、エラー、ライフサイクル |
| [単独編集APIガイド](../single-user-api.md) | 型付きの組み込み、設定、コマンド、ライフサイクル |
| [実装計画](../../docs/implementation_plan.md) | 検証結果と残作業 |
| [検証記録](../../docs/validation.md) | GFM、OS入力、モバイル検証 |
| [互換性](../../docs/compatibility.md) | 対応構文とブラウザー範囲 |
| [エディター改善記録](../../docs/editor-hardening.md) | キャッシュ、履歴のグループ化、正規化、アクセシビリティ |
| [引き継ぎ記録](../../docs/handoff.md) | 決定事項と環境移行 |

`tests/`はローカル検証用で、Gitの追跡対象から除外しています。ビルド・構文検査に必要な公式標準データは`spec/`に保存します。Rust補助ツールは`tools/`に配置し、Cargo exampleの名前と実行コマンドは維持しています。

## 共同編集プラグインと div の描画

`new Sohjae({ selector: "#editor", plugins: ["collaboration"] })` で共同編集を有効にします。`sohjae-renderer.js` を読み込み、`new SeojaeRenderer({ selector: "#preview" })` で div 内の Markdown を変換します。配布と接続の詳細は[クイックスタート](../quick-start.md)を参照してください。
