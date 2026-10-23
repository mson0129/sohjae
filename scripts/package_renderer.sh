#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
sh scripts/build_renderer.sh
mkdir -p dist/sohjae-renderer
cp web/renderer.js web/renderer.css web/sohjae_renderer.wasm LICENSE dist/sohjae-renderer/
cp docs/renderer.md dist/sohjae-renderer/API.md
cp docs/gfm-conformance.md dist/sohjae-renderer/gfm-conformance.md
cp docs/gfm-policy-review.md dist/sohjae-renderer/gfm-policy-review.md
cp docs/editor-hardening.md docs/compatibility.md docs/incremental-performance.json dist/sohjae-renderer/
COPYFILE_DISABLE=1 tar -czf dist/sohjae-renderer-0.1.0.tgz -C dist sohjae-renderer
