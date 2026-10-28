//! Separate stable collaboration ABI v2. Editor ABI v1 remains independent.
use super::*;
use std::cell::RefCell;
use std::fmt::Write;
const MAX_BYTES: usize = 16 * 1024 * 1024;
#[derive(Default)]
struct Runtime {
    input: Vec<u8>,
    output: Vec<u8>,
    sessions: BTreeMap<u32, Replica>,
    next: u32,
}
thread_local! { static RUNTIME: RefCell<Runtime> = RefCell::new(Runtime::default()); }

#[no_mangle]
pub extern "C" fn collab_abi_version() -> u32 {
    2
}
// Bit 0: the SCV2 operation schema includes row/column Reorder (tag 9).
#[no_mangle]
pub extern "C" fn collab_schema_capabilities() -> u32 {
    1
}
#[no_mangle]
pub extern "C" fn collab_reserve_input(length: u32) -> *mut u8 {
    RUNTIME.with(|runtime| {
        let mut runtime = runtime.borrow_mut();
        if length as usize > MAX_BYTES {
            runtime.input.clear();
            return std::ptr::null_mut();
        }
        runtime.input.resize(length as usize, 0);
        runtime.input.as_mut_ptr()
    })
}
#[no_mangle]
pub extern "C" fn collab_output_pointer() -> *const u8 {
    RUNTIME.with(|runtime| runtime.borrow().output.as_ptr())
}
#[no_mangle]
pub extern "C" fn collab_output_length() -> u32 {
    RUNTIME.with(|runtime| runtime.borrow().output.len() as u32)
}
#[no_mangle]
pub extern "C" fn collab_dispatch(op: u32, handle: u32, start: u32, end: u32) -> u32 {
    RUNTIME.with(|runtime| {
        let mut runtime = runtime.borrow_mut();
        runtime.output.clear();
        // A mutation is committed only when its ABI reply can also be encoded.
        // Native transactions alone do not cover serialization/resource errors in reply().
        let previous = if matches!(op, 2 | 3 | 6..=14 | 20 | 21 | 26 | 28..=31) {
            runtime.sessions.get(&handle).cloned()
        } else {
            None
        };
        match execute(&mut runtime, op, handle, start as usize, end as usize) {
            Ok(()) => 0,
            Err(error) => {
                if let Some(previous) = previous {
                    runtime.sessions.insert(handle, previous);
                }
                runtime.output = format!("{error:?}").into_bytes();
                1
            }
        }
    })
}
fn execute(
    runtime: &mut Runtime,
    op: u32,
    handle: u32,
    start: usize,
    end: usize,
) -> Result<(), CollabError> {
    if op == 0 {
        if runtime.input.len() != 32 {
            return Err(CollabError::InvalidEncoding);
        }
        let document = DocumentId(u128::from_le_bytes(runtime.input[..16].try_into().unwrap()));
        let actor = ActorId(u128::from_le_bytes(runtime.input[16..].try_into().unwrap()));
        let replica = Replica::new(document, actor)?;
        let id = runtime
            .next
            .checked_add(1)
            .ok_or(CollabError::CounterOverflow)?;
        runtime.next = id;
        runtime.sessions.insert(id, replica);
        return reply(runtime, id, None, None);
    }
    if op == 1 {
        runtime
            .sessions
            .remove(&handle)
            .ok_or(CollabError::InvalidIdentity)?;
        return Ok(());
    }
    let replica = runtime
        .sessions
        .get_mut(&handle)
        .ok_or(CollabError::InvalidIdentity)?;
    let input = &runtime.input;
    let mut update = None;
    let mut report = None;
    match op {
        2 => {
            let text = std::str::from_utf8(input).map_err(|_| CollabError::InvalidEncoding)?;
            update = Some(replica.replace_text(TextScope::Document, start, end, text)?);
        }
        3 => {
            report = Some(replica.merge(&decode_update(input)?)?);
        }
        4 => {
            runtime.output = encode_update(&replica.export_all())?;
            return Ok(());
        }
        5 => {}
        6 => {
            update = Some(replica.undo()?);
        }
        7 => {
            update = Some(replica.redo()?);
        }
        8 => {
            if input.len() != 8 {
                return Err(CollabError::InvalidEncoding);
            }
            let rows = u32::from_le_bytes(input[..4].try_into().unwrap()) as usize;
            let columns = u32::from_le_bytes(input[4..].try_into().unwrap()) as usize;
            update = Some(replica.create_table(start, rows, columns)?.1);
        }
        9 => {
            if input.len() < 72 {
                return Err(CollabError::InvalidEncoding);
            }
            let scope = TextScope::Cell {
                table: read_id(&input[..24])?,
                row: read_id(&input[24..48])?,
                column: read_id(&input[48..72])?,
            };
            let text =
                std::str::from_utf8(&input[72..]).map_err(|_| CollabError::InvalidEncoding)?;
            update = Some(replica.replace_text(scope, start, end, text)?);
        }
        10 | 11 => {
            if ![25, 49].contains(&input.len()) {
                return Err(CollabError::InvalidEncoding);
            }
            let table = read_id(&input[..24])?;
            let after = match input[24] {
                0 if input.len() == 25 => None,
                1 if input.len() == 49 => Some(read_id(&input[25..])?),
                _ => return Err(CollabError::InvalidEncoding),
            };
            update = Some(if op == 10 {
                replica.insert_row(table, after)?.1
            } else {
                replica.insert_column(table, after)?.1
            });
        }
        12 | 13 => {
            if input.len() != 48 {
                return Err(CollabError::InvalidEncoding);
            }
            let table = read_id(&input[..24])?;
            let target = read_id(&input[24..])?;
            update = Some(if op == 12 {
                replica.delete_row(table, target)?
            } else {
                replica.delete_column(table, target)?
            });
        }
        14 => {
            if input.len() != 49 {
                return Err(CollabError::InvalidEncoding);
            }
            let table = read_id(&input[..24])?;
            let column = read_id(&input[24..48])?;
            let alignment = match input[48] {
                0 => Alignment::Left,
                1 => Alignment::Center,
                2 => Alignment::Right,
                _ => return Err(CollabError::InvalidEncoding),
            };
            update = Some(replica.set_alignment(table, column, alignment)?);
        }
        31 => {
            if input.len() < 30 || input[24] > 1 {
                return Err(CollabError::InvalidEncoding);
            }
            let table = read_id(&input[..24])?;
            let count = u32::from_le_bytes(input[25..29].try_into().unwrap()) as usize;
            if count == 0 || count > MAX_PENDING {
                return Err(CollabError::InvalidEncoding);
            }
            let tail = 29 + count * 24;
            if input.len() <= tail {
                return Err(CollabError::InvalidEncoding);
            }
            let mut targets = Vec::new();
            for index in 0..count {
                targets.push(read_id(&input[29 + index * 24..53 + index * 24])?);
            }
            let before = match input[tail] {
                0 if input.len() == tail + 1 => None,
                1 if input.len() == tail + 25 => Some(read_id(&input[tail + 1..])?),
                _ => return Err(CollabError::InvalidEncoding),
            };
            update = Some(replica.reorder(table, input[24] == 1, targets, before)?);
        }
        30 => {
            let text = std::str::from_utf8(input).map_err(|_| CollabError::InvalidEncoding)?;
            update = Some(replica.replace_projected_text(start, end, text)?);
        }
        29 => {
            replica.redo.clear();
        }
        28 => {
            replica.undo.clear();
            replica.redo.clear();
        }
        26 => {
            if input.len() != 49 {
                return Err(CollabError::InvalidEncoding);
            }
            let table = read_id(&input[..24])?;
            let mut values = [0usize; 6];
            for (index, value) in values.iter_mut().enumerate() {
                *value =
                    u32::from_le_bytes(input[24 + index * 4..28 + index * 4].try_into().unwrap())
                        as usize;
            }
            update = Some(replica.table_action(
                table,
                input[48],
                values[0],
                values[1],
                [values[2], values[3], values[4], values[5]],
            )?);
        }
        32 => {
            replica.coalesce_history();
            return Ok(());
        }
        33 => {
            // Preflight a raw source transaction without publishing operations,
            // changing history or advancing the live replica's identity counter.
            let text = std::str::from_utf8(input).map_err(|_| CollabError::InvalidEncoding)?;
            let mut candidate = replica.clone();
            candidate.replace_markdown(start, end, text)?;
            runtime.output = candidate.projection().markdown.into_bytes();
            return Ok(());
        }
        20 => {
            let text = std::str::from_utf8(input).map_err(|_| CollabError::InvalidEncoding)?;
            update = Some(replica.import_markdown(text)?);
        }
        21 => {
            let text = std::str::from_utf8(input).map_err(|_| CollabError::InvalidEncoding)?;
            update = Some(replica.replace_markdown(start, end, text)?);
        }
        22 => {
            let projection = replica.projection();
            let (scope, offset) = projection.position(start)?;
            runtime.output = encode_anchor(&replica.anchor_at(
                scope,
                offset,
                if end == 0 { Bias::Before } else { Bias::After },
            )?);
            return Ok(());
        }
        23 => {
            let anchor = decode_anchor(input)?;
            let offset = replica.resolve_anchor(anchor)?;
            let projected = replica
                .projection()
                .offset(anchor.scope, offset)
                .ok_or(CollabError::ProjectionDraft)?;
            runtime.output = (projected as u32).to_le_bytes().to_vec();
            return Ok(());
        }
        24 => {
            let projection = replica.projection();
            let (scope, from) = projection.position(start)?;
            let (other, to) = projection.position(end)?;
            if scope != other {
                return Err(CollabError::ProjectionDraft);
            }
            runtime.output = encode_capture(&replica.capture_range(scope, from, to)?)?;
            return Ok(());
        }
        16 => {
            let scope = super::codec::decode_scope(input)?;
            let bias = match end {
                0 => Bias::Before,
                1 => Bias::After,
                _ => return Err(CollabError::InvalidEncoding),
            };
            runtime.output = encode_anchor(&replica.anchor_at(scope, start, bias)?);
            return Ok(());
        }
        17 => {
            let anchor = decode_anchor(input)?;
            runtime.output = (replica.resolve_anchor(anchor)? as u32)
                .to_le_bytes()
                .to_vec();
            return Ok(());
        }
        18 => {
            let scope = super::codec::decode_scope(input)?;
            runtime.output = encode_capture(&replica.capture_range(scope, start, end)?)?;
            return Ok(());
        }
        19 => {
            if input.len() < 4 {
                return Err(CollabError::InvalidEncoding);
            }
            let length = u32::from_le_bytes(input[..4].try_into().unwrap()) as usize;
            let split = length
                .checked_add(4)
                .filter(|split| *split <= input.len())
                .ok_or(CollabError::InvalidEncoding)?;
            let capture = decode_capture(&input[4..split])?;
            let text =
                std::str::from_utf8(&input[split..]).map_err(|_| CollabError::InvalidEncoding)?;
            update = Some(replica.replace_capture(&capture, text)?);
        }
        _ => return Err(CollabError::InvalidOperation),
    }
    reply(runtime, handle, update.as_ref(), report.as_ref())
}
fn read_id(bytes: &[u8]) -> Result<OpId, CollabError> {
    if bytes.len() != 24 {
        return Err(CollabError::InvalidEncoding);
    }
    Ok(OpId {
        counter: u64::from_le_bytes(bytes[..8].try_into().unwrap()),
        actor: ActorId(u128::from_le_bytes(bytes[8..].try_into().unwrap())),
    })
}
fn id_text(id: OpId) -> String {
    format!("{:016x}-{:032x}", id.counter, id.actor.0)
}
fn quoted(text: &str) -> String {
    let mut result = String::from("\"");
    for c in text.chars() {
        match c {
            '"' => result.push_str("\\\""),
            '\\' => result.push_str("\\\\"),
            '\n' => result.push_str("\\n"),
            '\r' => result.push_str("\\r"),
            '\t' => result.push_str("\\t"),
            c if c.is_control() => {
                let _ = write!(result, "\\u{:04x}", c as u32);
            }
            c => result.push(c),
        }
    }
    result.push('"');
    result
}
fn ids_json(ids: &[OpId]) -> String {
    format!(
        "[{}]",
        ids.iter()
            .map(|id| quoted(&id_text(*id)))
            .collect::<Vec<_>>()
            .join(",")
    )
}
fn reply(
    runtime: &mut Runtime,
    handle: u32,
    update: Option<&Update>,
    report: Option<&MergeReport>,
) -> Result<(), CollabError> {
    let replica = &runtime.sessions[&handle];
    let markdown = replica.markdown();
    let mut tables = Vec::new();
    for id in replica.visible_tables() {
        let view = replica.table(id)?;
        let cells: Vec<_> = view
            .cells
            .iter()
            .map(|cell| {
                format!(
                    "{{\"row\":{},\"column\":{},\"text\":{}}}",
                    quoted(&id_text(cell.row)),
                    quoted(&id_text(cell.column)),
                    quoted(&cell.text)
                )
            })
            .collect();
        let alignments: Vec<_> = view
            .alignments
            .iter()
            .map(|alignment| {
                quoted(match alignment {
                    Alignment::Left => "left",
                    Alignment::Center => "center",
                    Alignment::Right => "right",
                })
            })
            .collect();
        tables.push(format!(
            "{{\"id\":{},\"rows\":{},\"columns\":{},\"alignments\":[{}],\"cells\":[{}]}}",
            quoted(&id_text(id)),
            ids_json(&view.rows),
            ids_json(&view.columns),
            alignments.join(","),
            cells.join(",")
        ));
    }
    let rejected = report.map_or(0, |report| report.rejected.len());
    let mut json = format!("{{\"handle\":{handle},\"document_id\":\"{:032x}\",\"actor_id\":\"{:032x}\",\"text\":{},\"markdown\":{},\"html\":{},\"can_undo\":{},\"can_redo\":{},\"pending\":{},\"rejected\":{rejected},\"operation_count\":{},\"frontier\":{},\"tables\":[{}]}}", replica.document.0, replica.actor.0, quoted(&replica.text(TextScope::Document)?), quoted(&markdown), quoted(&crate::markdown::render(&markdown, false)), replica.can_undo(), replica.can_redo(), replica.pending_count(), replica.operation_count(), ids_json(&replica.frontier()), tables.join(","));
    let projection = replica.projection();
    let projected_tables: Vec<String> = projection
        .tables
        .iter()
        .map(|table| {
            let cells: Vec<String> = table
                .cells
                .iter()
                .map(|cell| {
                    let TextScope::Cell { row, column, .. } = cell.scope else {
                        unreachable!()
                    };
                    format!(
                        "{{\"row\":{},\"column\":{},\"start\":{},\"end\":{}}}",
                        quoted(&id_text(row)),
                        quoted(&id_text(column)),
                        cell.start,
                        cell.end
                    )
                })
                .collect();
            format!(
                "{{\"id\":{},\"start\":{},\"end\":{},\"document_offset\":{},\"cells\":[{}]}}",
                quoted(&id_text(table.id)),
                table.start,
                table.end,
                table.document_offset,
                cells.join(",")
            )
        })
        .collect();
    json.pop();
    let _ = write!(json, ",\"projection\":[{}]}}", projected_tables.join(","));
    let bytes = match update {
        Some(update) => encode_update(update)?,
        None => Vec::new(),
    };
    runtime
        .output
        .extend_from_slice(&(json.len() as u32).to_le_bytes());
    runtime.output.extend_from_slice(json.as_bytes());
    runtime
        .output
        .extend_from_slice(&(bytes.len() as u32).to_le_bytes());
    runtime.output.extend_from_slice(&bytes);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn json_escape_preserves_controls_and_unicode() {
        assert_eq!(quoted("한\"\\\n\0"), "\"한\\\"\\\\\\n\\u0000\"");
    }
    #[test]
    fn creation_edit_export_merge_and_invalid_handle() {
        RUNTIME.with(|runtime| {
            let mut runtime = runtime.borrow_mut();
            runtime.input = [1u128.to_le_bytes(), 2u128.to_le_bytes()].concat();
        });
        assert_eq!(collab_dispatch(0, 0, 0, 0), 0);
        let handle = RUNTIME.with(|runtime| runtime.borrow().next);
        RUNTIME.with(|runtime| runtime.borrow_mut().input = "한글😀".as_bytes().to_vec());
        assert_eq!(collab_dispatch(2, handle, 0, 0), 0);
        assert_eq!(collab_dispatch(4, handle, 0, 0), 0);
        let bytes = RUNTIME.with(|runtime| runtime.borrow().output.clone());
        assert_eq!(decode_update(&bytes).unwrap().operations.len(), 1);
        assert_eq!(collab_dispatch(1, handle, 0, 0), 0);
        assert_eq!(collab_dispatch(5, handle, 0, 0), 1);
    }
    #[test]
    fn invalid_mutations_preserve_document_log_and_local_history() {
        RUNTIME.with(|runtime| {
            runtime.borrow_mut().input = [7u128.to_le_bytes(), 8u128.to_le_bytes()].concat();
        });
        assert_eq!(collab_dispatch(0, 0, 0, 0), 0);
        let handle = RUNTIME.with(|runtime| runtime.borrow().next);
        RUNTIME.with(|runtime| runtime.borrow_mut().input = "한😀".as_bytes().to_vec());
        assert_eq!(collab_dispatch(2, handle, 0, 0), 0);
        assert_eq!(collab_dispatch(4, handle, 0, 0), 0);
        let before = RUNTIME.with(|runtime| runtime.borrow().output.clone());
        for (input, start, end) in [(vec![255], 0, 0), (b"x".to_vec(), 1, 2)] {
            RUNTIME.with(|runtime| runtime.borrow_mut().input = input);
            assert_eq!(collab_dispatch(2, handle, start, end), 1);
            assert_eq!(collab_dispatch(4, handle, 0, 0), 0);
            assert_eq!(
                RUNTIME.with(|runtime| runtime.borrow().output.clone()),
                before
            );
        }
        assert_eq!(collab_dispatch(6, handle, 0, 0), 0);
        RUNTIME.with(|runtime| {
            assert_eq!(
                runtime.borrow().sessions[&handle]
                    .text(TextScope::Document)
                    .unwrap(),
                ""
            );
        });
        assert_eq!(collab_dispatch(7, handle, 0, 0), 0);
        assert_eq!(collab_dispatch(4, handle, 0, 0), 0);
        let restored = RUNTIME.with(|runtime| decode_update(&runtime.borrow().output).unwrap());
        assert_eq!(restored.operations.len(), 3);
        assert_eq!(collab_dispatch(1, handle, 0, 0), 0);
    }
}
