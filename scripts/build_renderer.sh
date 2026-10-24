#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# Separate target directory prevents the renderer build replacing editor artifacts.
cargo build --offline --release --target wasm32-unknown-unknown --no-default-features --features renderer --lib --target-dir target/renderer
cp target/renderer/wasm32-unknown-unknown/release/sohjae_core.wasm web/sohjae_render.wasm
