use sohjae_core::collab::*;

fn replica(actor: u128) -> Replica {
    Replica::new(DocumentId(1), ActorId(actor)).unwrap()
}
fn source(replica: &Replica) -> String {
    replica.text(TextScope::Document).unwrap()
}
fn exchange(a: &mut Replica, b: &mut Replica) {
    let a_update = a.export_all();
    let b_update = b.export_all();
    assert!(a.merge(&b_update).unwrap().rejected.is_empty());
    assert!(b.merge(&a_update).unwrap().rejected.is_empty());
}

#[test]
fn simultaneous_gap_inserts_keep_each_run_contiguous_and_converge() {
    let mut a = replica(1);
    let seed = a.insert_text(TextScope::Document, 0, "ab").unwrap();
    let mut b = replica(2);
    b.merge(&seed).unwrap();
    let x = a.insert_text(TextScope::Document, 1, "한글").unwrap();
    let y = b.insert_text(TextScope::Document, 1, "😀xy").unwrap();
    a.merge(&y).unwrap();
    b.merge(&x).unwrap();
    a.merge(&y).unwrap();
    assert_eq!(source(&a), "a😀xy한글b");
    assert_eq!(source(&a), source(&b));
    let update = a.insert_text(TextScope::Document, 1, "first").unwrap();
    b.merge(&update).unwrap();
    assert_eq!(source(&b), "afirst😀xy한글b");
}

#[test]
fn causally_delayed_operations_are_buffered_and_duplicates_are_idempotent() {
    let mut a = replica(1);
    let parent = a.insert_text(TextScope::Document, 0, "a").unwrap();
    let child = a.insert_text(TextScope::Document, 1, "b").unwrap();
    let mut b = replica(2);
    assert_eq!(b.merge(&child).unwrap().pending, 1);
    assert_eq!(source(&b), "");
    assert_eq!(b.merge(&child).unwrap().duplicates, 1);
    let report = b.merge(&parent).unwrap();
    assert_eq!(report.applied, 2);
    assert_eq!(report.pending, 0);
    assert_eq!(source(&b), "ab");
    assert_eq!(b.merge(&parent).unwrap().duplicates, 1);
}

#[test]
fn own_undo_preserves_concurrent_remote_text_and_redo_survives_remote_edits() {
    let mut a = replica(1);
    let initial = a.insert_text(TextScope::Document, 0, "AB").unwrap();
    let mut b = replica(2);
    b.merge(&initial).unwrap();
    let remote = b.insert_text(TextScope::Document, 1, "remote").unwrap();
    a.merge(&remote).unwrap();
    let undo = a.undo().unwrap();
    b.merge(&undo).unwrap();
    assert_eq!(source(&a), "remote");
    assert_eq!(source(&b), "remote");
    let another = b.insert_text(TextScope::Document, 6, "!").unwrap();
    a.merge(&another).unwrap();
    assert!(a.can_redo());
    let redo = a.redo().unwrap();
    b.merge(&redo).unwrap();
    assert_eq!(source(&a), source(&b));
    assert_eq!(source(&a), "Aremote!B");
}

#[test]
fn undoing_one_delete_does_not_resurrect_another_authors_delete() {
    let mut seed = replica(99);
    let initial = seed.insert_text(TextScope::Document, 0, "abc").unwrap();
    let mut a = replica(1);
    let mut b = replica(2);
    a.merge(&initial).unwrap();
    b.merge(&initial).unwrap();
    let first = a.replace_text(TextScope::Document, 1, 2, "").unwrap();
    let second = b.replace_text(TextScope::Document, 1, 2, "").unwrap();
    a.merge(&second).unwrap();
    b.merge(&first).unwrap();
    let undo = a.undo().unwrap();
    b.merge(&undo).unwrap();
    assert_eq!(source(&a), "ac");
    assert_eq!(source(&b), "ac");
    let undo = b.undo().unwrap();
    a.merge(&undo).unwrap();
    assert_eq!(source(&a), "abc");
    assert_eq!(source(&b), "abc");
}

#[test]
fn cursor_anchors_track_insertions_and_tombstoned_endpoints() {
    let mut a = replica(1);
    a.insert_text(TextScope::Document, 0, "한😀").unwrap();
    let before = a.anchor_at(TextScope::Document, 3, Bias::Before).unwrap();
    let after = a.anchor_at(TextScope::Document, 3, Bias::After).unwrap();
    assert_eq!(
        a.anchor_at(TextScope::Document, 1, Bias::After),
        Err(CollabError::InvalidBoundary)
    );
    a.insert_text(TextScope::Document, 3, "x").unwrap();
    assert_eq!(a.resolve_anchor(before), Ok(3));
    assert_eq!(a.resolve_anchor(after), Ok(4));
    a.replace_text(TextScope::Document, 0, 3, "").unwrap();
    assert_eq!(a.resolve_anchor(before), Ok(0));
    assert_eq!(a.resolve_anchor(after), Ok(1));
    let update = a.export_all();
    let mut b = replica(2);
    b.merge(&update).unwrap();
    assert_eq!(b.resolve_anchor(after), Ok(1));
}

#[test]
fn structural_tables_merge_cell_edits_and_preserve_deleted_row_contents() {
    let mut a = replica(1);
    let (table_id, seed) = a.create_table(0, 2, 2).unwrap();
    let mut b = replica(2);
    b.merge(&seed).unwrap();
    let table = a.table(table_id).unwrap();
    let row = table.rows[1];
    let first = TextScope::Cell {
        table: table_id,
        row,
        column: table.columns[0],
    };
    let second = TextScope::Cell {
        table: table_id,
        row,
        column: table.columns[1],
    };
    let x = a.insert_text(first, 0, "Alice").unwrap();
    let y = b.insert_text(second, 0, "Bob").unwrap();
    a.merge(&y).unwrap();
    b.merge(&x).unwrap();
    assert_eq!(a.markdown(), b.markdown());
    assert!(a.markdown().contains("| Alice | Bob |"));
    let deleted = a.delete_row(table_id, row).unwrap();
    let edited = b.insert_text(second, 3, "!").unwrap();
    a.merge(&edited).unwrap();
    b.merge(&deleted).unwrap();
    assert_eq!(a.table(table_id).unwrap().rows.len(), 1);
    assert_eq!(a.text(second).unwrap(), "Bob!");
    let restored = a.undo().unwrap();
    b.merge(&restored).unwrap();
    assert_eq!(a.table(table_id).unwrap().rows.len(), 2);
    assert!(a.markdown().contains("| Alice | Bob! |"));
    assert_eq!(a.markdown(), b.markdown());
}

#[test]
fn simultaneous_row_column_insertions_and_alignment_have_stable_ids() {
    let mut a = replica(1);
    let (table_id, seed) = a.create_table(0, 1, 1).unwrap();
    let mut b = replica(2);
    b.merge(&seed).unwrap();
    let view = a.table(table_id).unwrap();
    let (a_row, _) = a.insert_row(table_id, Some(view.rows[0])).unwrap();
    let (b_row, _) = b.insert_row(table_id, Some(view.rows[0])).unwrap();
    a.insert_column(table_id, Some(view.columns[0])).unwrap();
    b.insert_column(table_id, Some(view.columns[0])).unwrap();
    let a_align = a
        .set_alignment(table_id, view.columns[0], Alignment::Center)
        .unwrap();
    let b_align = b
        .set_alignment(table_id, view.columns[0], Alignment::Right)
        .unwrap();
    exchange(&mut a, &mut b);
    assert_eq!(a.table(table_id).unwrap(), b.table(table_id).unwrap());
    assert!(a.table(table_id).unwrap().rows.contains(&a_row));
    assert!(a.table(table_id).unwrap().rows.contains(&b_row));
    assert_eq!(a.table(table_id).unwrap().alignments[0], Alignment::Right);
    let undo = b.undo().unwrap();
    a.merge(&undo).unwrap();
    assert_eq!(a.table(table_id).unwrap().alignments[0], Alignment::Center);
    assert_ne!(a_align.operations[0].id, b_align.operations[0].id);
}

#[test]
fn codec_roundtrip_persistence_and_frontier_delta_sync() {
    let mut a = replica(1);
    a.insert_text(TextScope::Document, 0, "# 한글😀\n").unwrap();
    let (table, _) = a.create_table(source(&a).len(), 2, 2).unwrap();
    let view = a.table(table).unwrap();
    a.insert_text(
        TextScope::Cell {
            table,
            row: view.rows[0],
            column: view.columns[0],
        },
        0,
        "header",
    )
    .unwrap();
    let update = a.export_all();
    let bytes = encode_update(&update).unwrap();
    assert_eq!(decode_update(&bytes).unwrap(), update);
    let mut restored = replica(7);
    restored.merge(&decode_update(&bytes).unwrap()).unwrap();
    assert_eq!(restored.markdown(), a.markdown());
    let frontier = restored.frontier();
    let change = a.insert_text(TextScope::Document, 0, "new\n").unwrap();
    let delta = a.changes_since(&frontier);
    assert_eq!(delta, change);
    restored.merge(&delta).unwrap();
    assert_eq!(restored.markdown(), a.markdown());
    assert!(a.changes_since(&restored.frontier()).operations.is_empty());
    for end in 0..bytes.len() {
        assert!(
            decode_update(&bytes[..end]).is_err(),
            "accepted truncated packet {end}"
        );
    }
    let mut garbage = bytes.clone();
    garbage.push(0);
    assert_eq!(decode_update(&garbage), Err(CollabError::InvalidEncoding));
}

#[test]
fn invalid_updates_are_atomic_and_foreign_undo_is_quarantined() {
    let mut a = replica(1);
    let seed = a.insert_text(TextScope::Document, 0, "abc").unwrap();
    let mut b = replica(2);
    b.merge(&seed).unwrap();
    let mut collision = seed.clone();
    if let OperationKind::InsertText { text, .. } = &mut collision.operations[0].kind {
        *text = "tampered".into();
    }
    assert!(matches!(
        b.merge(&collision),
        Err(CollabError::IdCollision(_))
    ));
    assert_eq!(source(&b), "abc");
    let invalid = Update {
        document: DocumentId(1),
        operations: vec![Operation {
            id: OpId {
                counter: 2,
                actor: ActorId(2),
            },
            dependencies: vec![seed.operations[0].id],
            kind: OperationKind::SetActive {
                target: seed.operations[0].id,
                active: false,
            },
        }],
    };
    assert_eq!(
        b.merge(&invalid).unwrap().rejected[0].1,
        CollabError::WrongOwner
    );
    assert_eq!(source(&b), "abc");
    let mut wrong_document = seed.clone();
    wrong_document.document = DocumentId(99);
    assert_eq!(b.merge(&wrong_document), Err(CollabError::WrongDocument));
    let previous = a.export_all();
    assert_eq!(
        a.replace_text(TextScope::Document, 1, 99, "oops"),
        Err(CollabError::InvalidBoundary)
    );
    assert_eq!(a.export_all(), previous);
}

#[test]
fn buffered_invalid_operation_does_not_poison_a_valid_dependency() {
    let mut a = replica(1);
    let initial = a.insert_text(TextScope::Document, 0, "a").unwrap();
    let invalid = Update {
        document: DocumentId(1),
        operations: vec![Operation {
            id: OpId {
                counter: 2,
                actor: ActorId(2),
            },
            dependencies: vec![initial.operations[0].id],
            kind: OperationKind::InsertText {
                scope: TextScope::Document,
                after: Some(AtomId {
                    operation: initial.operations[0].id,
                    offset: 99,
                }),
                text: "bad".into(),
            },
        }],
    };
    let mut b = replica(3);
    b.merge(&invalid).unwrap();
    let report = b.merge(&initial).unwrap();
    assert_eq!(report.rejected.len(), 1);
    assert_eq!(report.pending, 0);
    assert_eq!(source(&b), "a");
    b.insert_text(TextScope::Document, 1, "ok").unwrap();
    assert_eq!(source(&b), "aok");
}

#[test]
fn shuffled_duplicated_partitioned_delivery_converges_for_three_writers() {
    for seed in 1..=12u64 {
        let mut peers = [replica(1), replica(2), replica(3)];
        let mut updates = Vec::new();
        let mut random = seed;
        let mut next = || {
            random = random.wrapping_mul(6364136223846793005).wrapping_add(1);
            random
        };
        for _ in 0..60 {
            let index = (next() % 3) as usize;
            if !updates.is_empty() && next() % 3 == 0 {
                let update = &updates[(next() as usize) % updates.len()];
                assert!(peers[index].merge(update).unwrap().rejected.is_empty());
            }
            let text = source(&peers[index]);
            let mut boundaries: Vec<_> = text.char_indices().map(|(index, _)| index).collect();
            boundaries.push(text.len());
            let at = (next() as usize) % boundaries.len();
            let update = if next() % 4 == 0 && peers[index].can_undo() {
                peers[index].undo().unwrap()
            } else if next() % 4 == 0 && at + 1 < boundaries.len() {
                peers[index]
                    .replace_text(TextScope::Document, boundaries[at], boundaries[at + 1], "")
                    .unwrap()
            } else {
                peers[index]
                    .insert_text(
                        TextScope::Document,
                        boundaries[at],
                        ["a", "한", "😀"][(next() % 3) as usize],
                    )
                    .unwrap()
            };
            updates.push(update);
        }
        for index in (1..updates.len()).rev() {
            let other = (next() as usize) % (index + 1);
            updates.swap(index, other);
        }
        for peer in &mut peers {
            for update in &updates {
                assert!(peer.merge(update).unwrap().rejected.is_empty());
                peer.merge(update).unwrap();
            }
            assert_eq!(peer.pending_count(), 0);
        }
        assert_eq!(source(&peers[0]), source(&peers[1]), "seed {seed}");
        assert_eq!(source(&peers[1]), source(&peers[2]), "seed {seed}");
        assert_eq!(peers[0].frontier(), peers[2].frontier());
    }
}

#[test]
fn captured_ime_replacement_preserves_unseen_remote_insertions() {
    let mut a = replica(1);
    let seed = a.insert_text(TextScope::Document, 0, "abc").unwrap();
    let mut b = replica(2);
    b.merge(&seed).unwrap();
    let capture = a.capture_range(TextScope::Document, 1, 2).unwrap();
    let encoded = encode_capture(&capture).unwrap();
    assert_eq!(decode_capture(&encoded).unwrap(), capture);
    for end in 0..encoded.len() {
        assert!(decode_capture(&encoded[..end]).is_err());
    }
    let remote = b.insert_text(TextScope::Document, 2, "😀").unwrap();
    a.merge(&remote).unwrap();
    let update = a.replace_capture(&capture, "한").unwrap();
    b.merge(&update).unwrap();
    assert_eq!(source(&a), source(&b));
    assert!(source(&a).contains('😀'));
    assert!(!source(&a).contains('b'));
    let undo = a.undo().unwrap();
    b.merge(&undo).unwrap();
    assert_eq!(source(&a), "ab😀c");
    assert_eq!(source(&a), source(&b));
    let mut wrong_document = Replica::new(DocumentId(2), ActorId(3)).unwrap();
    assert_eq!(
        wrong_document.replace_capture(&capture, "x"),
        Err(CollabError::WrongDocument)
    );
    let anchor = a.anchor_at(TextScope::Document, 1, Bias::After).unwrap();
    assert_eq!(decode_anchor(&encode_anchor(&anchor)).unwrap(), anchor);
}

#[test]
fn reorder_preserves_ids_remote_cell_edits_alignment_and_own_undo() {
    let mut a = replica(1);
    let (table, _) = a.create_table(0, 4, 3).unwrap();
    let view = a.table(table).unwrap();
    let scope = TextScope::Cell {
        table,
        row: view.rows[1],
        column: view.columns[0],
    };
    a.insert_text(scope, 0, "original").unwrap();
    a.set_alignment(table, view.columns[0], Alignment::Right)
        .unwrap();
    let mut b = replica(2);
    b.merge(&a.export_all()).unwrap();
    let moved = a.reorder(table, false, vec![view.rows[1]], None).unwrap();
    let edit = b.replace_text(scope, 0, 8, "원격😀").unwrap();
    a.merge(&edit).unwrap();
    b.merge(&moved).unwrap();
    assert_eq!(a.table(table).unwrap(), b.table(table).unwrap());
    assert_eq!(
        a.table(table).unwrap().rows,
        vec![view.rows[0], view.rows[2], view.rows[3], view.rows[1]]
    );
    assert_eq!(a.text(scope).unwrap(), "원격😀");
    a.undo().unwrap();
    assert_eq!(a.table(table).unwrap().rows, view.rows);
    assert_eq!(a.text(scope).unwrap(), "원격😀");
    a.redo().unwrap();
    a.reorder(table, true, vec![view.columns[0]], None).unwrap();
    let now = a.table(table).unwrap();
    assert_eq!(
        now.columns,
        vec![view.columns[1], view.columns[2], view.columns[0]]
    );
    assert_eq!(now.alignments[2], Alignment::Right);
    let (new_row, _) = a.insert_row(table, Some(view.rows[1])).unwrap();
    let rows = a.table(table).unwrap().rows;
    assert_eq!(
        rows.iter().position(|id| *id == new_row).unwrap(),
        rows.iter().position(|id| *id == view.rows[1]).unwrap() + 1
    );
    let encoded = encode_update(&a.export_all()).unwrap();
    let mut restored = replica(3);
    restored.merge(&decode_update(&encoded).unwrap()).unwrap();
    assert_eq!(restored.table(table).unwrap(), a.table(table).unwrap());
}

#[test]
fn concurrent_moves_deletes_and_inserts_converge_in_any_delivery_order() {
    let mut seed = replica(1);
    let (table, _) = seed.create_table(0, 5, 3).unwrap();
    let view = seed.table(table).unwrap();
    let mut a = replica(2);
    let mut b = replica(3);
    a.merge(&seed.export_all()).unwrap();
    b.merge(&seed.export_all()).unwrap();
    let x = a
        .reorder(table, false, vec![view.rows[1], view.rows[2]], None)
        .unwrap();
    let y = b
        .reorder(table, false, vec![view.rows[2]], Some(view.rows[0]))
        .unwrap();
    let z = b.delete_row(table, view.rows[1]).unwrap();
    let (_, insert) = a.insert_column(table, Some(view.columns[0])).unwrap();
    for reverse in [false, true] {
        let mut c = replica(4);
        let mut updates = [
            seed.export_all(),
            x.clone(),
            y.clone(),
            z.clone(),
            insert.clone(),
        ];
        if reverse {
            updates.reverse();
        }
        for update in updates.iter().chain(updates.iter()) {
            assert!(c.merge(update).unwrap().rejected.is_empty());
        }
        a.merge(&y).unwrap();
        a.merge(&z).unwrap();
        assert_eq!(c.table(table).unwrap(), a.table(table).unwrap());
        assert_eq!(c.pending_count(), 0);
    }
    a.undo().unwrap(); // undo the inserted column, then own move
    a.undo().unwrap();
    assert!(!a.table(table).unwrap().rows.contains(&view.rows[1]));
}

#[test]
fn invalid_reorder_is_atomic_and_causally_checked() {
    let mut a = replica(1);
    let (table, _) = a.create_table(0, 3, 2).unwrap();
    let view = a.table(table).unwrap();
    let before = a.export_all();
    for (targets, destination) in [
        (vec![], None),
        (vec![view.rows[1], view.rows[1]], None),
        (vec![view.rows[1]], Some(view.rows[1])),
        (vec![view.columns[0]], None),
    ] {
        assert!(a.reorder(table, false, targets, destination).is_err());
        assert_eq!(a.export_all(), before);
    }
    let moved = a.reorder(table, false, vec![view.rows[1]], None).unwrap();
    let mut bad = moved.clone();
    bad.operations[0].dependencies.clear();
    let mut b = replica(2);
    b.merge(&before).unwrap();
    assert!(!b.merge(&bad).unwrap().rejected.is_empty());
    assert_eq!(b.table(table).unwrap().rows, view.rows);
}

#[test]
fn grouped_local_undo_preserves_remote_edits_and_converges() {
    let mut a = replica(1);
    let mut b = replica(2);
    a.insert_text(TextScope::Document, 0, "한").unwrap();
    a.insert_text(TextScope::Document, 3, "😀").unwrap();
    a.coalesce_history();
    exchange(&mut a, &mut b);
    b.insert_text(TextScope::Document, 0, "원격").unwrap();
    exchange(&mut a, &mut b);
    a.undo().unwrap();
    exchange(&mut a, &mut b);
    assert_eq!(source(&a), "원격");
    assert_eq!(source(&a), source(&b));
    a.redo().unwrap();
    exchange(&mut a, &mut b);
    assert_eq!(source(&a), "원격한😀");
    assert_eq!(source(&a), source(&b));
}
