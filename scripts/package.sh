#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
sh scripts/build.sh
mkdir -p dist/sohjae
cp web/core.js web/clipboard.js web/editor.js web/editor.css web/sohjae_core.wasm LICENSE dist/sohjae/
mkdir -p dist/sohjae/collab
cp web/collab/core.js web/collab/webrtc.js web/collab/input.js web/collab/editor_core.js dist/sohjae/collab/
cp docs/collaboration_api.md dist/sohjae/collab/API.md
cp docs/collaboration.md dist/sohjae/collab/collaboration.md
cp docs/collaboration_api.md docs/collaboration.md dist/sohjae/
cp docs/api.md dist/sohjae/API.md
cp docs/gfm-conformance.md dist/sohjae/gfm-conformance.md
cp docs/gfm-policy-review.md dist/sohjae/gfm-policy-review.md
cp docs/editor-hardening.md docs/compatibility.md docs/incremental-performance.json dist/sohjae/
COPYFILE_DISABLE=1 tar -czf dist/sohjae-0.1.0.tgz -C dist sohjae

# Independent viewer package; editor consumers keep the existing package layout.
sh scripts/package_renderer.sh
