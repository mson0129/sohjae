use sohjae_core::editor::*;

fn at(editor: &Editor, offset: usize) -> TextPosition {
    editor.document().position_at(offset).unwrap()
}

#[test]
fn insert_split_merge_and_history_restore_selection_and_ids() {
    let mut editor = Editor::default();
    editor.replace_selection("한😀끝").unwrap();
    let original = editor.document().clone();
    editor
        .set_selection(Selection::collapsed(at(&editor, 3)))
        .unwrap();
    editor.split_paragraph().unwrap();
    let split = editor.document().clone();
    assert_eq!(split.plain_text(), "한\n😀끝");
    assert_eq!(split.paragraphs()[0].id, original.paragraphs()[0].id);
    let split_selection = editor.selection();
    editor
        .set_selection(Selection {
            anchor: at(&editor, 3),
            focus: at(&editor, 4),
        })
        .unwrap();
    editor.replace_selection("").unwrap();
    assert_eq!(editor.document(), &original);
    editor.undo(editor.revision()).unwrap();
    assert_eq!(editor.document(), &split);
    editor.undo(editor.revision()).unwrap();
    assert_eq!(editor.document(), &original);
    assert_eq!(editor.selection(), Selection::collapsed(at(&editor, 3)));
    editor.redo(editor.revision()).unwrap();
    assert_eq!(editor.selection(), split_selection);
    assert_eq!(editor.revision(), 6);
}

#[test]
fn backward_selection_replacement_collapses_after_insert() {
    let mut editor = Editor::default();
    editor.replace_selection("first\n한글\nlast").unwrap();
    editor
        .set_selection(Selection {
            anchor: at(&editor, 13),
            focus: at(&editor, 2),
        })
        .unwrap();
    editor.replace_selection("😀\nx").unwrap();
    assert_eq!(editor.document().plain_text(), "fi😀\nxlast");
    assert_eq!(editor.selection(), Selection::collapsed(at(&editor, 8)));
    editor.undo(editor.revision()).unwrap();
    assert_eq!(editor.selection().anchor, at(&editor, 13));
    assert_eq!(editor.selection().focus, at(&editor, 2));
}

#[test]
fn transaction_failure_is_atomic_including_selection_history_and_ids() {
    let mut editor = Editor::default();
    editor.replace_selection("abc").unwrap();
    let before = editor.document().clone();
    let selection = editor.selection();
    let revision = editor.revision();
    let position = at(&editor, 1);
    let result = editor.apply(Transaction {
        expected_revision: revision,
        steps: vec![
            ReplaceText {
                start: position,
                end: position,
                text: "\n".into(),
            },
            ReplaceText {
                start: TextPosition {
                    node_id: NodeId(999),
                    byte_offset: 0,
                },
                end: position,
                text: String::new(),
            },
        ],
        selection: None,
    });
    assert_eq!(result.unwrap_err(), EditError::UnknownNode(NodeId(999)));
    assert_eq!(editor.document(), &before);
    assert_eq!(editor.selection(), selection);
    assert_eq!(editor.revision(), revision);
    editor.split_paragraph().unwrap();
    assert_eq!(editor.document().paragraphs()[1].id, NodeId(2));
    assert!(matches!(
        editor.undo(revision),
        Err(EditError::StaleRevision { .. })
    ));
}

#[test]
fn maps_boundary_affinity_and_backward_menu_selection() {
    let mut editor = Editor::default();
    editor.replace_selection("abcd").unwrap();
    let position = at(&editor, 2);
    let saved = Selection {
        anchor: at(&editor, 4),
        focus: at(&editor, 1),
    };
    let result = editor
        .apply(Transaction {
            expected_revision: editor.revision(),
            steps: vec![ReplaceText {
                start: position,
                end: position,
                text: "한\n".into(),
            }],
            selection: None,
        })
        .unwrap();
    assert_eq!(
        result
            .position_map
            .map_position(position, Affinity::Before)
            .unwrap(),
        at(&editor, 2)
    );
    assert_eq!(
        result
            .position_map
            .map_position(position, Affinity::After)
            .unwrap(),
        at(&editor, 6)
    );
    let mapped = result
        .position_map
        .map_selection(saved, Affinity::After)
        .unwrap();
    assert_eq!(mapped.anchor, at(&editor, 8));
    assert_eq!(mapped.focus, at(&editor, 1));
    let undo = editor.undo(editor.revision()).unwrap();
    assert_eq!(
        undo.position_map
            .map_selection(mapped, Affinity::After)
            .unwrap(),
        saved
    );
}

#[test]
fn invalid_utf8_positions_and_invalid_final_selection_leave_state_unchanged() {
    let mut editor = Editor::default();
    editor.replace_selection("한😀").unwrap();
    let revision = editor.revision();
    let invalid = TextPosition {
        node_id: editor.document().start().node_id,
        byte_offset: 1,
    };
    assert!(editor.set_selection(Selection::collapsed(invalid)).is_err());
    let result = editor.apply(Transaction {
        expected_revision: revision,
        steps: vec![],
        selection: Some(Selection::collapsed(invalid)),
    });
    assert!(result.is_err());
    assert_eq!(editor.revision(), revision);
    assert_eq!(editor.document().plain_text(), "한😀");
}

#[test]
fn no_op_and_selection_changes_do_not_create_history_or_clear_redo() {
    let mut editor = Editor::default();
    editor.replace_selection("").unwrap();
    assert!(!editor.can_undo());
    editor.replace_selection("a").unwrap();
    editor.undo(editor.revision()).unwrap();
    editor
        .set_selection(Selection::collapsed(editor.document().start()))
        .unwrap();
    editor.replace_selection("").unwrap();
    assert!(editor.can_redo());
    editor.replace_selection("b").unwrap();
    assert!(!editor.can_redo());
    assert_eq!(
        editor.redo(editor.revision()).unwrap_err(),
        EditError::NoHistory
    );
}

#[test]
fn deleting_everything_keeps_one_paragraph_and_unaffected_nodes_keep_ids() {
    let mut editor = Editor::default();
    editor.replace_selection("a\nb\nc").unwrap();
    let last_id = editor.document().paragraphs()[2].id;
    editor
        .set_selection(Selection::collapsed(at(&editor, 0)))
        .unwrap();
    let result = editor.replace_selection("x").unwrap();
    assert_eq!(editor.document().paragraphs()[2].id, last_id);
    assert_eq!(result.changed_nodes.len(), 1);
    editor
        .set_selection(Selection {
            anchor: editor.document().start(),
            focus: editor.document().end(),
        })
        .unwrap();
    let result = editor.replace_selection("").unwrap();
    assert_eq!(editor.document().paragraphs().len(), 1);
    assert_eq!(editor.document().plain_text(), "");
    assert_eq!(result.removed_nodes.len(), 2);
}

#[test]
fn multiple_steps_map_through_undo_in_reverse_order() {
    let mut editor = Editor::default();
    editor.replace_selection("abcdef").unwrap();
    let saved = at(&editor, 3);
    let result = editor
        .apply(Transaction {
            expected_revision: editor.revision(),
            steps: vec![
                ReplaceText {
                    start: at(&editor, 1),
                    end: at(&editor, 1),
                    text: "X".into(),
                },
                ReplaceText {
                    start: at(&editor, 5),
                    end: at(&editor, 5),
                    text: "Y".into(),
                },
            ],
            selection: None,
        })
        .unwrap();
    assert_eq!(editor.document().plain_text(), "aXbcdYef");
    let mapped = result
        .position_map
        .map_position(saved, Affinity::After)
        .unwrap();
    let undo = editor.undo(editor.revision()).unwrap();
    assert_eq!(
        undo.position_map
            .map_position(mapped, Affinity::After)
            .unwrap(),
        saved
    );
    assert_eq!(editor.document().plain_text(), "abcdef");
}

#[test]
fn invalid_final_selection_rolls_back_successful_steps() {
    let mut editor = Editor::default();
    let start = editor.document().start();
    let result = editor.apply(Transaction {
        expected_revision: 0,
        steps: vec![ReplaceText {
            start,
            end: start,
            text: "한\n😀".into(),
        }],
        selection: Some(Selection::collapsed(TextPosition {
            node_id: NodeId(999),
            byte_offset: 0,
        })),
    });
    assert!(result.is_err());
    assert_eq!(editor.document().plain_text(), "");
    assert_eq!(editor.revision(), 0);
    assert!(!editor.can_undo());
}

#[test]
fn automatic_conversion_undo_escapes_and_redo_restores_rich_source() {
    let mut editor = Editor::from_source("**한글*");
    editor
        .set_selection(Selection::collapsed(editor.document().end()))
        .unwrap();
    editor.replace_selection("*").unwrap();
    editor
        .undo_autoformat(editor.revision(), 0, 10, "\\*\\*한글\\*\\*")
        .unwrap();
    assert_eq!(editor.document().plain_text(), "\\*\\*한글\\*\\*");
    assert!(editor.can_redo());
    editor.redo(editor.revision()).unwrap();
    assert_eq!(editor.document().plain_text(), "**한글**");
    editor.undo(editor.revision()).unwrap();
    assert_eq!(editor.document().plain_text(), "\\*\\*한글\\*\\*");
}

#[test]
fn loading_another_document_invalidates_revision_and_node_ids() {
    let mut editor = Editor::from_source("old");
    let old_position = editor.document().start();
    editor.load_source("new").unwrap();
    assert_eq!(editor.revision(), 1);
    assert!(!editor.can_undo());
    assert!(editor.document().absolute_offset(old_position).is_err());
    assert!(matches!(
        editor.undo(0),
        Err(EditError::StaleRevision { .. })
    ));
}

#[test]
fn command_range_rewrites_restore_user_selection_and_final_redo_caret() {
    let mut editor = Editor::from_source("abc\nxyz");
    let original_selection = Selection::collapsed(at(&editor, 5));
    editor.set_selection(original_selection).unwrap();
    editor.replace_range(0, 0, 7, "abc\nnew\nrow").unwrap();
    let final_selection = Selection::collapsed(at(&editor, 9));
    editor.finalize_selection(final_selection).unwrap();
    editor.undo(editor.revision()).unwrap();
    assert_eq!(editor.selection(), original_selection);
    editor.redo(editor.revision()).unwrap();
    assert_eq!(editor.selection(), final_selection);
}

#[test]
fn all_unicode_ranges_replace_and_undo_without_losing_text() {
    let source = "한😀\ne\u{301}\n끝";
    let boundaries: Vec<_> = (0..=source.len())
        .filter(|offset| source.is_char_boundary(*offset))
        .collect();
    for &start in &boundaries {
        for &end in boundaries.iter().filter(|end| **end >= start) {
            for replacement in ["", "x", "새\n😀", "\n\n"] {
                let mut editor = Editor::default();
                editor.replace_selection(source).unwrap();
                let before = editor.document().clone();
                editor
                    .set_selection(Selection {
                        anchor: at(&editor, end),
                        focus: at(&editor, start),
                    })
                    .unwrap();
                let selection = editor.selection();
                editor.replace_selection(replacement).unwrap();
                assert_eq!(
                    editor.document().plain_text(),
                    format!("{}{}{}", &source[..start], replacement, &source[end..])
                );
                if editor.document() != &before {
                    editor.undo(editor.revision()).unwrap();
                    assert_eq!(editor.document(), &before);
                    assert_eq!(editor.selection(), selection);
                }
            }
        }
    }
}

#[test]
fn coalesced_history_restores_all_steps_selection_and_rejects_stale_requests() {
    let mut editor = Editor::from_source("앞");
    editor
        .set_selection(Selection::collapsed(at(&editor, 3)))
        .unwrap();
    for text in ["한", "😀", "끝"] {
        editor.replace_selection(text).unwrap();
        editor.coalesce_history(editor.revision()).unwrap();
    }
    let revision = editor.revision();
    assert!(editor.coalesce_history(revision - 1).is_err());
    editor.undo(revision).unwrap();
    assert_eq!(editor.document().plain_text(), "앞");
    assert_eq!(editor.selection(), Selection::collapsed(at(&editor, 3)));
    assert!(!editor.can_undo());
    editor.redo(editor.revision()).unwrap();
    assert_eq!(editor.document().plain_text(), "앞한😀끝");
    assert_eq!(editor.selection(), Selection::collapsed(at(&editor, 13)));
}
