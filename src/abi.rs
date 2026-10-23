//! ABI v1. Requests use the owned input buffer; replies are length-prefixed UTF-8.
//! Every exported operation is synchronous; no views survive an exported call.
use crate::editor::{Editor, Selection};
use crate::markdown;
use std::cell::RefCell;
use std::collections::HashMap;

const MAX_INPUT: usize = 32 * 1024 * 1024;

struct Session {
    editor: Editor,
    saved: String,
    dirty: bool,
}
struct Runtime {
    sessions: HashMap<u32, Session>,
    next_id: u32,
    input: Vec<u8>,
    output: Vec<u8>,
}
impl Default for Runtime {
    fn default() -> Self {
        Self {
            sessions: HashMap::new(),
            next_id: 1,
            input: Vec::new(),
            output: Vec::new(),
        }
    }
}
thread_local! { static RUNTIME: RefCell<Runtime> = RefCell::new(Runtime::default()); }

#[no_mangle]
pub extern "C" fn abi_version() -> u32 {
    1
}

/// A null pointer means the requested length exceeded the input limit.
#[no_mangle]
pub extern "C" fn reserve_input(length: u32) -> *mut u8 {
    RUNTIME.with(|runtime| {
        let mut runtime = runtime.borrow_mut();
        if length as usize > MAX_INPUT {
            runtime.input.clear();
            return std::ptr::null_mut();
        }
        runtime.input.resize(length as usize, 0);
        runtime.input.as_mut_ptr()
    })
}

#[no_mangle]
pub extern "C" fn output_pointer() -> *const u8 {
    RUNTIME.with(|runtime| runtime.borrow().output.as_ptr())
}
#[no_mangle]
pub extern "C" fn output_length() -> u32 {
    RUNTIME.with(|runtime| runtime.borrow().output.len() as u32)
}

/// op: 0 create, 1 destroy, 2 load, 3 replace, 4 selection, 5 undo,
/// 6 redo, 7 snapshot, 8 export normalized source, 9 mark saved,
/// 10 automatic-format undo, 11 finalize a command selection.
/// start/end are UTF-8 offsets; selection op preserves anchor/focus direction.
/// Status: 0 success, 1 invalid input, 2 missing handle, 3 edit rejected,
/// 4 unsupported op. Errors have a single length-prefixed message as output.
#[no_mangle]
pub extern "C" fn dispatch(op: u32, handle: u32, revision: u64, start: u32, end: u32) -> u32 {
    RUNTIME.with(|runtime| {
        let mut runtime = runtime.borrow_mut();
        runtime.output.clear();
        let result = execute(
            &mut runtime,
            op,
            handle,
            revision,
            start as usize,
            end as usize,
        );
        match result {
            Ok(()) => 0,
            Err((status, message)) => {
                runtime.output.clear();
                put_string(&mut runtime.output, &message);
                status
            }
        }
    })
}

fn execute(
    runtime: &mut Runtime,
    op: u32,
    handle: u32,
    revision: u64,
    start: usize,
    end: usize,
) -> Result<(), (u32, String)> {
    let input_text =
        std::str::from_utf8(&runtime.input).map_err(|_| (1, "Input must be UTF-8".into()))?;
    let normalized_input = input_text.replace("\r\n", "\n").replace('\r', "\n");
    let input = normalized_input.as_str();
    if op == 0 {
        let id = runtime.next_id;
        runtime.next_id = id
            .checked_add(1)
            .ok_or((1, "Handle space exhausted".into()))?;
        runtime.sessions.insert(
            id,
            Session {
                editor: Editor::from_source(input),
                saved: input.into(),
                dirty: false,
            },
        );
        return snapshot(runtime, id, true);
    }
    if op == 1 {
        runtime
            .sessions
            .remove(&handle)
            .ok_or((2, "Unknown editor handle".into()))?;
        return Ok(());
    }
    let session = runtime
        .sessions
        .get_mut(&handle)
        .ok_or((2, "Unknown editor handle".into()))?;
    if [2, 3, 4, 5, 6, 9, 10, 11].contains(&op) && revision != session.editor.revision() {
        return Err((3, "Stale document revision".into()));
    }
    match op {
        2 => {
            session.editor.load_source(input).map_err(edit_error)?;
            session.saved = input.into();
        }
        3 => {
            if session
                .editor
                .document()
                .plain_text()
                .len()
                .saturating_sub(end.saturating_sub(start))
                + input.len()
                > MAX_INPUT
            {
                return Err((1, "Document exceeds 32 MiB".into()));
            }
            session
                .editor
                .replace_range(revision, start, end, input)
                .map_err(edit_error)?;
        }
        4 | 11 => {
            let document = session.editor.document();
            let anchor = document.position_at(start).map_err(edit_error)?;
            let focus = document.position_at(end).map_err(edit_error)?;
            if op == 11 {
                session
                    .editor
                    .finalize_selection(Selection { anchor, focus })
                    .map_err(edit_error)?;
            } else {
                session
                    .editor
                    .set_selection(Selection { anchor, focus })
                    .map_err(edit_error)?;
            }
        }
        5 => {
            session.editor.undo(revision).map_err(edit_error)?;
        }
        6 => {
            session.editor.redo(revision).map_err(edit_error)?;
        }
        7 => {}
        8 => {
            put_string(
                &mut runtime.output,
                &markdown::normalize(&session.editor.document().plain_text()),
            );
            return Ok(());
        }
        9 => {
            session.saved = session.editor.document().plain_text();
        }
        10 => {
            session
                .editor
                .undo_autoformat(revision, start, end, input)
                .map_err(edit_error)?;
        }
        _ => return Err((4, "Unsupported operation".into())),
    }
    snapshot(runtime, handle, op != 4 && op != 11)
}

fn edit_error(error: crate::editor::EditError) -> (u32, String) {
    (3, format!("{error:?}"))
}

fn put_string(output: &mut Vec<u8>, text: &str) {
    output.extend_from_slice(&(text.len() as u32).to_le_bytes());
    output.extend_from_slice(text.as_bytes());
}

fn snapshot(
    runtime: &mut Runtime,
    handle: u32,
    include_content: bool,
) -> Result<(), (u32, String)> {
    let session = runtime
        .sessions
        .get_mut(&handle)
        .ok_or((2, "Unknown editor handle".into()))?;
    let document = session.editor.document();
    let source = if include_content {
        document.plain_text()
    } else {
        String::new()
    };
    if include_content {
        session.dirty = source != session.saved;
    }
    let selection = session.editor.selection();
    let output = &mut runtime.output;
    output.extend_from_slice(&handle.to_le_bytes());
    output.extend_from_slice(&session.editor.revision().to_le_bytes());
    output.extend_from_slice(
        &(document
            .absolute_offset(selection.anchor)
            .map_err(edit_error)? as u32)
            .to_le_bytes(),
    );
    output.extend_from_slice(
        &(document
            .absolute_offset(selection.focus)
            .map_err(edit_error)? as u32)
            .to_le_bytes(),
    );
    let flags: u32 = u32::from(session.editor.can_undo())
        | (u32::from(session.editor.can_redo()) << 1)
        | (u32::from(session.dirty) << 2);
    output.extend_from_slice(&flags.to_le_bytes());
    if !include_content {
        return Ok(());
    }
    put_string(output, &source);
    put_string(output, &markdown::render(&source, false));
    put_string(
        output,
        &markdown::front_matter_layout(&source).unwrap_or_default(),
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn request(
        op: u32,
        handle: u32,
        revision: u64,
        start: u32,
        end: u32,
        text: &str,
    ) -> (u32, Vec<u8>) {
        RUNTIME.with(|runtime| runtime.borrow_mut().input = text.as_bytes().into());
        let status = dispatch(op, handle, revision, start, end);
        let output = RUNTIME.with(|runtime| runtime.borrow().output.clone());
        (status, output)
    }
    fn id(reply: &[u8]) -> u32 {
        u32::from_le_bytes(reply[..4].try_into().unwrap())
    }
    #[test]
    fn independent_sessions_stale_revisions_and_lifecycle() {
        let (status, first) = request(0, 0, 0, 0, 0, "한😀");
        assert_eq!(status, 0);
        let first = id(&first);
        let (_, second) = request(0, 0, 0, 0, 0, "second");
        let second = id(&second);
        assert_ne!(first, second);
        assert_eq!(request(3, first, 0, 3, 7, "글").0, 0);
        assert_eq!(request(3, first, 0, 0, 0, "bad").0, 3);
        assert_eq!(request(3, first, 1, 1, 2, "bad").0, 3);
        assert_eq!(request(5, first, 1, 0, 0, "").0, 0);
        let (_, output) = request(8, second, 0, 0, 0, "");
        assert_eq!(&output[4..], b"second");
        assert_eq!(request(1, first, 0, 0, 0, "").0, 0);
        assert_eq!(request(7, first, 0, 0, 0, "").0, 2);
        request(1, second, 0, 0, 0, "");
    }
    #[test]
    fn rejects_bad_utf8_and_oversized_input() {
        assert!(reserve_input((MAX_INPUT + 1) as u32).is_null());
        RUNTIME.with(|runtime| runtime.borrow_mut().input = vec![255]);
        assert_eq!(dispatch(0, 0, 0, 0, 0), 1);
    }

    #[test]
    fn raw_abi_normalizes_import_and_replacement_newlines() {
        let (_, output) = request(0, 0, 0, 0, 0, "a\r\nb");
        let handle = id(&output);
        let (_, exported) = request(8, handle, 0, 0, 0, "");
        assert_eq!(&exported[4..], b"a\nb");
        assert_eq!(request(3, handle, 0, 3, 3, "\r\nc").0, 0);
        let (_, exported) = request(8, handle, 0, 0, 0, "");
        assert_eq!(&exported[4..], b"a\nb\nc");
        request(1, handle, 0, 0, 0, "");
    }
}
