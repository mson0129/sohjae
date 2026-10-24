#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
sh scripts/build_collaborator.sh
mkdir -p dist/sohjae-collaborator/collab
cp web/core.js web/sohjae_collaborator.wasm LICENSE dist/sohjae-collaborator/
cp web/collab/core.js web/collab/core.d.ts web/collab/webrtc.js web/collab/webrtc.d.ts web/collab/input.js web/collab/editor_core.js dist/sohjae-collaborator/collab/
cp docs/collaboration_api.md dist/sohjae-collaborator/API.md
cp docs/api.md dist/sohjae-collaborator/Editor-API.md
cp docs/collaboration-protocol.md docs/collaboration_api.md docs/collaboration.md dist/sohjae-collaborator/
# Use a distinct name on case-insensitive filesystems; preserve each SDK API.md.
for document in api-stability configuration single-user-api quick-start; do
  sed 's/](api.md)/](Editor-API.md)/g' "docs/$document.md" > "dist/sohjae-collaborator/$document.md"
done
COPYFILE_DISABLE=1 tar -czf dist/sohjae-collaborator-0.1.0.tgz -C dist sohjae-collaborator
