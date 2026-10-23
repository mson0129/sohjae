//! Markdown coordinates are a projection; table cells keep their own shared IDs.
use super::*;
use crate::markdown::{parse, BlockKind};
#[derive(Clone, Debug)]
pub struct ProjectedCell {
    pub scope: TextScope,
    pub start: usize,
    pub end: usize,
    pub points: Vec<(usize, usize)>,
}
#[derive(Clone, Debug)]
pub struct ProjectedTable {
    pub id: OpId,
    pub start: usize,
    pub end: usize,
    pub document_offset: usize,
    pub cells: Vec<ProjectedCell>,
}
#[derive(Clone, Debug, Default)]
pub struct Projection {
    pub markdown: String,
    pub chunks: Vec<(usize, usize, usize)>,
    pub tables: Vec<ProjectedTable>,
}
impl Projection {
    pub fn position(&self, offset: usize) -> Result<(TextScope, usize), CollabError> {
        if !self.markdown.is_char_boundary(offset) {
            return Err(CollabError::InvalidBoundary);
        }
        for table in &self.tables {
            for cell in &table.cells {
                if offset >= cell.start && offset <= cell.end {
                    let relative = offset - cell.start;
                    let value = cell
                        .points
                        .iter()
                        .rev()
                        .find(|(source, _)| *source <= relative)
                        .map_or(0, |(_, value)| *value);
                    return Ok((cell.scope, value));
                }
            }
        }
        for (start, end, document) in &self.chunks {
            if offset >= *start && offset <= *end {
                return Ok((TextScope::Document, document + offset - start));
            }
        }
        Err(CollabError::ProjectionDraft)
    }
    pub fn offset(&self, scope: TextScope, offset: usize) -> Option<usize> {
        if scope == TextScope::Document {
            for (start, end, document) in &self.chunks {
                if offset >= *document && offset <= document + end - start {
                    return Some(start + offset - document);
                }
            }
            for table in &self.tables {
                if table.document_offset == offset {
                    return Some(table.start);
                }
                if table.document_offset + 3 == offset {
                    return Some(table.end);
                }
            }
        } else {
            for table in &self.tables {
                for cell in &table.cells {
                    if cell.scope == scope {
                        return cell
                            .points
                            .iter()
                            .rev()
                            .find(|(_, value)| *value <= offset)
                            .map(|(source, _)| cell.start + source);
                    }
                }
            }
        }
        None
    }
}
impl Replica {
    pub fn projection(&self) -> Projection {
        let mut result = Projection::default();
        let mut document_offset = 0;
        let mut chunk_start = 0;
        let mut chunk_document = 0;
        let atoms = self.visible_atoms(TextScope::Document);
        for (atom_index, (_, value)) in atoms.iter().cloned().enumerate() {
            match value {
                AtomValue::Character(c) => {
                    result.markdown.push(c);
                    document_offset += c.len_utf8();
                }
                AtomValue::Table(id) => {
                    result
                        .chunks
                        .push((chunk_start, result.markdown.len(), chunk_document));
                    let start = result.markdown.len();
                    let view = self.table(id).unwrap();
                    let mut table = ProjectedTable {
                        id,
                        start,
                        end: start,
                        document_offset,
                        cells: Vec::new(),
                    };
                    if !view.rows.is_empty() && !view.columns.is_empty() {
                        if !result.markdown.is_empty() {
                            while !result.markdown.ends_with("\n\n") {
                                result.markdown.push('\n');
                            }
                        }
                        for (index, row) in view.rows.iter().enumerate() {
                            result.markdown.push('|');
                            for column in &view.columns {
                                result.markdown.push(' ');
                                let scope = TextScope::Cell {
                                    table: id,
                                    row: *row,
                                    column: *column,
                                };
                                let text = self.text(scope).unwrap();
                                let start = result.markdown.len();
                                let mut points = vec![(0, 0)];
                                let mut slashes = 0;
                                for (offset, c) in text.char_indices() {
                                    if c == '|' && slashes % 2 == 0 {
                                        result.markdown.push('\\');
                                    }
                                    if c == '\n' {
                                        result.markdown.push_str("<br>");
                                    } else {
                                        result.markdown.push(c);
                                    }
                                    points.push((
                                        result.markdown.len() - start,
                                        offset + c.len_utf8(),
                                    ));
                                    slashes = if c == '\\' { slashes + 1 } else { 0 };
                                }
                                table.cells.push(ProjectedCell {
                                    scope,
                                    start,
                                    end: result.markdown.len(),
                                    points,
                                });
                                result.markdown.push_str(" |");
                            }
                            result.markdown.push('\n');
                            if index == 0 {
                                result.markdown.push('|');
                                for alignment in &view.alignments {
                                    result.markdown.push_str(match alignment {
                                        Alignment::Left => " --- |",
                                        Alignment::Center => " :---: |",
                                        Alignment::Right => " ---: |",
                                    });
                                }
                                result.markdown.push('\n');
                            }
                        }
                        if atoms.get(atom_index + 1).is_some_and(
                            |(_, value)| matches!(value,AtomValue::Character(c) if *c!='\n'),
                        ) {
                            result.markdown.push('\n');
                        }
                    }
                    table.end = result.markdown.len();
                    result.tables.push(table);
                    document_offset += 3;
                    chunk_start = result.markdown.len();
                    chunk_document = document_offset;
                }
            }
        }
        result
            .chunks
            .push((chunk_start, result.markdown.len(), chunk_document));
        result
    }
    /// Import only into an empty replica, so every participant shares the same seed operations.
    pub fn import_markdown(&mut self, source: &str) -> Result<Update, CollabError> {
        if !self.log.is_empty() {
            return Err(CollabError::InvalidOperation);
        }
        let mut candidate = self.clone();
        candidate.insert_markdown(0, source)?;
        self.finish_projection_action(candidate)
    }
    fn finish_projection_action(&mut self, mut candidate: Self) -> Result<Update, CollabError> {
        let update = candidate.changes_since(&self.frontier());
        candidate.undo = self.undo.clone();
        candidate.redo = self.redo.clone();
        if !update.operations.is_empty() {
            candidate.undo.push(Action {
                operations: update.operations.iter().map(|op| op.id).collect(),
            });
            if candidate.undo.len() > 200 {
                candidate.undo.remove(0);
            }
            candidate.redo.clear();
        }
        encode_update(&update)?;
        *self = candidate;
        Ok(update)
    }
    fn insert_markdown(&mut self, mut offset: usize, source: &str) -> Result<(), CollabError> {
        let mut previous = 0;
        for block in parse(source) {
            if let BlockKind::Table { rows, align } = block.kind {
                if table_overflow(&source[block.span.start..block.span.end], align.len()) {
                    continue;
                }
                let prefix = &source[previous..block.span.start];
                if !prefix.is_empty() {
                    self.insert_text(TextScope::Document, offset, prefix)?;
                    offset += prefix.len();
                }
                let (table, _) = self.create_table(offset, rows.len(), align.len())?;
                self.fill_table(
                    table,
                    &rows
                        .iter()
                        .map(|row| {
                            row.iter()
                                .map(|span| source[span.start..span.end].to_string())
                                .collect()
                        })
                        .collect::<Vec<_>>(),
                    &align,
                )?;
                offset += 3;
                previous = block.span.end + usize::from(source[block.span.end..].starts_with('\n'));
            }
        }
        if previous < source.len() {
            self.insert_text(TextScope::Document, offset, &source[previous..])?;
        }
        Ok(())
    }
    fn fill_table(
        &mut self,
        id: OpId,
        rows: &[Vec<String>],
        align: &[String],
    ) -> Result<(), CollabError> {
        let old = self.table(id)?;
        // Preserve common rows/columns. Structural toolbar commands use exact IDs;
        // source shape edits preserve matching prefix/suffix before assigning new IDs.
        let old_values: Vec<Vec<String>> = old
            .rows
            .iter()
            .map(|row| {
                old.columns
                    .iter()
                    .map(|column| {
                        old.cells
                            .iter()
                            .find(|cell| cell.row == *row && cell.column == *column)
                            .unwrap()
                            .text
                            .clone()
                    })
                    .collect()
            })
            .collect();
        let row_ids = reconcile_ids(
            &old.rows,
            &old_values,
            rows,
            |replica, after| replica.insert_row(id, after).map(|value| value.0),
            |replica, row| replica.delete_row(id, row).map(|_| ()),
            self,
        )?;
        let old_columns: Vec<Vec<String>> = (0..old.columns.len())
            .map(|column| old_values.iter().map(|row| row[column].clone()).collect())
            .collect();
        let new_columns: Vec<Vec<String>> = (0..align.len())
            .map(|column| {
                rows.iter()
                    .map(|row| row.get(column).cloned().unwrap_or_default())
                    .collect()
            })
            .collect();
        let column_ids = reconcile_ids(
            &old.columns,
            &old_columns,
            &new_columns,
            |replica, after| replica.insert_column(id, after).map(|value| value.0),
            |replica, column| replica.delete_column(id, column).map(|_| ()),
            self,
        )?;
        for (r, row) in row_ids.iter().enumerate() {
            for (c, column) in column_ids.iter().enumerate() {
                let scope = TextScope::Cell {
                    table: id,
                    row: *row,
                    column: *column,
                };
                let old_text = self.text(scope)?;
                let new_text = rows[r].get(c).map(String::as_str).unwrap_or("");
                if cell_source(&old_text) == new_text {
                    continue;
                }
                let (start, end, replacement) = text_diff(&old_text, new_text);
                if start != end || !replacement.is_empty() {
                    self.replace_text(scope, start, end, replacement)?;
                }
            }
        }
        for (index, column) in column_ids.iter().enumerate() {
            let alignment = match align[index].as_str() {
                "center" => Alignment::Center,
                "right" => Alignment::Right,
                _ => Alignment::Left,
            };
            if self.table(id)?.alignments[index] != alignment {
                self.set_alignment(id, *column, alignment)?;
            }
        }
        Ok(())
    }
    fn promote_tables(&mut self) -> Result<(), CollabError> {
        let source = self.text(TextScope::Document)?;
        for block in parse(&source).into_iter().rev() {
            if let BlockKind::Table { rows, align } = block.kind {
                if table_overflow(&source[block.span.start..block.span.end], align.len()) {
                    continue;
                }
                if source[block.span.start..block.span.end].contains('\u{fffc}') {
                    continue;
                }
                let values = rows
                    .iter()
                    .map(|row| {
                        row.iter()
                            .map(|span| source[span.start..span.end].to_string())
                            .collect()
                    })
                    .collect::<Vec<_>>();
                self.replace_text(TextScope::Document, block.span.start, block.span.end, "")?;
                let (id, _) = self.create_table(block.span.start, rows.len(), align.len())?;
                self.fill_table(id, &values, &align)?;
            }
        }
        Ok(())
    }
    pub fn table_action(
        &mut self,
        id: OpId,
        action: u8,
        row: usize,
        column: usize,
        range: [usize; 4],
    ) -> Result<Update, CollabError> {
        let view = self.table(id)?;
        if row >= view.rows.len()
            || column >= view.columns.len()
            || range[0] > range[1]
            || range[2] > range[3]
            || range[1] >= view.rows.len()
            || range[3] >= view.columns.len()
        {
            return Err(CollabError::InvalidBoundary);
        }
        let mut candidate = self.clone();
        match action {
            0 | 1 => {
                let index = if action == 0 { row.max(1) } else { row + 1 };
                candidate.insert_row(id, index.checked_sub(1).map(|index| view.rows[index]))?;
            }
            2 | 3 => {
                let index = column + usize::from(action == 3);
                candidate
                    .insert_column(id, index.checked_sub(1).map(|index| view.columns[index]))?;
            }
            4 => {
                for index in range[0]..=range[1] {
                    candidate.delete_row(id, view.rows[index])?;
                }
            }
            5 => {
                for index in range[2]..=range[3] {
                    candidate.delete_column(id, view.columns[index])?;
                }
            }
            6 => {
                for row in &view.rows[range[0]..=range[1]] {
                    for column in &view.columns[range[2]..=range[3]] {
                        let scope = TextScope::Cell {
                            table: id,
                            row: *row,
                            column: *column,
                        };
                        let length = candidate.text(scope)?.len();
                        if length != 0 {
                            candidate.replace_text(scope, 0, length, "")?;
                        }
                    }
                }
            }
            7..=9 => {
                for column in &view.columns[range[2]..=range[3]] {
                    candidate.set_alignment(
                        id,
                        *column,
                        match action {
                            8 => Alignment::Center,
                            9 => Alignment::Right,
                            _ => Alignment::Left,
                        },
                    )?;
                }
            }
            10 => {
                let offset = candidate
                    .projection()
                    .tables
                    .iter()
                    .find(|table| table.id == id)
                    .ok_or(CollabError::UnknownTable)?
                    .document_offset;
                candidate.replace_text(TextScope::Document, offset, offset + 3, "")?;
            }
            _ => return Err(CollabError::InvalidOperation),
        }
        self.finish_projection_action(candidate)
    }
    pub fn replace_markdown(
        &mut self,
        start: usize,
        end: usize,
        text: &str,
    ) -> Result<Update, CollabError> {
        self.replace_projection(start, end, text, true)
    }
    pub fn replace_projected_text(
        &mut self,
        start: usize,
        end: usize,
        text: &str,
    ) -> Result<Update, CollabError> {
        self.replace_projection(start, end, text, false)
    }
    fn replace_projection(
        &mut self,
        start: usize,
        end: usize,
        text: &str,
        raw_source: bool,
    ) -> Result<Update, CollabError> {
        let projection = self.projection();
        if start > end
            || !projection.markdown.is_char_boundary(start)
            || !projection.markdown.is_char_boundary(end)
        {
            return Err(CollabError::InvalidBoundary);
        }
        if start == 0 && end == projection.markdown.len() && !projection.tables.is_empty() {
            let mut candidate = self.clone();
            let length = candidate.text(TextScope::Document)?.len();
            candidate.replace_text(TextScope::Document, 0, length, "")?;
            candidate.insert_markdown(0, text)?;
            return self.finish_projection_action(candidate);
        }
        if let (Ok((scope, from)), Ok((other, to))) =
            (projection.position(start), projection.position(end))
        {
            if !raw_source && scope != other {
                if let (
                    TextScope::Cell { table, .. },
                    TextScope::Cell {
                        table: other_table, ..
                    },
                ) = (scope, other)
                {
                    if table == other_table {
                        let cells = &projection
                            .tables
                            .iter()
                            .find(|view| view.id == table)
                            .ok_or(CollabError::UnknownTable)?
                            .cells;
                        let first = cells
                            .iter()
                            .position(|cell| cell.scope == scope)
                            .ok_or(CollabError::InvalidBoundary)?;
                        let last = cells
                            .iter()
                            .position(|cell| cell.scope == other)
                            .ok_or(CollabError::InvalidBoundary)?;
                        if first > last {
                            return Err(CollabError::InvalidBoundary);
                        }
                        let mut candidate = self.clone();
                        let mut insertion = None;
                        for (index, cell) in cells.iter().enumerate().take(last + 1).skip(first) {
                            let begin = if index == first { from } else { 0 };
                            let stop = if index == last {
                                to
                            } else {
                                self.text(cell.scope)?.len()
                            };
                            if begin < stop {
                                insertion.get_or_insert((cell.scope, begin));
                                candidate.replace_text(cell.scope, begin, stop, "")?;
                            }
                        }
                        let (target, offset) = insertion.unwrap_or((other, to));
                        if !text.is_empty() {
                            candidate.insert_text(target, offset, text)?;
                        }
                        return self.finish_projection_action(candidate);
                    }
                }
            }

            if scope == other
                && scope != TextScope::Document
                && (!raw_source || !text.contains(['|', '\n']))
            {
                return self.replace_text(scope, from, to, text);
            }
            if scope == TextScope::Document
                && other == scope
                && from <= to
                && !projection
                    .tables
                    .iter()
                    .any(|table| start < table.end && end > table.start)
            {
                let mut candidate = self.clone();
                candidate.replace_text(scope, from, to, "")?;
                candidate.insert_markdown(from, text)?;
                candidate.promote_tables()?;
                return self.finish_projection_action(candidate);
            }
        }
        let intersecting: Vec<_> = projection
            .tables
            .iter()
            .filter(|table| {
                start < table.end && end > table.start
                    || start == end && start >= table.start && start <= table.end
            })
            .collect();
        if intersecting.len() == 1 {
            let table = intersecting[0];
            if start >= table.start && end <= table.end {
                let mut source = projection.markdown[table.start..table.end].to_string();
                source.replace_range(start - table.start..end - table.start, text);
                let blocks = parse(&source);
                let parsed: Vec<_> = blocks
                    .iter()
                    .filter(|block| matches!(block.kind, BlockKind::Table { .. }))
                    .collect();
                if parsed.len() == 1
                    && source[..parsed[0].span.start].trim().is_empty()
                    && source[parsed[0].span.end..].trim().is_empty()
                {
                    if let BlockKind::Table { rows, align } = &parsed[0].kind {
                        if table_overflow(
                            &source[parsed[0].span.start..parsed[0].span.end],
                            align.len(),
                        ) {
                            return Err(CollabError::ProjectionDraft);
                        }
                        let values = rows
                            .iter()
                            .map(|row| {
                                row.iter()
                                    .map(|span| source[span.start..span.end].to_string())
                                    .collect()
                            })
                            .collect::<Vec<_>>();
                        let mut candidate = self.clone();
                        candidate.fill_table(table.id, &values, align)?;
                        return self.finish_projection_action(candidate);
                    }
                }
                if source.trim().is_empty() {
                    return self.replace_text(
                        TextScope::Document,
                        table.document_offset,
                        table.document_offset + 3,
                        "",
                    );
                }
                return Err(CollabError::ProjectionDraft);
            }
        }
        self.replace_across_tables(&projection, start, end, text)
    }
    fn replace_across_tables(
        &mut self,
        projection: &Projection,
        start: usize,
        end: usize,
        text: &str,
    ) -> Result<Update, CollabError> {
        let mut source = projection.markdown.clone();
        source.replace_range(start..end, text);
        let blocks: Vec<_> = parse(&source)
            .into_iter()
            .filter(|block| matches!(block.kind, BlockKind::Table { .. }))
            .collect();
        if blocks.iter().any(|block|matches!(&block.kind,BlockKind::Table{align,..} if table_overflow(&source[block.span.start..block.span.end],align.len()))) {return Err(CollabError::ProjectionDraft);}
        let mut assigned = vec![None; blocks.len()];
        let mut used = BTreeSet::new();
        let shift = text.len() as isize - (end - start) as isize;
        for table in &projection.tables {
            if table.end <= start || table.start >= end {
                let delta = if table.start >= end { shift } else { 0 };
                let from = table
                    .start
                    .checked_add_signed(delta)
                    .ok_or(CollabError::InvalidBoundary)?;
                let to = table
                    .end
                    .checked_add_signed(delta)
                    .ok_or(CollabError::InvalidBoundary)?;
                if let Some((index, _)) = blocks.iter().enumerate().find(|(index, block)| {
                    assigned[*index].is_none() && block.span.start >= from && block.span.start <= to
                }) {
                    assigned[index] = Some(table.id);
                    used.insert(table.id);
                }
            }
        }
        let mut remaining = projection
            .tables
            .iter()
            .filter(|table| !used.contains(&table.id));
        for slot in &mut assigned {
            if slot.is_none() {
                if let Some(table) = remaining.next() {
                    *slot = Some(table.id);
                }
            }
        }
        let reused: BTreeSet<_> = assigned.iter().flatten().copied().collect();
        for table in &projection.tables {
            if !reused.contains(&table.id) && !(start <= table.start && end >= table.end) {
                return Err(CollabError::ProjectionDraft);
            }
        }
        let old_order: Vec<_> = projection
            .tables
            .iter()
            .filter(|table| reused.contains(&table.id))
            .map(|table| table.id)
            .collect();
        let new_order: Vec<_> = assigned.iter().flatten().copied().collect();
        if old_order != new_order {
            return Err(CollabError::ProjectionDraft);
        }
        let mut candidate = self.clone();
        let boundaries: Vec<_> = blocks
            .iter()
            .zip(&assigned)
            .filter_map(|(block, id)| id.map(|id| (id, block)))
            .collect();
        // Reconcile text regions right-to-left, retaining every reused table atom.
        for region in (0..=boundaries.len()).rev() {
            let left = region.checked_sub(1).map(|index| boundaries[index]);
            let right = boundaries.get(region).copied();
            let current = candidate.projection();
            let from = left.map_or(0, |(id, _)| {
                current
                    .tables
                    .iter()
                    .find(|table| table.id == id)
                    .unwrap()
                    .document_offset
                    + 3
            });
            let to = right.map_or(candidate.text(TextScope::Document)?.len(), |(id, _)| {
                current
                    .tables
                    .iter()
                    .find(|table| table.id == id)
                    .unwrap()
                    .document_offset
            });
            let source_start = left.map_or(0, |(_, block)| {
                block.span.end + usize::from(source[block.span.end..].starts_with('\n'))
            });
            let source_end = right.map_or(source.len(), |(_, block)| block.span.start);
            let desired = &source[source_start..source_end];
            let old = candidate.text(TextScope::Document)?;
            let existing = &old[from..to];
            if !existing.contains('\u{fffc}')
                && !parse(desired)
                    .iter()
                    .any(|block| matches!(block.kind, BlockKind::Table { .. }))
            {
                let (a, b, value) = text_diff(existing, desired);
                if a != b || !value.is_empty() {
                    candidate.replace_text(TextScope::Document, from + a, from + b, value)?;
                }
            } else {
                candidate.replace_text(TextScope::Document, from, to, "")?;
                candidate.insert_markdown(from, desired)?;
            }
        }
        for (block, id) in blocks.iter().zip(assigned) {
            if let (BlockKind::Table { rows, align }, Some(id)) = (&block.kind, id) {
                let values = rows
                    .iter()
                    .map(|row| {
                        row.iter()
                            .map(|span| source[span.start..span.end].to_string())
                            .collect()
                    })
                    .collect::<Vec<_>>();
                candidate.fill_table(id, &values, align)?;
            }
        }
        self.finish_projection_action(candidate)
    }
}
fn cell_source(text: &str) -> String {
    let mut output = String::new();
    let mut slashes = 0;
    for c in text.chars() {
        if c == '|' && slashes % 2 == 0 {
            output.push('\\');
        }
        if c == '\n' {
            output.push_str("<br>");
        } else {
            output.push(c);
        }
        slashes = if c == '\\' { slashes + 1 } else { 0 };
    }
    output
}
fn table_overflow(source: &str, columns: usize) -> bool {
    source
        .lines()
        .skip(2)
        .any(|line| crate::markdown::table_cells(line, 0).len() > columns)
}
fn reconcile_ids<T: PartialEq>(
    ids: &[OpId],
    old: &[T],
    new: &[T],
    insert: impl Fn(&mut Replica, Option<OpId>) -> Result<OpId, CollabError>,
    delete: impl Fn(&mut Replica, OpId) -> Result<(), CollabError>,
    replica: &mut Replica,
) -> Result<Vec<OpId>, CollabError> {
    if old.len() == new.len() {
        return Ok(ids.to_vec());
    }
    let mut prefix = 0;
    while prefix < old.len().min(new.len()) && old[prefix] == new[prefix] {
        prefix += 1;
    }
    let mut suffix = 0;
    while suffix < old.len() - prefix
        && suffix < new.len() - prefix
        && old[old.len() - 1 - suffix] == new[new.len() - 1 - suffix]
    {
        suffix += 1;
    }
    let mut result = ids[..prefix].to_vec();
    let paired = (old.len() - prefix - suffix).min(new.len() - prefix - suffix);
    result.extend_from_slice(&ids[prefix..prefix + paired]);
    for id in &ids[prefix + paired..ids.len() - suffix] {
        delete(replica, *id)?;
    }
    for _ in prefix + paired..new.len() - suffix {
        let id = insert(replica, result.last().copied())?;
        result.push(id);
    }
    result.extend_from_slice(&ids[ids.len() - suffix..]);
    Ok(result)
}
fn text_diff<'a>(old: &str, new: &'a str) -> (usize, usize, &'a str) {
    let mut prefix = 0;
    for (a, b) in old.chars().zip(new.chars()) {
        if a != b {
            break;
        }
        prefix += a.len_utf8();
    }
    let mut suffix = 0;
    for (a, b) in old[prefix..].chars().rev().zip(new[prefix..].chars().rev()) {
        if a != b {
            break;
        }
        suffix += a.len_utf8();
    }
    (prefix, old.len() - suffix, &new[prefix..new.len() - suffix])
}
