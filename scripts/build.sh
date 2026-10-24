#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
cargo fmt --check
cargo test --offline --features collaborator
cargo clippy --offline --all-targets --features collaborator -- -D warnings
cargo build --offline --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/sohjae_core.wasm web/sohjae_editor.wasm
# Remove the generated file under its retired distribution name.
rm -f web/sohjae_core.wasm

python3 scripts/audit_gfm.py --check

sh scripts/build_renderer.sh
sh scripts/build_collaborator.sh
cargo clippy --offline --no-default-features --features renderer --lib -- -D warnings

# Uses the actual independent WASM if Node is available.
if command -v node >/dev/null 2>&1; then
  node --check web/sohjae.js
  node --check web/sohjae-renderer.js
  node scripts/check_renderer.mjs
  node scripts/check_api_contracts.mjs
  node scripts/check_collab_contracts.mjs
  if command -v tsc >/dev/null 2>&1; then
    tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler scripts/check_editor_types.ts scripts/check_collab_types.ts
  fi
fi

python3 scripts/build_examples.py
if command -v node >/dev/null 2>&1; then
  node scripts/check_examples.mjs
fi
cargo clippy --offline --no-default-features --features collaborator --lib -- -D warnings
