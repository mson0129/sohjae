#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
sh scripts/build.sh
mkdir -p dist/sohjae
rm -f dist/sohjae/sohjae_core.wasm
cp web/sohjae.js web/sohjae.d.ts web/quick-start.html web/core.js web/clipboard.js web/html.js web/rich-dom.js web/source-map.js web/editor.js web/editor.d.ts web/editor.css web/sohjae_editor.wasm LICENSE dist/sohjae/
# Collaboration ships as an optional overlay, not part of the base editor SDK.
rm -rf dist/sohjae/collab
mkdir -p dist/sohjae/collab
cp web/collab/core.d.ts web/collab/webrtc.d.ts dist/sohjae/collab/
rm -f dist/sohjae/sohjae_collaborator.wasm
cp docs/collaboration_api.md docs/collaboration.md dist/sohjae/
cp docs/session-storage.md docs/local-storage.md docs/editing-modes.md dist/sohjae/
cp docs/api.md dist/sohjae/API.md
cp docs/gfm-conformance.md dist/sohjae/gfm-conformance.md
cp docs/gfm-policy-review.md dist/sohjae/gfm-policy-review.md
cp docs/editor-hardening.md docs/compatibility.md docs/incremental-performance.json dist/sohjae/
cp docs/api.md dist/sohjae/Editor-API.md
cp docs/collaboration-protocol.md docs/collaboration_api.md docs/collaboration.md dist/sohjae/
# Use a distinct name on case-insensitive filesystems; preserve each SDK API.md.
for document in api-stability configuration single-user-api quick-start; do
  sed 's/](api.md)/](Editor-API.md)/g' "docs/$document.md" > "dist/sohjae/$document.md"
done
COPYFILE_DISABLE=1 tar -czf dist/sohjae-0.1.0.tgz -C dist sohjae

# Independent viewer package; editor consumers keep the existing package layout.
sh scripts/package_renderer.sh

sh scripts/package_collaborator.sh
