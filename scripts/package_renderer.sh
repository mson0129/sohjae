#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
sh scripts/build_renderer.sh
mkdir -p dist/sohjae-renderer
rm -f dist/sohjae-renderer/sohjae_renderer.wasm
cp web/sohjae-renderer.js web/sohjae-renderer.d.ts web/renderer-quick-start.html web/renderer.js web/renderer.css web/sohjae_render.wasm LICENSE dist/sohjae-renderer/
cp docs/renderer.md dist/sohjae-renderer/API.md
cp docs/gfm-conformance.md dist/sohjae-renderer/gfm-conformance.md
cp docs/gfm-policy-review.md dist/sohjae-renderer/gfm-policy-review.md
cp docs/editor-hardening.md docs/compatibility.md docs/incremental-performance.json dist/sohjae-renderer/
cp docs/api.md dist/sohjae-renderer/Editor-API.md
cp docs/collaboration-protocol.md docs/collaboration_api.md docs/collaboration.md dist/sohjae-renderer/
# Use a distinct name on case-insensitive filesystems; preserve each SDK API.md.
for document in api-stability configuration single-user-api quick-start; do
  sed 's/](api.md)/](Editor-API.md)/g' "docs/$document.md" > "dist/sohjae-renderer/$document.md"
done
COPYFILE_DISABLE=1 tar -czf dist/sohjae-renderer-0.1.0.tgz -C dist sohjae-renderer
