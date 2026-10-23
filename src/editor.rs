//! Paragraph-only editing model. Offsets are UTF-8 byte boundaries, not graphemes.
use crate::position::PositionError;
use std::rc::Rc;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
pub struct NodeId(pub u64);

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Paragraph {
    pub id: NodeId,
    pub text: Rc<str>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TextPosition {
    pub node_id: NodeId,
    pub byte_offset: usize,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Affinity {
    Before,
    After,
}

/// Anchor/focus order preserves backward selections.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Selection {
    pub anchor: TextPosition,
    pub focus: TextPosition,
}

impl Selection {
    pub fn collapsed(position: TextPosition) -> Self {
        Self {
            anchor: position,
            focus: position,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EditError {
    StaleRevision { expected: u64, actual: u64 },
    UnknownNode(NodeId),
    InvalidPosition(PositionError),
    ReversedRange,
    CounterOverflow,
    NoHistory,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Document {
    paragraphs: Vec<Paragraph>,
}

impl Document {
    pub fn paragraphs(&self) -> &[Paragraph] {
        &self.paragraphs
    }

    /// Plain text interchange for the foundation; this is not a Markdown serializer.
    pub fn plain_text(&self) -> String {
        self.paragraphs
            .iter()
            .map(|node| node.text.as_ref())
            .collect::<Vec<_>>()
            .join("\n")
    }

    pub fn start(&self) -> TextPosition {
        TextPosition {
            node_id: self.paragraphs[0].id,
            byte_offset: 0,
        }
    }

    pub fn end(&self) -> TextPosition {
        let node = self.paragraphs.last().unwrap();
        TextPosition {
            node_id: node.id,
            byte_offset: node.text.len(),
        }
    }

    pub fn absolute_offset(&self, position: TextPosition) -> Result<usize, EditError> {
        let mut offset = 0;
        for node in &self.paragraphs {
            if node.id == position.node_id {
                if position.byte_offset > node.text.len() {
                    return Err(EditError::InvalidPosition(PositionError::OutOfBounds));
                }
                if !node.text.is_char_boundary(position.byte_offset) {
                    return Err(EditError::InvalidPosition(PositionError::InsideCodePoint));
                }
                return Ok(offset + position.byte_offset);
            }
            offset += node.text.len() + 1;
        }
        Err(EditError::UnknownNode(position.node_id))
    }

    pub fn position_at(&self, mut offset: usize) -> Result<TextPosition, EditError> {
        for node in &self.paragraphs {
            if offset <= node.text.len() {
                if !node.text.is_char_boundary(offset) {
                    return Err(EditError::InvalidPosition(PositionError::InsideCodePoint));
                }
                return Ok(TextPosition {
                    node_id: node.id,
                    byte_offset: offset,
                });
            }
            offset -= node.text.len() + 1;
        }
        Err(EditError::InvalidPosition(PositionError::OutOfBounds))
    }

    fn validate_selection(&self, selection: Selection) -> Result<(), EditError> {
        self.absolute_offset(selection.anchor)?;
        self.absolute_offset(selection.focus)?;
        Ok(())
    }
}

/// Range coordinates refer to the document after all preceding steps in this transaction.
#[derive(Clone, Debug)]
pub struct ReplaceText {
    pub start: TextPosition,
    pub end: TextPosition,
    pub text: String,
}

#[derive(Clone, Debug)]
pub struct Transaction {
    pub expected_revision: u64,
    pub steps: Vec<ReplaceText>,
    /// Optional final selection, expressed in the resulting document's coordinates.
    pub selection: Option<Selection>,
}

#[derive(Clone, Debug)]
struct OffsetChange {
    start: usize,
    end: usize,
    inserted: usize,
}

/// Maps saved logical positions (including menu selections) through a transaction.
/// Snapshots are deliberately temporary until a persistent document store is implemented.
#[derive(Clone, Debug)]
pub struct PositionMap {
    before: Document,
    after: Document,
    changes: Vec<OffsetChange>,
}

impl PositionMap {
    pub fn map_position(
        &self,
        position: TextPosition,
        affinity: Affinity,
    ) -> Result<TextPosition, EditError> {
        let mut offset = self.before.absolute_offset(position)?;
        for change in &self.changes {
            offset = map_offset(offset, change, affinity);
        }
        self.after.position_at(offset)
    }

    pub fn map_selection(
        &self,
        selection: Selection,
        affinity: Affinity,
    ) -> Result<Selection, EditError> {
        Ok(Selection {
            anchor: self.map_position(selection.anchor, affinity)?,
            focus: self.map_position(selection.focus, affinity)?,
        })
    }
}

fn map_offset(offset: usize, change: &OffsetChange, affinity: Affinity) -> usize {
    if offset < change.start {
        offset
    } else if offset > change.end {
        offset - (change.end - change.start) + change.inserted
    } else if affinity == Affinity::Before {
        change.start
    } else {
        change.start + change.inserted
    }
}

#[derive(Clone, Debug)]
pub struct EditResult {
    pub revision: u64,
    pub changed_nodes: Vec<NodeId>,
    pub removed_nodes: Vec<NodeId>,
    pub position_map: PositionMap,
}

#[derive(Clone)]
struct Snapshot {
    document: Document,
    selection: Selection,
}

struct HistoryEntry {
    before: Snapshot,
    after: Snapshot,
    changes: Vec<OffsetChange>,
}

pub struct Editor {
    state: Snapshot,
    revision: u64,
    next_node_id: u64,
    undo: Vec<HistoryEntry>,
    redo: Vec<HistoryEntry>,
}

impl Default for Editor {
    fn default() -> Self {
        let document = Document {
            paragraphs: vec![Paragraph {
                id: NodeId(1),
                text: Rc::from(""),
            }],
        };
        let selection = Selection::collapsed(document.start());
        Self {
            state: Snapshot {
                document,
                selection,
            },
            revision: 0,
            next_node_id: 2,
            undo: Vec::new(),
            redo: Vec::new(),
        }
    }
}

impl Editor {
    /// Loads plain Markdown source without adding an undo entry.
    pub fn from_source(source: &str) -> Self {
        let paragraphs: Vec<_> = source
            .split('\n')
            .enumerate()
            .map(|(index, text)| Paragraph {
                id: NodeId(index as u64 + 1),
                text: Rc::from(text),
            })
            .collect();
        let next_node_id = paragraphs.len() as u64 + 1;
        let document = Document { paragraphs };
        let selection = Selection::collapsed(document.start());
        Self {
            state: Snapshot {
                document,
                selection,
            },
            revision: 0,
            next_node_id,
            undo: Vec::new(),
            redo: Vec::new(),
        }
    }

    /// Document replacement invalidates old revisions and IDs and clears history.
    pub fn load_source(&mut self, source: &str) -> Result<(), EditError> {
        let revision = self
            .revision
            .checked_add(1)
            .ok_or(EditError::CounterOverflow)?;
        let mut next_id = self.next_node_id;
        let mut paragraphs = Vec::new();
        for text in source.split('\n') {
            let id = NodeId(next_id);
            next_id = next_id.checked_add(1).ok_or(EditError::CounterOverflow)?;
            paragraphs.push(Paragraph {
                id,
                text: Rc::from(text),
            });
        }
        let document = Document { paragraphs };
        let selection = Selection::collapsed(document.start());
        self.state = Snapshot {
            document,
            selection,
        };
        self.next_node_id = next_id;
        self.revision = revision;
        self.undo.clear();
        self.redo.clear();
        Ok(())
    }

    pub fn document(&self) -> &Document {
        &self.state.document
    }
    pub fn selection(&self) -> Selection {
        self.state.selection
    }
    pub fn revision(&self) -> u64 {
        self.revision
    }
    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }
    pub fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }

    /// Selection-only changes do not create undo history or change the document revision.
    pub fn set_selection(&mut self, selection: Selection) -> Result<(), EditError> {
        self.state.document.validate_selection(selection)?;
        self.state.selection = selection;
        Ok(())
    }

    pub fn finalize_selection(&mut self, selection: Selection) -> Result<(), EditError> {
        self.state.document.validate_selection(selection)?;
        if let Some(entry) = self.undo.last_mut() {
            if entry.after.document == self.state.document {
                entry.after.selection = selection;
            }
        }
        self.state.selection = selection;
        Ok(())
    }

    pub fn replace_selection(&mut self, text: &str) -> Result<EditResult, EditError> {
        let selection = self.selection();
        let anchor = self.document().absolute_offset(selection.anchor)?;
        let focus = self.document().absolute_offset(selection.focus)?;
        let (start, end) = if anchor <= focus {
            (selection.anchor, selection.focus)
        } else {
            (selection.focus, selection.anchor)
        };
        self.apply(Transaction {
            expected_revision: self.revision,
            steps: vec![ReplaceText {
                start,
                end,
                text: text.into(),
            }],
            selection: None,
        })
    }

    pub fn split_paragraph(&mut self) -> Result<EditResult, EditError> {
        self.replace_selection("\n")
    }

    pub fn apply(&mut self, transaction: Transaction) -> Result<EditResult, EditError> {
        self.apply_with_caret(transaction, None)
    }

    /// A command can replace a range other than the user's selection while retaining
    /// that original selection in undo history (for example, rewriting a table).
    pub fn replace_range(
        &mut self,
        expected_revision: u64,
        start: usize,
        end: usize,
        text: &str,
    ) -> Result<EditResult, EditError> {
        self.check_revision(expected_revision)?;
        let from = self.document().position_at(start)?;
        let to = self.document().position_at(end)?;
        self.apply_with_caret(
            Transaction {
                expected_revision,
                steps: vec![ReplaceText {
                    start: from,
                    end: to,
                    text: text.into(),
                }],
                selection: None,
            },
            Some(start + text.len()),
        )
    }

    fn apply_with_caret(
        &mut self,
        transaction: Transaction,
        caret: Option<usize>,
    ) -> Result<EditResult, EditError> {
        self.check_revision(transaction.expected_revision)?;
        let before = self.state.clone();
        let mut candidate = before.clone();
        let mut next_id = self.next_node_id;
        let mut changes = Vec::new();
        for step in transaction.steps {
            let change = replace(&mut candidate.document, &step, &mut next_id)?;
            changes.push(change);
        }
        let position_map = PositionMap {
            before: before.document.clone(),
            after: candidate.document.clone(),
            changes,
        };
        candidate.selection = if let Some(offset) = caret {
            Selection::collapsed(candidate.document.position_at(offset)?)
        } else {
            match transaction.selection {
                Some(selection) => {
                    candidate.document.validate_selection(selection)?;
                    selection
                }
                None => position_map.map_selection(before.selection, Affinity::After)?,
            }
        };
        let document_changed = before.document != candidate.document;
        let revision = if document_changed {
            self.revision
                .checked_add(1)
                .ok_or(EditError::CounterOverflow)?
        } else {
            self.revision
        };
        let result = edit_result(revision, position_map);
        if document_changed {
            self.undo.push(HistoryEntry {
                before,
                after: candidate.clone(),
                changes: result.position_map.changes.clone(),
            });
            self.redo.clear();
            if self.undo.len() > 200 {
                self.undo.remove(0);
            }
        }
        self.state = candidate;
        self.next_node_id = next_id;
        self.revision = revision;
        Ok(result)
    }

    /// Explicitly joins two adjacent local history entries without changing source/revision.
    /// The input adapter decides time, caret and input-kind boundaries.
    pub fn coalesce_history(&mut self, expected_revision: u64) -> Result<(), EditError> {
        self.check_revision(expected_revision)?;
        if self.redo.is_empty() && self.undo.len() >= 2 {
            let newest = self.undo.pop().unwrap();
            let previous = self.undo.last_mut().unwrap();
            previous.after = newest.after;
            previous.changes.extend(newest.changes);
        }
        Ok(())
    }

    pub fn undo(&mut self, expected_revision: u64) -> Result<EditResult, EditError> {
        self.restore_history(expected_revision, false)
    }

    pub fn redo(&mut self, expected_revision: u64) -> Result<EditResult, EditError> {
        self.restore_history(expected_revision, true)
    }

    /// Replaces an automatic conversion with literal source as an undo operation.
    /// Redo restores the converted source and its selection, not an intermediate keystroke.
    pub fn undo_autoformat(
        &mut self,
        expected_revision: u64,
        start: usize,
        end: usize,
        literal: &str,
    ) -> Result<EditResult, EditError> {
        self.check_revision(expected_revision)?;
        if self.undo.is_empty() {
            return Err(EditError::NoHistory);
        }
        let revision = self
            .revision
            .checked_add(1)
            .ok_or(EditError::CounterOverflow)?;
        let converted = self.state.clone();
        let mut target = converted.clone();
        let mut next_id = self.next_node_id;
        let step = ReplaceText {
            start: target.document.position_at(start)?,
            end: target.document.position_at(end)?,
            text: literal.into(),
        };
        let change = replace(&mut target.document, &step, &mut next_id)?;
        target.selection =
            Selection::collapsed(target.document.position_at(start + literal.len())?);
        let result = edit_result(
            revision,
            PositionMap {
                before: converted.document.clone(),
                after: target.document.clone(),
                changes: vec![change],
            },
        );
        self.undo.pop();
        self.redo.clear();
        self.redo.push(HistoryEntry {
            before: target.clone(),
            after: converted,
            changes: vec![OffsetChange {
                start,
                end: start + literal.len(),
                inserted: end - start,
            }],
        });
        self.state = target;
        self.next_node_id = next_id;
        self.revision = revision;
        Ok(result)
    }

    fn check_revision(&self, expected: u64) -> Result<(), EditError> {
        if expected != self.revision {
            return Err(EditError::StaleRevision {
                expected,
                actual: self.revision,
            });
        }
        Ok(())
    }

    fn restore_history(&mut self, expected: u64, redo: bool) -> Result<EditResult, EditError> {
        self.check_revision(expected)?;
        let revision = self
            .revision
            .checked_add(1)
            .ok_or(EditError::CounterOverflow)?;
        let entry = if redo {
            self.redo.last()
        } else {
            self.undo.last()
        }
        .ok_or(EditError::NoHistory)?;
        let target = if redo { &entry.after } else { &entry.before };
        let before = self.document().clone();
        let after = target.document.clone();
        let changes = if redo {
            entry.changes.clone()
        } else {
            entry
                .changes
                .iter()
                .rev()
                .map(|change| OffsetChange {
                    start: change.start,
                    end: change.start + change.inserted,
                    inserted: change.end - change.start,
                })
                .collect()
        };
        let result = edit_result(
            revision,
            PositionMap {
                before,
                after,
                changes,
            },
        );
        self.state = target.clone();
        let entry = if redo {
            self.redo.pop().unwrap()
        } else {
            self.undo.pop().unwrap()
        };
        if redo {
            self.undo.push(entry);
        } else {
            self.redo.push(entry);
        }
        self.revision = revision;
        Ok(result)
    }
}

fn replace(
    document: &mut Document,
    step: &ReplaceText,
    next_id: &mut u64,
) -> Result<OffsetChange, EditError> {
    let start = document.absolute_offset(step.start)?;
    let end = document.absolute_offset(step.end)?;
    if start > end {
        return Err(EditError::ReversedRange);
    }
    let start_index = document
        .paragraphs
        .iter()
        .position(|node| node.id == step.start.node_id)
        .unwrap();
    let end_index = document
        .paragraphs
        .iter()
        .position(|node| node.id == step.end.node_id)
        .unwrap();
    let first = &document.paragraphs[start_index];
    let last = &document.paragraphs[end_index];
    let combined = format!(
        "{}{}{}",
        &first.text[..step.start.byte_offset],
        step.text,
        &last.text[step.end.byte_offset..]
    );
    let parts: Vec<_> = combined.split('\n').collect();
    let mut nodes = Vec::new();
    for (index, text) in parts.iter().enumerate() {
        let id = if index == 0 {
            first.id
        } else if index == parts.len() - 1 && start_index != end_index {
            last.id
        } else {
            let id = NodeId(*next_id);
            *next_id = next_id.checked_add(1).ok_or(EditError::CounterOverflow)?;
            id
        };
        nodes.push(Paragraph {
            id,
            text: (*text).into(),
        });
    }
    document.paragraphs.splice(start_index..=end_index, nodes);
    Ok(OffsetChange {
        start,
        end,
        inserted: step.text.len(),
    })
}

fn edit_result(revision: u64, position_map: PositionMap) -> EditResult {
    let before: std::collections::HashMap<_, _> = position_map
        .before
        .paragraphs
        .iter()
        .map(|node| (node.id, node))
        .collect();
    let after: std::collections::HashSet<_> = position_map
        .after
        .paragraphs
        .iter()
        .map(|node| node.id)
        .collect();
    let changed_nodes = position_map
        .after
        .paragraphs
        .iter()
        .filter(|node| before.get(&node.id).is_none_or(|old| **old != **node))
        .map(|node| node.id)
        .collect();
    let removed_nodes = position_map
        .before
        .paragraphs
        .iter()
        .filter(|node| !after.contains(&node.id))
        .map(|node| node.id)
        .collect();
    EditResult {
        revision,
        changed_nodes,
        removed_nodes,
        position_map,
    }
}
