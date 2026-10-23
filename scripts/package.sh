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
tar -czf dist/sohjae-0.1.0.tgz -C dist sohjae
