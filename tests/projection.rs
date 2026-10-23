use sohjae_core::collab::*;
fn replica(actor: u128) -> Replica {
    Replica::new(DocumentId(44), ActorId(actor)).unwrap()
}
#[test]
fn import_and_projection_keep_tables_structural_and_cells_independent() {
    let mut a = replica(1);
    let seed = a
        .import_markdown("# 한글\n\n| a | b |\n| --- | :---: |\n| c | d |\n")
        .unwrap();
    let mut b = replica(2);
    b.merge(&seed).unwrap();
    let table = a.visible_tables()[0];
    let view = a.table(table).unwrap();
    let projection = a.projection();
    let first=projection.tables[0].cells.iter().find(|cell|matches!(cell.scope,TextScope::Cell{row,column,..} if row==view.rows[1] && column==view.columns[0])).unwrap();
    let x = a
        .replace_markdown(first.start, first.end, "==한글==")
        .unwrap();
    let other=b.projection().tables[0].cells.iter().find(|cell|matches!(cell.scope,TextScope::Cell{row,column,..} if row==view.rows[1] && column==view.columns[1])).unwrap().clone();
    let y = b.replace_markdown(other.start, other.end, "😀").unwrap();
    a.merge(&y).unwrap();
    b.merge(&x).unwrap();
    assert_eq!(a.markdown(), b.markdown());
    assert_eq!(a.visible_tables(), vec![table]);
    assert!(a.markdown().contains("==한글=="));
    let undo = a.undo().unwrap();
    b.merge(&undo).unwrap();
    assert!(a.markdown().contains('😀'));
    assert!(!a.markdown().contains("==한글=="));
    assert_eq!(a.markdown(), b.markdown());
}
#[test]
fn table_commands_are_atomic_own_undo_groups_and_source_shape_changes_preserve_ids() {
    let mut a = replica(1);
    a.import_markdown("| A | B |\n| --- | --- |\n| c | d |\n")
        .unwrap();
    let id = a.visible_tables()[0];
    let old = a.table(id).unwrap();
    a.table_action(id, 3, 1, 0, [1, 1, 0, 0]).unwrap();
    assert_eq!(a.table(id).unwrap().columns.len(), 3);
    a.undo().unwrap();
    assert_eq!(a.table(id).unwrap().columns, old.columns);
    let projection = a.projection();
    let table = &projection.tables[0];
    // Apply a whole table source edit with one new row; existing rows/cells retain IDs.
    let start = projection.markdown.find('|').unwrap();
    let end = projection.markdown.rfind('|').unwrap() + 1;
    let text = "| A | B |\n| --- | --- |\n| c | d |\n| e | f |";
    a.replace_markdown(start, end, text).unwrap();
    let next = a.table(id).unwrap();
    assert_eq!(&next.rows[..2], &old.rows);
    assert_eq!(next.columns, old.columns);
    assert_eq!(table.id, id);
    assert_eq!(next.rows.len(), 3);
    a.undo().unwrap();
    assert_eq!(a.table(id).unwrap().rows, old.rows);
}
#[test]
fn invalid_source_drafts_are_atomic_and_projection_anchors_handle_escaping() {
    let mut a = replica(1);
    a.import_markdown("| a | b |\n| --- | --- |\n| c | d |\n")
        .unwrap();
    let original = a.markdown();
    let offset = original.find("---").unwrap();
    assert_eq!(
        a.replace_markdown(offset, offset + 3, "?"),
        Err(CollabError::ProjectionDraft)
    );
    assert_eq!(a.markdown(), original);
    let cell = a.projection().tables[0].cells[0].clone();
    a.replace_projected_text(cell.start, cell.end, "한|😀\n줄")
        .unwrap();
    let projection = a.projection();
    let cell = &projection.tables[0].cells[0];
    for offset in [0, 3, 4, 8, 9, 12] {
        let projected = projection.offset(cell.scope, offset).unwrap();
        assert_eq!(
            projection.position(projected).unwrap(),
            (cell.scope, offset)
        );
    }
}
#[test]
fn typed_and_pasted_tables_promote_in_one_undo_group() {
    let mut a = replica(1);
    a.import_markdown("before\n\n").unwrap();
    let start = a.markdown().len();
    a.replace_markdown(start, start, "| x |\n| --- |\n| y |")
        .unwrap();
    assert_eq!(a.visible_tables().len(), 1);
    a.undo().unwrap();
    assert!(a.visible_tables().is_empty());
    assert_eq!(a.markdown(), "before\n\n");
}

#[test]
fn source_edits_across_two_tables_keep_both_ids_and_are_one_undo() {
    let mut a = replica(1);
    a.import_markdown(
        "before\n\n| A |\n| --- |\n| one |\n\nmiddle\n\n| B |\n| --- |\n| two |\n\nafter",
    )
    .unwrap();
    let ids = a.visible_tables();
    let original = a.markdown();
    let start = original.find("one").unwrap();
    let end = original.find("two").unwrap() + 3;
    let replacement = original[start..end]
        .replace("one", "first")
        .replace("two", "second");
    a.replace_markdown(start, end, &replacement).unwrap();
    assert_eq!(a.visible_tables(), ids);
    assert!(a.markdown().contains("first") && a.markdown().contains("second"));
    a.undo().unwrap();
    assert_eq!(a.visible_tables(), ids);
    assert_eq!(a.markdown(), original);
}
#[test]
fn ignored_gfm_overflow_cells_are_preserved_as_raw_source_until_repaired() {
    let mut a = replica(1);
    let source = "| a | b |\n| --- | --- |\n| c | d | hidden extra |\n";
    a.import_markdown(source).unwrap();
    assert!(a.visible_tables().is_empty());
    assert_eq!(a.markdown(), source);
    let start = source.find(" | hidden extra").unwrap();
    a.replace_markdown(start, start + " | hidden extra".len(), "")
        .unwrap();
    assert_eq!(a.visible_tables().len(), 1);
    assert!(a.markdown().contains("| c | d |"));
}
#[test]
fn source_pipe_changes_table_grammar_while_rich_pipe_is_literal_cell_content() {
    let mut a = replica(1);
    a.import_markdown("| A | B |\n| --- | --- |\n| c | d |")
        .unwrap();
    let cell = a.projection().tables[0].cells[0].clone();
    let original = a.markdown();
    assert_eq!(
        a.replace_markdown(cell.end, cell.end, "|"),
        Err(CollabError::ProjectionDraft)
    );
    assert_eq!(a.markdown(), original);
    a.replace_projected_text(cell.end, cell.end, "|").unwrap();
    assert!(a.markdown().contains("A\\|"));
    assert_eq!(a.table(a.visible_tables()[0]).unwrap().columns.len(), 2);
}
#[test]
fn source_shape_edits_do_not_rewrite_unchanged_escaped_cell_atoms() {
    let mut a = replica(1);
    a.import_markdown("| A | B |\n| --- | --- |\n| c | d |")
        .unwrap();
    let cell = a.projection().tables[0].cells[2].clone();
    a.replace_projected_text(cell.start, cell.end, "한|😀\n줄")
        .unwrap();
    let original = a.markdown();
    let start = original.find('|').unwrap();
    let end = original.rfind('|').unwrap() + 1;
    let text = format!("{}\n| new | row |", &original[start..end]);
    let update = a.replace_markdown(start, end, &text).unwrap();
    assert!(update.operations.iter().all(|op|!matches!(&op.kind,OperationKind::InsertText{scope,..}|OperationKind::DeleteText{scope,..} if *scope==cell.scope)));
    assert_eq!(a.text(cell.scope).unwrap(), "한|😀\n줄");
}
#[test]
fn rich_native_cell_boundaries_replace_visible_cells_without_merging_columns() {
    let mut a = replica(1);
    a.import_markdown("| A | B |\n| --- | --- |\n| c | d |")
        .unwrap();
    let cells = a.projection().tables[0].cells.clone();
    let id = a.visible_tables()[0];
    // Native selections may begin at the previous cell's end while only the next
    // cell's text is visibly highlighted. That boundary is not a table delimiter edit.
    a.replace_projected_text(cells[2].end, cells[3].end, "new")
        .unwrap();
    let view = a.table(id).unwrap();
    assert_eq!(view.columns.len(), 2);
    assert_eq!(view.cells[2].text, "c");
    assert_eq!(view.cells[3].text, "new");
    a.undo().unwrap();
    assert_eq!(a.table(id).unwrap().cells[3].text, "d");
    let cells = a.projection().tables[0].cells.clone();
    a.replace_projected_text(cells[2].start, cells[3].end, "X")
        .unwrap();
    let view = a.table(id).unwrap();
    assert_eq!(view.columns.len(), 2);
    assert_eq!(view.cells[2].text, "X");
    assert!(view.cells[3].text.is_empty());
}
