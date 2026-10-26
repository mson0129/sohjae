//! Stateless renderer-only ABI. Output is raw UTF-8, copied before the next call.
use std::cell::RefCell;

const MAX_INPUT: usize = 32 * 1024 * 1024;
#[derive(Default)]
struct Runtime {
    input: Vec<u8>,
    output: Vec<u8>,
    reserved: bool,
}
thread_local! { static RUNTIME: RefCell<Runtime> = RefCell::new(Runtime::default()); }

#[no_mangle]
pub extern "C" fn renderer_abi_version() -> u32 {
    1
}

#[no_mangle]
pub extern "C" fn renderer_reserve_input(length: u32) -> *mut u8 {
    RUNTIME.with(|runtime| {
        let mut runtime = runtime.borrow_mut();
        runtime.reserved = length as usize <= MAX_INPUT;
        if !runtime.reserved {
            runtime.input.clear();
            return std::ptr::null_mut();
        }
        runtime.input.resize(length as usize, 0);
        runtime.input.as_mut_ptr()
    })
}

/// Status 0: HTML output. Status 1: UTF-8 error text. No edit sessions are created.
#[no_mangle]
pub extern "C" fn renderer_render() -> u32 {
    RUNTIME.with(|runtime| {
        let mut runtime = runtime.borrow_mut();
        let result = if !runtime.reserved {
            Err("Reserve input before rendering")
        } else {
            std::str::from_utf8(&runtime.input)
                .map(|source| {
                    let source = source.replace("\r\n", "\n").replace('\r', "\n");
                    crate::markdown::render_viewer(&source)
                })
                .map_err(|_| "Input must be UTF-8")
        };
        runtime.reserved = false;
        match result {
            Ok(html) => {
                runtime.output = html.into_bytes();
                0
            }
            Err(message) => {
                runtime.output = message.as_bytes().to_vec();
                1
            }
        }
    })
}

#[no_mangle]
pub extern "C" fn renderer_output_pointer() -> *const u8 {
    RUNTIME.with(|runtime| runtime.borrow().output.as_ptr())
}
#[no_mangle]
pub extern "C" fn renderer_output_length() -> u32 {
    RUNTIME.with(|runtime| runtime.borrow().output.len() as u32)
}
