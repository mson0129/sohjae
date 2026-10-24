//! Dependency-free Markdown editing core, source-preserving parser, and raw WASM ABI.

#[cfg(any(
    all(
        feature = "renderer",
        any(feature = "editor", feature = "collaborator")
    ),
    all(target_arch = "wasm32", feature = "editor", feature = "collaborator")
))]
compile_error!("Build editor, renderer and collaborator WASMs separately with exclusive features");

#[cfg(feature = "editor")]
pub mod abi;
#[cfg(feature = "editor")]
pub mod editor;
pub mod markdown;
pub mod position;

#[cfg(feature = "collaborator")]
pub mod collab;

mod syntax;

mod entities;

#[cfg(feature = "renderer")]
pub mod renderer;
