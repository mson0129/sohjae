//! Collaboration core for the frozen SCV2 codec v2/schema v1; Rust internals are not a public API.
//! An operation-based replicated sequence with explicit causal dependencies.
pub mod abi;
mod codec;
mod projection;
mod sequence;
pub use codec::{
    decode_anchor, decode_capture, decode_update, encode_anchor, encode_capture, encode_update,
};
pub use projection::{ProjectedCell, ProjectedTable, Projection};
use sequence::Sequence;
use std::collections::{BTreeMap, BTreeSet};

pub const PROTOCOL_VERSION: u16 = 2;
pub const MAX_TEXT_BYTES: usize = 1024 * 1024;
pub const MAX_PENDING: usize = 4096;
pub const MAX_LOG: usize = 100_000;

/// A replica identity, not a human user ID. Hosts must allocate a distinct random ID
/// for every independent writer and bind it to an authenticated transport identity.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ActorId(pub u128);
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct DocumentId(pub u128);
/// Lamport timestamp followed by replica identity defines a deterministic total order.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct OpId {
    pub counter: u64,
    pub actor: ActorId,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct AtomId {
    pub operation: OpId,
    pub offset: u32,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum TextScope {
    Document,
    Cell {
        table: OpId,
        row: OpId,
        column: OpId,
    },
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Alignment {
    Left,
    Center,
    Right,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum OperationKind {
    InsertText {
        scope: TextScope,
        after: Option<AtomId>,
        text: String,
    },
    DeleteText {
        scope: TextScope,
        targets: Vec<AtomId>,
    },
    CreateTable {
        after: Option<AtomId>,
    },
    InsertRow {
        table: OpId,
        after: Option<OpId>,
    },
    InsertColumn {
        table: OpId,
        after: Option<OpId>,
    },
    DeleteRow {
        table: OpId,
        row: OpId,
    },
    DeleteColumn {
        table: OpId,
        column: OpId,
    },
    SetAlignment {
        table: OpId,
        column: OpId,
        alignment: Alignment,
    },
    Reorder {
        table: OpId,
        columns: bool,
        targets: Vec<OpId>,
        before: Option<OpId>,
    },
    SetActive {
        target: OpId,
        active: bool,
    },
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Operation {
    pub id: OpId,
    pub dependencies: Vec<OpId>,
    pub kind: OperationKind,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Update {
    pub document: DocumentId,
    pub operations: Vec<Operation>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CollabError {
    InvalidIdentity,
    WrongDocument,
    InvalidOperation,
    IdCollision(OpId),
    MissingReference,
    NonCausalReference,
    InvalidBoundary,
    ProjectionDraft,
    UnknownTable,
    UnknownRow,
    UnknownColumn,
    WrongOwner,
    CounterOverflow,
    NoHistory,
    ResourceLimit,
    InvalidEncoding,
    UnsupportedVersion,
}
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct MergeReport {
    pub applied: usize,
    pub duplicates: usize,
    pub pending: usize,
    pub rejected: Vec<(OpId, CollabError)>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Bias {
    Before,
    After,
}
/// A gap bounded by stable atom IDs. Tombstoned atoms remain valid anchors.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Anchor {
    pub scope: TextScope,
    pub left: Option<AtomId>,
    pub right: Option<AtomId>,
    pub bias: Bias,
}
/// A local input intent captured before IME/native DOM editing starts.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EditCapture {
    pub document: DocumentId,
    pub scope: TextScope,
    pub after: Option<AtomId>,
    pub targets: Vec<AtomId>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CellView {
    pub row: OpId,
    pub column: OpId,
    pub text: String,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TableView {
    pub id: OpId,
    pub rows: Vec<OpId>,
    pub columns: Vec<OpId>,
    pub alignments: Vec<Alignment>,
    pub cells: Vec<CellView>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum AtomValue {
    Character(char),
    Table(OpId),
}
#[derive(Clone, Default)]
struct Table {
    rows: Sequence<OpId, ()>,
    columns: Sequence<OpId, ()>,
    deleted_rows: BTreeMap<OpId, BTreeSet<OpId>>,
    deleted_columns: BTreeMap<OpId, BTreeSet<OpId>>,
    alignments: BTreeMap<OpId, BTreeMap<OpId, Alignment>>,
    row_moves: BTreeMap<OpId, (Vec<OpId>, Option<OpId>)>,
    column_moves: BTreeMap<OpId, (Vec<OpId>, Option<OpId>)>,
}
#[derive(Clone)]
struct Action {
    operations: Vec<OpId>,
}

/// Changes are merged independently of transport and Markdown rendering.
#[derive(Clone)]
pub struct Replica {
    document: DocumentId,
    actor: ActorId,
    clock: u64,
    log: BTreeMap<OpId, Operation>,
    pending: BTreeMap<OpId, Operation>,
    rejected: BTreeSet<OpId>,
    frontier: BTreeSet<OpId>,
    texts: BTreeMap<TextScope, Sequence<AtomId, AtomValue>>,
    deleted_text: BTreeMap<AtomId, BTreeSet<OpId>>,
    tables: BTreeMap<OpId, Table>,
    toggles: BTreeMap<OpId, BTreeMap<OpId, bool>>,
    undo: Vec<Action>,
    redo: Vec<Action>,
}
impl Replica {
    pub fn new(document: DocumentId, actor: ActorId) -> Result<Self, CollabError> {
        if document.0 == 0 || actor.0 == 0 {
            return Err(CollabError::InvalidIdentity);
        }
        let mut texts = BTreeMap::new();
        texts.insert(TextScope::Document, Sequence::default());
        Ok(Self {
            document,
            actor,
            clock: 0,
            log: BTreeMap::new(),
            pending: BTreeMap::new(),
            rejected: BTreeSet::new(),
            frontier: BTreeSet::new(),
            texts,
            deleted_text: BTreeMap::new(),
            tables: BTreeMap::new(),
            toggles: BTreeMap::new(),
            undo: Vec::new(),
            redo: Vec::new(),
        })
    }
    pub fn document_id(&self) -> DocumentId {
        self.document
    }
    pub fn actor_id(&self) -> ActorId {
        self.actor
    }
    pub fn frontier(&self) -> Vec<OpId> {
        self.frontier.iter().copied().collect()
    }
    pub fn pending_count(&self) -> usize {
        self.pending.len()
    }
    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }
    pub fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }
    pub fn operation_count(&self) -> usize {
        self.log.len()
    }
    pub fn export_all(&self) -> Update {
        Update {
            document: self.document,
            operations: self
                .log
                .values()
                .cloned()
                .chain(self.pending.values().cloned())
                .collect(),
        }
    }
    pub fn changes_since(&self, frontier: &[OpId]) -> Update {
        let known = self.ancestors(frontier);
        Update {
            document: self.document,
            operations: self
                .log
                .iter()
                .filter(|(id, _)| !known.contains(id))
                .map(|(_, op)| op.clone())
                .collect(),
        }
    }
    fn ancestors(&self, roots: &[OpId]) -> BTreeSet<OpId> {
        let mut seen = BTreeSet::new();
        let mut stack = roots.to_vec();
        while let Some(id) = stack.pop() {
            if let Some(operation) = self.log.get(&id) {
                if seen.insert(id) {
                    stack.extend(&operation.dependencies);
                }
            }
        }
        seen
    }
    /// The update is staged so malformed envelopes or ID collisions never partially mutate state.
    /// Semantically invalid ready operations are quarantined and reported, so a buffered bad
    /// operation cannot prevent a later valid dependency from being merged.
    pub fn merge(&mut self, update: &Update) -> Result<MergeReport, CollabError> {
        if update.document != self.document {
            return Err(CollabError::WrongDocument);
        }
        let mut candidate = self.clone();
        let mut report = MergeReport::default();
        let mut incoming: Vec<_> = update.operations.iter().collect();
        incoming.sort_by_key(|operation| operation.id);
        for operation in incoming {
            validate_envelope(operation)?;
            if let Some(existing) = candidate
                .log
                .get(&operation.id)
                .or_else(|| candidate.pending.get(&operation.id))
            {
                if existing != operation {
                    return Err(CollabError::IdCollision(operation.id));
                }
                report.duplicates += 1;
                continue;
            }
            if candidate.rejected.contains(&operation.id) {
                report
                    .rejected
                    .push((operation.id, CollabError::InvalidOperation));
                continue;
            }
            if candidate.log.len() + candidate.pending.len() >= MAX_LOG {
                return Err(CollabError::ResourceLimit);
            }
            candidate.clock = candidate.clock.max(operation.id.counter);
            if operation
                .dependencies
                .iter()
                .all(|id| candidate.log.contains_key(id))
            {
                match candidate.apply_ready(operation) {
                    Ok(()) => {
                        report.applied += 1;
                    }
                    Err(error) => {
                        candidate.rejected.insert(operation.id);
                        report.rejected.push((operation.id, error));
                    }
                }
                continue;
            }
            if candidate.pending.len() >= MAX_PENDING
                || candidate.log.len() + candidate.pending.len() >= MAX_LOG
            {
                return Err(CollabError::ResourceLimit);
            }
            candidate.pending.insert(operation.id, operation.clone());
        }
        loop {
            let ready: Vec<_> = candidate
                .pending
                .values()
                .filter(|op| {
                    op.dependencies
                        .iter()
                        .all(|id| candidate.log.contains_key(id))
                        || op
                            .dependencies
                            .iter()
                            .any(|id| candidate.rejected.contains(id))
                })
                .map(|op| op.id)
                .collect();
            if ready.is_empty() {
                break;
            }
            for id in ready {
                let operation = candidate.pending.remove(&id).unwrap();
                let result = if operation
                    .dependencies
                    .iter()
                    .any(|id| candidate.rejected.contains(id))
                {
                    Err(CollabError::MissingReference)
                } else {
                    candidate.apply_ready(&operation)
                };
                match result {
                    Ok(()) => {
                        report.applied += 1;
                    }
                    Err(error) => {
                        candidate.rejected.insert(id);
                        report.rejected.push((id, error));
                    }
                }
            }
        }
        if candidate.rejected.len() > MAX_PENDING {
            return Err(CollabError::ResourceLimit);
        }
        report.pending = candidate.pending.len();
        *self = candidate;
        Ok(report)
    }
    fn is_active(&self, id: OpId) -> bool {
        self.toggles
            .get(&id)
            .and_then(BTreeMap::last_key_value)
            .is_none_or(|(_, active)| *active)
    }
    fn has_active_delete(&self, deletes: Option<&BTreeSet<OpId>>) -> bool {
        deletes.is_some_and(|ids| ids.iter().any(|id| self.is_active(*id)))
    }
    fn atom_visible(&self, id: AtomId) -> bool {
        self.is_active(id.operation) && !self.has_active_delete(self.deleted_text.get(&id))
    }
    fn scope_exists(&self, scope: TextScope) -> Result<(), CollabError> {
        match scope {
            TextScope::Document => Ok(()),
            TextScope::Cell { table, row, column } => {
                let table = self.tables.get(&table).ok_or(CollabError::UnknownTable)?;
                if !table.rows.contains(row) {
                    return Err(CollabError::UnknownRow);
                }
                if !table.columns.contains(column) {
                    return Err(CollabError::UnknownColumn);
                }
                Ok(())
            }
        }
    }
    fn apply_ready(&mut self, operation: &Operation) -> Result<(), CollabError> {
        let ancestors = self.ancestors(&operation.dependencies);
        let require = |id: OpId| {
            if ancestors.contains(&id) {
                Ok(())
            } else {
                Err(CollabError::NonCausalReference)
            }
        };
        let scope_require = |scope: TextScope| -> Result<(), CollabError> {
            if let TextScope::Cell { table, row, column } = scope {
                require(table)?;
                require(row)?;
                require(column)?;
            }
            self.scope_exists(scope)
        };
        let id = operation.id;
        match &operation.kind {
            OperationKind::InsertText { scope, after, text } => {
                scope_require(*scope)?;
                if let Some(anchor) = after {
                    require(anchor.operation)?;
                    if !self
                        .texts
                        .get(scope)
                        .is_some_and(|sequence| sequence.contains(*anchor))
                    {
                        return Err(CollabError::MissingReference);
                    }
                }
                let sequence = self.texts.entry(*scope).or_default();
                let mut parent = *after;
                for (offset, character) in text.chars().enumerate() {
                    let atom = AtomId {
                        operation: id,
                        offset: offset as u32,
                    };
                    sequence.insert(atom, parent, AtomValue::Character(character));
                    parent = Some(atom);
                }
            }
            OperationKind::DeleteText { scope, targets } => {
                scope_require(*scope)?;
                for target in targets {
                    require(target.operation)?;
                    if !self
                        .texts
                        .get(scope)
                        .is_some_and(|sequence| sequence.contains(*target))
                    {
                        return Err(CollabError::MissingReference);
                    }
                }
                for target in targets {
                    self.deleted_text.entry(*target).or_default().insert(id);
                }
            }
            OperationKind::CreateTable { after } => {
                if let Some(anchor) = after {
                    require(anchor.operation)?;
                    if !self.texts[&TextScope::Document].contains(*anchor) {
                        return Err(CollabError::MissingReference);
                    }
                }
                self.tables.insert(id, Table::default());
                self.texts.get_mut(&TextScope::Document).unwrap().insert(
                    AtomId {
                        operation: id,
                        offset: 0,
                    },
                    *after,
                    AtomValue::Table(id),
                );
            }
            OperationKind::InsertRow { table, after } => {
                require(*table)?;
                if let Some(row) = after {
                    require(*row)?;
                }
                let table = self
                    .tables
                    .get_mut(table)
                    .ok_or(CollabError::UnknownTable)?;
                if after.is_some_and(|row| !table.rows.contains(row)) {
                    return Err(CollabError::UnknownRow);
                }
                table.rows.insert(id, *after, ());
            }
            OperationKind::InsertColumn { table, after } => {
                require(*table)?;
                if let Some(column) = after {
                    require(*column)?;
                }
                let table = self
                    .tables
                    .get_mut(table)
                    .ok_or(CollabError::UnknownTable)?;
                if after.is_some_and(|column| !table.columns.contains(column)) {
                    return Err(CollabError::UnknownColumn);
                }
                table.columns.insert(id, *after, ());
            }
            OperationKind::DeleteRow { table, row } => {
                require(*table)?;
                require(*row)?;
                let table = self
                    .tables
                    .get_mut(table)
                    .ok_or(CollabError::UnknownTable)?;
                if !table.rows.contains(*row) {
                    return Err(CollabError::UnknownRow);
                }
                table.deleted_rows.entry(*row).or_default().insert(id);
            }
            OperationKind::DeleteColumn { table, column } => {
                require(*table)?;
                require(*column)?;
                let table = self
                    .tables
                    .get_mut(table)
                    .ok_or(CollabError::UnknownTable)?;
                if !table.columns.contains(*column) {
                    return Err(CollabError::UnknownColumn);
                }
                table.deleted_columns.entry(*column).or_default().insert(id);
            }
            OperationKind::SetAlignment {
                table,
                column,
                alignment,
            } => {
                require(*table)?;
                require(*column)?;
                let table = self
                    .tables
                    .get_mut(table)
                    .ok_or(CollabError::UnknownTable)?;
                if !table.columns.contains(*column) {
                    return Err(CollabError::UnknownColumn);
                }
                table
                    .alignments
                    .entry(*column)
                    .or_default()
                    .insert(id, *alignment);
            }
            OperationKind::Reorder {
                table,
                columns,
                targets,
                before,
            } => {
                require(*table)?;
                for target in targets.iter().chain(before.iter()) {
                    require(*target)?;
                }
                let table = self
                    .tables
                    .get_mut(table)
                    .ok_or(CollabError::UnknownTable)?;
                let sequence = if *columns {
                    &table.columns
                } else {
                    &table.rows
                };
                if targets
                    .iter()
                    .chain(before.iter())
                    .any(|target| !sequence.contains(*target))
                {
                    return Err(CollabError::MissingReference);
                }
                let moves = if *columns {
                    &mut table.column_moves
                } else {
                    &mut table.row_moves
                };
                moves.insert(id, (targets.clone(), *before));
            }
            OperationKind::SetActive { target, active } => {
                require(*target)?;
                if target.actor != id.actor {
                    return Err(CollabError::WrongOwner);
                }
                if self
                    .log
                    .get(target)
                    .is_none_or(|op| matches!(op.kind, OperationKind::SetActive { .. }))
                {
                    return Err(CollabError::InvalidOperation);
                }
                self.toggles.entry(*target).or_default().insert(id, *active);
            }
        }
        for dependency in &operation.dependencies {
            self.frontier.remove(dependency);
        }
        self.frontier.insert(id);
        self.log.insert(id, operation.clone());
        Ok(())
    }
    fn commit_one(&mut self, kind: OperationKind) -> Result<Operation, CollabError> {
        if self.log.len() + self.pending.len() >= MAX_LOG {
            return Err(CollabError::ResourceLimit);
        }
        let counter = self
            .clock
            .checked_add(1)
            .ok_or(CollabError::CounterOverflow)?;
        let operation = Operation {
            id: OpId {
                counter,
                actor: self.actor,
            },
            dependencies: self.frontier(),
            kind,
        };
        validate_envelope(&operation)?;
        self.apply_ready(&operation)?;
        self.clock = counter;
        Ok(operation)
    }
    fn local_action(&mut self, kinds: Vec<OperationKind>) -> Result<Update, CollabError> {
        let mut candidate = self.clone();
        let mut operations = Vec::new();
        for kind in kinds {
            operations.push(candidate.commit_one(kind)?);
        }
        if !operations.is_empty() {
            candidate.undo.push(Action {
                operations: operations.iter().map(|op| op.id).collect(),
            });
            candidate.redo.clear();
            if candidate.undo.len() > 200 {
                candidate.undo.remove(0);
            }
        }
        let update = Update {
            document: self.document,
            operations,
        };
        encode_update(&update)?;
        *self = candidate;
        Ok(update)
    }
    pub fn insert_text(
        &mut self,
        scope: TextScope,
        offset: usize,
        text: &str,
    ) -> Result<Update, CollabError> {
        self.replace_text(scope, offset, offset, text)
    }
    pub fn replace_text(
        &mut self,
        scope: TextScope,
        start: usize,
        end: usize,
        text: &str,
    ) -> Result<Update, CollabError> {
        let capture = self.capture_range(scope, start, end)?;
        self.replace_capture(&capture, text)
    }
    pub fn capture_range(
        &self,
        scope: TextScope,
        start: usize,
        end: usize,
    ) -> Result<EditCapture, CollabError> {
        self.scope_exists(scope)?;
        let atoms = self.visible_atoms(scope);
        let (from, to) = (text_boundary(&atoms, start)?, text_boundary(&atoms, end)?);
        if from > to {
            return Err(CollabError::InvalidBoundary);
        }
        Ok(EditCapture {
            document: self.document,
            scope,
            after: from.checked_sub(1).map(|index| atoms[index].0),
            targets: atoms[from..to].iter().map(|(id, _)| *id).collect(),
        })
    }
    pub fn replace_capture(
        &mut self,
        capture: &EditCapture,
        text: &str,
    ) -> Result<Update, CollabError> {
        if capture.document != self.document {
            return Err(CollabError::WrongDocument);
        }
        self.scope_exists(capture.scope)?;
        let mut kinds = Vec::new();
        if !capture.targets.is_empty() {
            kinds.push(OperationKind::DeleteText {
                scope: capture.scope,
                targets: capture.targets.clone(),
            });
        }
        if !text.is_empty() {
            kinds.push(OperationKind::InsertText {
                scope: capture.scope,
                after: capture.after,
                text: text.into(),
            });
        }
        self.local_action(kinds)
    }
    fn visible_atoms(&self, scope: TextScope) -> Vec<(AtomId, AtomValue)> {
        self.texts.get(&scope).map_or_else(Vec::new, |sequence| {
            sequence
                .ordered()
                .into_iter()
                .filter(|id| self.atom_visible(*id))
                .map(|id| (id, sequence.value(id).unwrap().clone()))
                .collect()
        })
    }
    /// The object replacement character represents one structural table in document coordinates.
    /// Markdown projection is a separate API; its offsets are not editing coordinates.
    pub fn text(&self, scope: TextScope) -> Result<String, CollabError> {
        self.scope_exists(scope)?;
        Ok(self
            .visible_atoms(scope)
            .iter()
            .map(|(_, value)| match value {
                AtomValue::Character(c) => *c,
                AtomValue::Table(_) => '\u{fffc}',
            })
            .collect())
    }
    pub fn anchor_at(
        &self,
        scope: TextScope,
        offset: usize,
        bias: Bias,
    ) -> Result<Anchor, CollabError> {
        self.scope_exists(scope)?;
        let atoms = self.visible_atoms(scope);
        let index = text_boundary(&atoms, offset)?;
        Ok(Anchor {
            scope,
            left: index.checked_sub(1).map(|index| atoms[index].0),
            right: atoms.get(index).map(|(id, _)| *id),
            bias,
        })
    }
    pub fn resolve_anchor(&self, anchor: Anchor) -> Result<usize, CollabError> {
        self.scope_exists(anchor.scope)?;
        let Some(sequence) = self.texts.get(&anchor.scope) else {
            return if anchor.left.is_none() && anchor.right.is_none() {
                Ok(0)
            } else {
                Err(CollabError::MissingReference)
            };
        };
        if anchor.left.is_some_and(|id| !sequence.contains(id))
            || anchor.right.is_some_and(|id| !sequence.contains(id))
        {
            return Err(CollabError::MissingReference);
        }
        let mut offset = 0;
        for id in sequence.ordered() {
            if anchor.bias == Bias::After && anchor.right == Some(id) {
                return Ok(offset);
            }
            if self.atom_visible(id) {
                offset += atom_len(sequence.value(id).unwrap());
            }
            if anchor.bias == Bias::Before && anchor.left == Some(id) {
                return Ok(offset);
            }
        }
        if anchor.bias == Bias::Before && anchor.left.is_none() {
            Ok(0)
        } else {
            Ok(offset)
        }
    }
    pub fn create_table(
        &mut self,
        offset: usize,
        rows: usize,
        columns: usize,
    ) -> Result<(OpId, Update), CollabError> {
        if rows == 0 || columns == 0 || rows > 100 || columns > 100 {
            return Err(CollabError::ResourceLimit);
        }
        let after = self
            .anchor_at(TextScope::Document, offset, Bias::Before)?
            .left;
        let mut candidate = self.clone();
        let mut operations = vec![candidate.commit_one(OperationKind::CreateTable { after })?];
        let table = operations[0].id;
        let mut previous = None;
        for _ in 0..rows {
            let operation = candidate.commit_one(OperationKind::InsertRow {
                table,
                after: previous,
            })?;
            previous = Some(operation.id);
            operations.push(operation);
        }
        previous = None;
        for _ in 0..columns {
            let operation = candidate.commit_one(OperationKind::InsertColumn {
                table,
                after: previous,
            })?;
            previous = Some(operation.id);
            operations.push(operation);
        }
        candidate.undo.push(Action {
            operations: operations.iter().map(|op| op.id).collect(),
        });
        candidate.redo.clear();
        if candidate.undo.len() > 200 {
            candidate.undo.remove(0);
        }
        let update = Update {
            document: self.document,
            operations,
        };
        encode_update(&update)?;
        *self = candidate;
        Ok((table, update))
    }
    pub fn insert_row(
        &mut self,
        table: OpId,
        after: Option<OpId>,
    ) -> Result<(OpId, Update), CollabError> {
        let update = self.local_action(vec![OperationKind::InsertRow { table, after }])?;
        Ok((update.operations[0].id, update))
    }
    pub fn insert_column(
        &mut self,
        table: OpId,
        after: Option<OpId>,
    ) -> Result<(OpId, Update), CollabError> {
        let update = self.local_action(vec![OperationKind::InsertColumn { table, after }])?;
        Ok((update.operations[0].id, update))
    }
    pub fn delete_row(&mut self, table: OpId, row: OpId) -> Result<Update, CollabError> {
        self.local_action(vec![OperationKind::DeleteRow { table, row }])
    }
    pub fn delete_column(&mut self, table: OpId, column: OpId) -> Result<Update, CollabError> {
        self.local_action(vec![OperationKind::DeleteColumn { table, column }])
    }
    pub fn set_alignment(
        &mut self,
        table: OpId,
        column: OpId,
        alignment: Alignment,
    ) -> Result<Update, CollabError> {
        self.local_action(vec![OperationKind::SetAlignment {
            table,
            column,
            alignment,
        }])
    }
    pub fn visible_tables(&self) -> Vec<OpId> {
        self.visible_atoms(TextScope::Document)
            .into_iter()
            .filter_map(|(_, value)| {
                if let AtomValue::Table(id) = value {
                    Some(id)
                } else {
                    None
                }
            })
            .collect()
    }
    // Replay active moves in Lamport/actor order. Reordering never rewrites cell text
    // or row/column identities; concurrent insertions/deletions remain independent.
    fn reordered(
        &self,
        sequence: &Sequence<OpId, ()>,
        moves: &BTreeMap<OpId, (Vec<OpId>, Option<OpId>)>,
    ) -> Vec<OpId> {
        if moves.is_empty() {
            return sequence.ordered();
        }
        let placements = sequence.placements();
        let events: BTreeSet<_> = placements.keys().chain(moves.keys()).copied().collect();
        let mut order = Vec::new();
        for id in events {
            if let Some(after) = placements.get(&id) {
                let index = after
                    .and_then(|after| order.iter().position(|item| *item == after))
                    .map_or(0, |index| index + 1);
                order.insert(index, id);
            } else if self.is_active(id) {
                let (targets, before) = &moves[&id];
                order.retain(|item| !targets.contains(item));
                let index = before
                    .and_then(|before| order.iter().position(|item| *item == before))
                    .unwrap_or(order.len());
                order.splice(index..index, targets.iter().copied());
            }
        }
        order
    }
    pub fn reorder(
        &mut self,
        table: OpId,
        columns: bool,
        targets: Vec<OpId>,
        before: Option<OpId>,
    ) -> Result<Update, CollabError> {
        let view = self.table(table)?;
        let order = if columns { view.columns } else { view.rows };
        if targets
            .iter()
            .chain(before.iter())
            .any(|id| !order.contains(id))
        {
            return Err(CollabError::InvalidBoundary);
        }
        self.local_action(vec![OperationKind::Reorder {
            table,
            columns,
            targets,
            before,
        }])
    }
    pub fn table(&self, id: OpId) -> Result<TableView, CollabError> {
        let table = self.tables.get(&id).ok_or(CollabError::UnknownTable)?;
        let rows: Vec<_> = self
            .reordered(&table.rows, &table.row_moves)
            .into_iter()
            .filter(|id| self.is_active(*id) && !self.has_active_delete(table.deleted_rows.get(id)))
            .collect();
        let columns: Vec<_> = self
            .reordered(&table.columns, &table.column_moves)
            .into_iter()
            .filter(|id| {
                self.is_active(*id) && !self.has_active_delete(table.deleted_columns.get(id))
            })
            .collect();
        let alignments = columns
            .iter()
            .map(|column| {
                table
                    .alignments
                    .get(column)
                    .and_then(|values| values.iter().rev().find(|(id, _)| self.is_active(**id)))
                    .map_or(Alignment::Left, |(_, value)| *value)
            })
            .collect();
        let mut cells = Vec::new();
        for row in &rows {
            for column in &columns {
                cells.push(CellView {
                    row: *row,
                    column: *column,
                    text: self.text(TextScope::Cell {
                        table: id,
                        row: *row,
                        column: *column,
                    })?,
                });
            }
        }
        Ok(TableView {
            id,
            rows,
            columns,
            alignments,
            cells,
        })
    }
    pub fn markdown(&self) -> String {
        self.projection().markdown
    }
    /// Joins local undo actions only; operations and remote history remain unchanged.
    pub fn coalesce_history(&mut self) {
        if self.redo.is_empty() && self.undo.len() >= 2 {
            let newest = self.undo.pop().unwrap();
            self.undo
                .last_mut()
                .unwrap()
                .operations
                .extend(newest.operations);
        }
    }
    pub fn undo(&mut self) -> Result<Update, CollabError> {
        self.toggle_history(false)
    }
    pub fn redo(&mut self) -> Result<Update, CollabError> {
        self.toggle_history(true)
    }
    fn toggle_history(&mut self, redo: bool) -> Result<Update, CollabError> {
        let mut candidate = self.clone();
        let action = if redo {
            candidate.redo.pop()
        } else {
            candidate.undo.pop()
        }
        .ok_or(CollabError::NoHistory)?;
        let mut operations = Vec::new();
        for target in &action.operations {
            operations.push(candidate.commit_one(OperationKind::SetActive {
                target: *target,
                active: redo,
            })?);
        }
        if redo {
            candidate.undo.push(action);
        } else {
            candidate.redo.push(action);
        }
        let update = Update {
            document: self.document,
            operations,
        };
        encode_update(&update)?;
        *self = candidate;
        Ok(update)
    }
}
fn atom_len(value: &AtomValue) -> usize {
    match value {
        AtomValue::Character(c) => c.len_utf8(),
        AtomValue::Table(_) => '\u{fffc}'.len_utf8(),
    }
}
fn text_boundary(atoms: &[(AtomId, AtomValue)], offset: usize) -> Result<usize, CollabError> {
    let mut current = 0;
    for (index, (_, value)) in atoms.iter().enumerate() {
        if current == offset {
            return Ok(index);
        }
        current += atom_len(value);
        if current > offset {
            return Err(CollabError::InvalidBoundary);
        }
    }
    if current == offset {
        Ok(atoms.len())
    } else {
        Err(CollabError::InvalidBoundary)
    }
}
fn validate_envelope(operation: &Operation) -> Result<(), CollabError> {
    if operation.id.counter == 0 || operation.id.actor.0 == 0 {
        return Err(CollabError::InvalidIdentity);
    }
    if operation.dependencies.len() > MAX_PENDING
        || operation.dependencies.iter().collect::<BTreeSet<_>>().len()
            != operation.dependencies.len()
        || operation
            .dependencies
            .iter()
            .any(|id| id.actor.0 == 0 || id.counter == 0 || id.counter >= operation.id.counter)
    {
        return Err(CollabError::InvalidOperation);
    }
    match &operation.kind {
        OperationKind::Reorder {
            targets, before, ..
        } if targets.is_empty()
            || targets.len() > MAX_PENDING
            || targets.iter().collect::<BTreeSet<_>>().len() != targets.len()
            || before.is_some_and(|id| targets.contains(&id)) =>
        {
            Err(CollabError::InvalidOperation)
        }
        OperationKind::InsertText { text, .. }
            if text.is_empty() || text.len() > MAX_TEXT_BYTES =>
        {
            Err(CollabError::ResourceLimit)
        }
        OperationKind::DeleteText { targets, .. }
            if targets.is_empty()
                || targets.len() > MAX_TEXT_BYTES
                || targets.iter().collect::<BTreeSet<_>>().len() != targets.len() =>
        {
            Err(CollabError::InvalidOperation)
        }
        _ => Ok(()),
    }
}
