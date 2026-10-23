#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
cargo fmt --check
cargo test --offline
cargo clippy --offline --all-targets -- -D warnings
cargo build --offline --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/sohjae_core.wasm web/sohjae_core.wasm

python3 scripts/audit_gfm.py --check
