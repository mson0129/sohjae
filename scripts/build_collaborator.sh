#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
cargo build --offline --release --target wasm32-unknown-unknown --no-default-features --features collaborator --lib --target-dir target/collaborator
cp target/collaborator/wasm32-unknown-unknown/release/sohjae_core.wasm web/sohjae_collaborator.wasm
