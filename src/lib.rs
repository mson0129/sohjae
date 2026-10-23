//! Dependency-free Markdown editing core, source-preserving parser, and raw WASM ABI.

#[cfg(all(feature = "editor", feature = "renderer"))]
compile_error!(
    "Build editor and renderer separately; use --no-default-features --features renderer"
);

#[cfg(feature = "editor")]
pub mod abi;
#[cfg(feature = "editor")]
pub mod editor;
pub mod markdown;
pub mod position;

#[cfg(feature = "editor")]
pub mod collab;

mod syntax;

mod entities;

#[cfg(feature = "renderer")]
pub mod renderer;
