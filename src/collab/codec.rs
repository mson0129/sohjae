//! Bounded little-endian wire format. No JSON/serde or generated bindings.
use super::*;
const MAGIC: &[u8; 4] = b"SCV2";
pub const MAX_UPDATE_BYTES: usize = 16 * 1024 * 1024;

pub fn encode_update(update: &Update) -> Result<Vec<u8>, CollabError> {
    if update.document.0 == 0 || update.operations.len() > MAX_LOG {
        return Err(CollabError::ResourceLimit);
    }
    let mut output = Vec::new();
    output.extend_from_slice(MAGIC);
    output.extend_from_slice(&PROTOCOL_VERSION.to_le_bytes());
    output.extend_from_slice(&update.document.0.to_le_bytes());
    put_len(&mut output, update.operations.len());
    for operation in &update.operations {
        validate_envelope(operation)?;
        put_id(&mut output, operation.id);
        put_len(&mut output, operation.dependencies.len());
        for dependency in &operation.dependencies {
            put_id(&mut output, *dependency);
        }
        match &operation.kind {
            OperationKind::InsertText { scope, after, text } => {
                output.push(0);
                put_scope(&mut output, *scope);
                put_optional_atom(&mut output, *after);
                put_len(&mut output, text.len());
                output.extend_from_slice(text.as_bytes());
            }
            OperationKind::DeleteText { scope, targets } => {
                output.push(1);
                put_scope(&mut output, *scope);
                put_len(&mut output, targets.len());
                for target in targets {
                    put_atom(&mut output, *target);
                }
            }
            OperationKind::CreateTable { after } => {
                output.push(2);
                put_optional_atom(&mut output, *after);
            }
            OperationKind::InsertRow { table, after }
            | OperationKind::InsertColumn { table, after } => {
                output.push(
                    if matches!(operation.kind, OperationKind::InsertRow { .. }) {
                        3
                    } else {
                        4
                    },
                );
                put_id(&mut output, *table);
                put_optional_id(&mut output, *after);
            }
            OperationKind::DeleteRow { table, row } => {
                output.push(5);
                put_id(&mut output, *table);
                put_id(&mut output, *row);
            }
            OperationKind::DeleteColumn { table, column } => {
                output.push(6);
                put_id(&mut output, *table);
                put_id(&mut output, *column);
            }
            OperationKind::SetAlignment {
                table,
                column,
                alignment,
            } => {
                output.push(7);
                put_id(&mut output, *table);
                put_id(&mut output, *column);
                output.push(match alignment {
                    Alignment::Left => 0,
                    Alignment::Center => 1,
                    Alignment::Right => 2,
                });
            }
            OperationKind::SetActive { target, active } => {
                output.push(8);
                put_id(&mut output, *target);
                output.push(u8::from(*active));
            }
        }
        if output.len() > MAX_UPDATE_BYTES {
            return Err(CollabError::ResourceLimit);
        }
    }
    Ok(output)
}
fn put_len(output: &mut Vec<u8>, length: usize) {
    output.extend_from_slice(&(length as u32).to_le_bytes());
}
fn put_id(output: &mut Vec<u8>, id: OpId) {
    output.extend_from_slice(&id.counter.to_le_bytes());
    output.extend_from_slice(&id.actor.0.to_le_bytes());
}
fn put_atom(output: &mut Vec<u8>, id: AtomId) {
    put_id(output, id.operation);
    output.extend_from_slice(&id.offset.to_le_bytes());
}
fn put_optional_id(output: &mut Vec<u8>, id: Option<OpId>) {
    output.push(u8::from(id.is_some()));
    if let Some(id) = id {
        put_id(output, id);
    }
}
fn put_optional_atom(output: &mut Vec<u8>, id: Option<AtomId>) {
    output.push(u8::from(id.is_some()));
    if let Some(id) = id {
        put_atom(output, id);
    }
}
fn put_scope(output: &mut Vec<u8>, scope: TextScope) {
    match scope {
        TextScope::Document => output.push(0),
        TextScope::Cell { table, row, column } => {
            output.push(1);
            put_id(output, table);
            put_id(output, row);
            put_id(output, column);
        }
    }
}

struct Reader<'a> {
    input: &'a [u8],
    offset: usize,
}
impl<'a> Reader<'a> {
    fn take(&mut self, length: usize) -> Result<&'a [u8], CollabError> {
        let end = self
            .offset
            .checked_add(length)
            .ok_or(CollabError::InvalidEncoding)?;
        let bytes = self
            .input
            .get(self.offset..end)
            .ok_or(CollabError::InvalidEncoding)?;
        self.offset = end;
        Ok(bytes)
    }
    fn byte(&mut self) -> Result<u8, CollabError> {
        Ok(self.take(1)?[0])
    }
    fn boolean(&mut self) -> Result<bool, CollabError> {
        match self.byte()? {
            0 => Ok(false),
            1 => Ok(true),
            _ => Err(CollabError::InvalidEncoding),
        }
    }
    fn length(&mut self, max: usize) -> Result<usize, CollabError> {
        let length = u32::from_le_bytes(self.take(4)?.try_into().unwrap()) as usize;
        if length > max {
            Err(CollabError::ResourceLimit)
        } else {
            Ok(length)
        }
    }
    fn id(&mut self) -> Result<OpId, CollabError> {
        Ok(OpId {
            counter: u64::from_le_bytes(self.take(8)?.try_into().unwrap()),
            actor: ActorId(u128::from_le_bytes(self.take(16)?.try_into().unwrap())),
        })
    }
    fn atom(&mut self) -> Result<AtomId, CollabError> {
        let operation = self.id()?;
        let offset = u32::from_le_bytes(self.take(4)?.try_into().unwrap());
        Ok(AtomId { operation, offset })
    }
    fn optional_id(&mut self) -> Result<Option<OpId>, CollabError> {
        if self.boolean()? {
            Ok(Some(self.id()?))
        } else {
            Ok(None)
        }
    }
    fn optional_atom(&mut self) -> Result<Option<AtomId>, CollabError> {
        if self.boolean()? {
            Ok(Some(self.atom()?))
        } else {
            Ok(None)
        }
    }
    fn scope(&mut self) -> Result<TextScope, CollabError> {
        match self.byte()? {
            0 => Ok(TextScope::Document),
            1 => Ok(TextScope::Cell {
                table: self.id()?,
                row: self.id()?,
                column: self.id()?,
            }),
            _ => Err(CollabError::InvalidEncoding),
        }
    }
}

pub fn decode_update(bytes: &[u8]) -> Result<Update, CollabError> {
    if bytes.len() > MAX_UPDATE_BYTES {
        return Err(CollabError::ResourceLimit);
    }
    let mut reader = Reader {
        input: bytes,
        offset: 0,
    };
    if reader.take(4)? != MAGIC {
        return Err(CollabError::InvalidEncoding);
    }
    if u16::from_le_bytes(reader.take(2)?.try_into().unwrap()) != PROTOCOL_VERSION {
        return Err(CollabError::UnsupportedVersion);
    }
    let document = DocumentId(u128::from_le_bytes(reader.take(16)?.try_into().unwrap()));
    if document.0 == 0 {
        return Err(CollabError::InvalidIdentity);
    }
    let count = reader.length(MAX_LOG)?;
    let mut operations = Vec::new();
    for _ in 0..count {
        let id = reader.id()?;
        let count = reader.length(MAX_PENDING)?;
        let mut dependencies = Vec::new();
        for _ in 0..count {
            dependencies.push(reader.id()?);
        }
        let kind = match reader.byte()? {
            0 => {
                let scope = reader.scope()?;
                let after = reader.optional_atom()?;
                let length = reader.length(MAX_TEXT_BYTES)?;
                let text = std::str::from_utf8(reader.take(length)?)
                    .map_err(|_| CollabError::InvalidEncoding)?
                    .into();
                OperationKind::InsertText { scope, after, text }
            }
            1 => {
                let scope = reader.scope()?;
                let count = reader.length(MAX_TEXT_BYTES)?;
                let mut targets = Vec::new();
                for _ in 0..count {
                    targets.push(reader.atom()?);
                }
                OperationKind::DeleteText { scope, targets }
            }
            2 => OperationKind::CreateTable {
                after: reader.optional_atom()?,
            },
            3 => OperationKind::InsertRow {
                table: reader.id()?,
                after: reader.optional_id()?,
            },
            4 => OperationKind::InsertColumn {
                table: reader.id()?,
                after: reader.optional_id()?,
            },
            5 => OperationKind::DeleteRow {
                table: reader.id()?,
                row: reader.id()?,
            },
            6 => OperationKind::DeleteColumn {
                table: reader.id()?,
                column: reader.id()?,
            },
            7 => {
                let table = reader.id()?;
                let column = reader.id()?;
                let alignment = match reader.byte()? {
                    0 => Alignment::Left,
                    1 => Alignment::Center,
                    2 => Alignment::Right,
                    _ => return Err(CollabError::InvalidEncoding),
                };
                OperationKind::SetAlignment {
                    table,
                    column,
                    alignment,
                }
            }
            8 => OperationKind::SetActive {
                target: reader.id()?,
                active: reader.boolean()?,
            },
            _ => return Err(CollabError::InvalidEncoding),
        };
        let operation = Operation {
            id,
            dependencies,
            kind,
        };
        validate_envelope(&operation)?;
        operations.push(operation);
    }
    if reader.offset != bytes.len() {
        return Err(CollabError::InvalidEncoding);
    }
    Ok(Update {
        document,
        operations,
    })
}

pub(super) fn decode_scope(bytes: &[u8]) -> Result<TextScope, CollabError> {
    let mut reader = Reader {
        input: bytes,
        offset: 0,
    };
    let scope = reader.scope()?;
    if reader.offset != bytes.len() {
        return Err(CollabError::InvalidEncoding);
    }
    Ok(scope)
}
pub fn encode_anchor(anchor: &Anchor) -> Vec<u8> {
    let mut bytes = Vec::new();
    put_scope(&mut bytes, anchor.scope);
    put_optional_atom(&mut bytes, anchor.left);
    put_optional_atom(&mut bytes, anchor.right);
    bytes.push(if anchor.bias == Bias::Before { 0 } else { 1 });
    bytes
}
pub fn decode_anchor(bytes: &[u8]) -> Result<Anchor, CollabError> {
    let mut reader = Reader {
        input: bytes,
        offset: 0,
    };
    let scope = reader.scope()?;
    let left = reader.optional_atom()?;
    let right = reader.optional_atom()?;
    let bias = match reader.byte()? {
        0 => Bias::Before,
        1 => Bias::After,
        _ => return Err(CollabError::InvalidEncoding),
    };
    if reader.offset != bytes.len() {
        return Err(CollabError::InvalidEncoding);
    }
    Ok(Anchor {
        scope,
        left,
        right,
        bias,
    })
}
pub fn encode_capture(capture: &EditCapture) -> Result<Vec<u8>, CollabError> {
    if capture.targets.len() > (MAX_UPDATE_BYTES - 128) / 28 {
        return Err(CollabError::ResourceLimit);
    }
    let mut bytes = Vec::new();
    bytes.extend_from_slice(b"SCE2");
    bytes.extend_from_slice(&capture.document.0.to_le_bytes());
    put_scope(&mut bytes, capture.scope);
    put_optional_atom(&mut bytes, capture.after);
    put_len(&mut bytes, capture.targets.len());
    for target in &capture.targets {
        put_atom(&mut bytes, *target);
    }
    Ok(bytes)
}
pub fn decode_capture(bytes: &[u8]) -> Result<EditCapture, CollabError> {
    if bytes.len() > MAX_UPDATE_BYTES {
        return Err(CollabError::ResourceLimit);
    }
    let mut reader = Reader {
        input: bytes,
        offset: 0,
    };
    if reader.take(4)? != b"SCE2" {
        return Err(CollabError::InvalidEncoding);
    }
    let document = DocumentId(u128::from_le_bytes(reader.take(16)?.try_into().unwrap()));
    if document.0 == 0 {
        return Err(CollabError::InvalidIdentity);
    }
    let scope = reader.scope()?;
    let after = reader.optional_atom()?;
    let count = reader.length(MAX_TEXT_BYTES)?;
    let mut targets = Vec::new();
    for _ in 0..count {
        targets.push(reader.atom()?);
    }
    if reader.offset != bytes.len() {
        return Err(CollabError::InvalidEncoding);
    }
    Ok(EditCapture {
        document,
        scope,
        after,
        targets,
    })
}
