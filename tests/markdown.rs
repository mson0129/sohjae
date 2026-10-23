use sohjae_core::markdown::*;

#[test]
fn blocks_have_valid_source_spans_and_tables_have_alignment() {
    let source = "---\nlayout: serif\n---\n# 한글😀\n\n| a | b |\n| --- | :---: |\n| x | y |\n```rs\n**raw**\n```\n<!-- hello\nworld -->";
    let blocks = parse(source);
    for block in &blocks {
        assert!(source.get(block.span.start..block.span.end).is_some());
    }
    assert_eq!(front_matter_layout(source), Some("serif".into()));
    assert!(blocks.iter().any(|block| matches!(&block.kind, BlockKind::Table { rows, align } if rows.len() == 2 && align[1] == "center")));
    let html = render(source, false);
    assert!(html.contains("<table"));
    assert!(html.contains("**raw**"));
    assert!(!html.contains("<script"));
    assert!(!render(source, true).contains("world --"));
}

#[test]
fn render_sanitizes_html_and_urls_but_preserves_the_source() {
    let source = "<img src=\"javascript:alert(1)\" onerror=\"alert(1)\" width=\"80\" style=\"color:red\">\n<script>alert(1)</script>\n[x](javascript:alert(1))\n<a name=\"anchor\" onclick=\"bad()\"></a>\n<source srcset=\"https://example.test/a.png 1x, javascript:bad 2x\">";
    let html = render(source, false);
    assert!(!html.contains("onerror="));
    assert!(!html.contains("onclick="));
    assert!(!html.contains("src=\"javascript:"));
    assert!(!html.contains("href=\"javascript:"));
    assert!(!html.contains("srcset="));
    assert!(!html.contains("<script>"));
    assert!(html.contains("width=\"80\""));
    assert!(html.contains("name=\"anchor\""));
    assert_eq!(normalize(source), source);
}

#[test]
fn protected_regions_and_unknown_aliases_survive_normalization() {
    let source = "---\nlayout: default\nname: :smile:\n---\n__bold__ :smile: :unknown:\n`__code__ :smile:`\n```\n__code__ :smile:\n```\n<!-- __comment__ :smile: -->\n<br />\nline  \nnext\\\nlast";
    let normalized = normalize(source);
    assert!(normalized.contains("**bold** 😄 :unknown:"));
    assert!(normalized.contains("name: :smile:"));
    assert!(normalized.contains("`__code__ :smile:`"));
    assert!(normalized.contains("<!-- __comment__ :smile: -->"));
    assert!(normalized.contains("line<br>\nnext<br>"));
    assert_eq!(normalize(&normalized), normalized);
}

#[test]
fn empty_cells_escaped_pipes_and_unicode_are_bounded() {
    let source = "| 한글 | a\\|b |  |";
    let cells = table_cells(source, 0);
    assert_eq!(cells.len(), 3);
    assert_eq!(&source[cells[0].start..cells[0].end], "한글");
    assert_eq!(&source[cells[1].start..cells[1].end], "a\\|b");
    assert_eq!(cells[2].start, cells[2].end);
}

#[test]
fn links_balanced_parentheses_and_attachment_metadata() {
    let html = render("[text](https://example.test/a(b)c)\n[file](data:application/pdf;base64,YQ== \"attachment:test.pdf\")", false);
    assert!(html.contains("href=\"https://example.test/a(b)c\""));
    assert!(html.contains("download=\"test.pdf\""));
    assert!(!safe_url("java\nscript:bad", false, false));
    assert!(!safe_url("data:text/html;base64,YQ==", false, false));
    assert!(!safe_url("data:image/svg+xml;base64,YQ==", true, false));
    assert!(safe_url("../images/a.png", true, false));
    let html = render(
        "[file](data:text/plain;base64,YQ== \"attachment-uri:%ED%95%9C%EA%B8%80%22.txt\")",
        false,
    );
    assert!(html.contains("download=\"한글&quot;.txt\""), "{html}");
    let _ = render(
        "[file](data:text/plain;base64,YQ== \"attachment-uri:%한\")",
        false,
    );
}

#[test]
fn malformed_front_matter_is_preserved_without_panics() {
    for source in [
        "---\nlayout: '\n---",
        "---\nlayout: \"\n---",
        "---\nlayout: serif",
        "---\nlayout: [a]\n---",
        "---\nlayout: \"serif\"\n---",
    ] {
        let _ = render(source, false);
        let _ = front_matter_layout(source);
        assert_eq!(normalize(source), source);
    }
}

#[test]
fn headings_alerts_lists_and_duplicate_anchors() {
    let html = render(
        "# 제목\n# 제목\n> [!WARNING]\n- [x] done\n    100. nested\n[^a]: note\nref [^a]",
        false,
    );
    assert!(html.contains("id=\"제목-1\""));
    assert!(html.contains("alert_warning"));
    assert!(html.contains("data-depth=\"1\""));
    assert!(html.contains("type=\"checkbox\""));
    assert!(html.contains("id=\"fn-a\""));
    assert!(html.contains("href=\"#fn-a\""));
}

#[test]
fn nested_emphasis_reference_links_setext_and_autolinks() {
    for source in ["***both***", "**bold *italic***", "*italic **bold***"] {
        let html = render(source, false);
        assert!(html.contains("<em"), "{html}");
        assert!(html.contains("<strong"), "{html}");
        assert!(!html.contains("</strong>*"), "{html}");
    }
    let html = render("Heading\n===\n[example][ref]\n[ref]: https://example.test \"Title\"\nvisit https://example.test/a.\n<details>\n<summary>Title</summary>\nBody\n</details>", false);
    assert!(html.contains("<h1"));
    assert!(html.contains("href=\"https://example.test\" title=\"Title\""));
    assert!(html.contains("href=\"https://example.test/a\""));
    assert!(html.contains("<details>"));
    assert!(html.contains("<summary>"));
}

#[test]
fn normalization_does_not_change_link_destinations() {
    let source = "[__label__](https://example.test/__path__/:smile: \"title :smile:\")\n![image](data:image/png;base64,aA==)\n[ref]: https://example.test/:smile:";
    assert_eq!(normalize(source), "[**label**](https://example.test/__path__/:smile: \"title :smile:\")\n![image](data:image/png;base64,aA==)\n[ref]: https://example.test/:smile:");
}

#[test]
fn normalization_keeps_unknown_html_and_uses_minimum_parent_list_width() {
    let source = "<widget odd=\"keep\">__raw__ :smile:</widget>\n\n100. parent\n    + child\n        * grandchild";
    let normalized = normalize(source);
    assert!(normalized.starts_with("<widget odd=\"keep\">__raw__ :smile:</widget>"));
    assert!(
        normalized.contains("100. parent\n     - child\n         - grandchild"),
        "{normalized}"
    );
    assert_eq!(normalize(&normalized), normalized);
}

#[test]
fn soft_break_is_one_paragraph_and_hard_breaks_are_br_nodes() {
    let source = "one\ntwo  \nthree\\\nfour<br>five";
    assert_eq!(parse(source).len(), 1);
    let html = render(source, false);
    assert_eq!(html.matches("data-break=\"1\"").count(), 3, "{html}");
}

#[test]
fn footnotes_order_repeated_references_and_multiline_definitions() {
    let source =
        "ref [^b] [^a] [^b] [^missing]\n\n[^a]: first\n\n    second paragraph\n[^b]: other";
    let html = render(source, false);
    assert!(html.contains("id=\"ref-b-1\""));
    assert!(html.contains("[1]</span>"));
    assert!(html.contains("[2]</span>"));
    assert!(html.contains("[^missing]"));
    let mut inside_tag = false;
    let visible: String = html
        .chars()
        .filter(|c| {
            if *c == '<' {
                inside_tag = true;
                return false;
            }
            if *c == '>' {
                inside_tag = false;
                return false;
            }
            !inside_tag
        })
        .collect();
    assert!(visible.contains("second paragraph"));
    assert_eq!(normalize(source), source);
}

#[test]
fn numeric_entities_and_email_autolinks_are_safe_text() {
    let html = render("&amp; &lt; &#x1f600; &#128512; email a@example.test", false);
    assert!(!html.contains("&amp;amp;"));
    assert!(html.contains("😀"));
    assert!(html.contains("href=\"mailto:a@example.test\""));
}

#[test]
fn hostile_and_incomplete_fragments_never_panic_or_emit_active_script() {
    let fragments = [
        "'",
        "\"",
        "<",
        ">",
        "<img src='x' onerror='bad'>",
        "<!--",
        "-->",
        "`",
        "**",
        "__[",
        "한",
        "😀",
        "|",
        "\\",
        "\n",
        "---",
        "layout: '",
    ];
    for a in fragments {
        for b in fragments {
            for c in fragments {
                let source = format!("{a}{b}{c}");
                let rendered = render(&source, false);
                assert!(!rendered.contains("<script"));
                assert!(!rendered.contains(" onerror=\""));
                let normalized = normalize(&source);
                let _ = render(&normalized, false);
                let _ = front_matter_layout(&source);
            }
        }
    }
}

#[test]
fn highlight_preserves_source_nesting_and_safe_html_without_enabling_scripts() {
    let source = "==한글 **중요** 😀== <mark onclick=\"bad()\" style=\"color:red\">표시</mark> H~2~O X^2^ ~~취소~~";
    let html = render(source, true);
    assert!(html.contains("<mark data-kind=\"highlight\""));
    assert!(html.contains("data-kind=\"bold\""));
    assert!(html.contains("<mark>"));
    assert!(!html.contains("onclick") && !html.contains("color:red"));
    assert!(!html.contains("<sub") && !html.contains("<sup"));
    assert!(html.contains("X^2^"));
    assert!(render("before==marked==after", false).contains("data-kind=\"highlight\""));
    assert!(html.contains("data-kind=\"strikethrough\""));
    assert_eq!(normalize(source), source);
}

#[test]
fn highlight_does_not_consume_escaped_incomplete_code_or_equality_runs() {
    for source in [
        r"\==literal==",
        "==unfinished",
        "== spaced ==",
        "===literal===",
        "==line\nline==",
        "`==code==`",
        "```json\n\"==code==\"\n```",
        "<!-- ==comment== -->",
    ] {
        assert!(
            !render(source, true).contains("data-kind=\"highlight\""),
            "{source}"
        );
        assert_eq!(normalize(&normalize(source)), normalize(source));
    }
    let html = render("==a\\==b==", false);
    assert_eq!(html.matches("data-kind=\"highlight\"").count(), 1);
}

#[test]
fn heading_suffix_ids_are_safe_unique_and_keep_original_source() {
    assert_eq!(
        normalize("# __Title__ {#id__keep__}"),
        "# **Title** {#id__keep__}"
    );
    let source = "# 한글 제목 {#custom-id}\n\n[이동](#custom-id)\n\n## Again {#custom-id}\n\n# custom-id-1\n\nSetext {#setext}\n---\n\n# Bad {#x\"onclick=\"x}";
    let html = render(source, true);
    assert!(html.contains("id=\"custom-id\""));
    assert!(html.contains("id=\"custom-id-1\""));
    assert!(html.contains("id=\"custom-id-1-1\""));
    assert!(html.contains("href=\"#custom-id\""));
    assert!(html.contains("id=\"setext\""));
    assert!(!html.contains("{#custom-id}"));
    let mut in_tag = false;
    let visible: String = html
        .chars()
        .filter(|c| {
            if *c == '<' {
                in_tag = true;
                false
            } else if *c == '>' {
                in_tag = false;
                false
            } else {
                !in_tag
            }
        })
        .collect();
    assert!(visible.contains("{#x&quot;onclick=&quot;x}"));
    assert_eq!(normalize(source), source);
    let blocks = parse(source);
    assert!(blocks
        .iter()
        .all(|block| source.get(block.span.start..block.span.end).is_some()));
}

#[test]
fn definition_lists_have_multiple_definitions_inline_markup_and_stable_spans() {
    let source =
        "한글😀\n: ==첫 정의==\n: **두 번째**\n    이어진 줄\n\n다른 용어\n: `code`\n\n일반 문단";
    let blocks = parse(source);
    let entries = blocks
        .iter()
        .find_map(|block| {
            if let BlockKind::DefinitionList { entries } = &block.kind {
                Some(entries)
            } else {
                None
            }
        })
        .unwrap();
    assert_eq!(entries.len(), 2);
    assert_eq!(entries[0].1.len(), 2);
    assert_eq!(&source[entries[0].0.start..entries[0].0.end], "한글😀");
    for (term, definitions) in entries {
        assert!(source.get(term.start..term.end).is_some());
        for span in definitions {
            assert!(source.get(span.start..span.end).is_some());
        }
    }
    let html = render(source, false);
    assert_eq!(html.matches("<dt ").count(), 2);
    assert_eq!(html.matches("<dd ").count(), 3);
    assert!(html.contains("data-kind=\"highlight\""));
    assert!(html.contains("일반") && html.contains("문단"));
    assert_eq!(normalize(source), source);
    assert!(!render("term\n:not a definition", false).contains("<dl"));
}

#[test]
fn code_coloring_is_escaped_source_mapped_and_unknown_languages_are_plain() {
    let source = "```json\n{\"name\": \"한😀<script>\", \"ok\": true, \"count\": 12}\n```\n\n```rust\n/* ==raw==\nstill comment */ let answer = 42;\n```";
    let html = render(source, false);
    for kind in ["key", "string", "literal", "number", "comment", "keyword"] {
        assert!(html.contains(&format!("syntax_{kind}")), "{kind}");
    }
    assert!(!html.contains("<script>"));
    assert!(!html.contains("data-kind=\"highlight\""));
    assert!(html.contains("&lt;script&gt;"));
    assert!(!render("```unknown\nlet answer = 42;\n```", false).contains("syntax_keyword"));
    assert_eq!(normalize(source), source);
}

#[test]
fn guide_emoji_aliases_and_inline_link_suppression_work() {
    let source = ":tent: :joy: 🏕️ :unknown: http://example.com `http://example.com`";
    let html = render(source, false);
    assert!(html.contains("⛺") && html.contains("😂") && html.contains("🏕️"));
    assert_eq!(html.matches("href=\"http://example.com\"").count(), 1);
    assert!(normalize(source).contains("⛺ 😂"));
    assert!(normalize(source).contains(":unknown:"));
}

#[test]
fn gfm_heading_and_code_span_boundaries_preserve_source() {
    let source = "   ## heading ##\n\nTitle\n=\n\n` foo ` and ``a ` b`` and `a\nb`";
    let html = render(source, true);
    assert!(html.contains("heading"));
    assert!(!html.contains("heading ##"));
    assert!(html.contains("<h1"));
    let normalized = normalize(source);
    assert!(normalized.contains("` foo `") && normalized.contains("``a ` b``"));
    assert!(render("*foo`*`", true).contains("<code"));
    assert!(!render("*foo`*`", true).contains("data-kind=\"italic\""));
}
#[test]
fn gfm_table_width_and_full_named_character_references() {
    assert!(!parse("| a | b |\n| --- |\n| c | d |")
        .iter()
        .any(|block| matches!(block.kind, BlockKind::Table { .. })));
    let blocks = parse("| a | b |\n| - | -: |\n| c |\nplain\n");
    let rows = blocks
        .iter()
        .find_map(|block| {
            if let BlockKind::Table { rows, .. } = &block.kind {
                Some(rows)
            } else {
                None
            }
        })
        .unwrap();
    assert_eq!(rows.len(), 3);
    assert!(rows.iter().all(|row| row.len() == 2));
    let html = render(
        "&copy; &Dcaron; &ClockwiseContourIntegral; &ngE; &#987654321;",
        true,
    );
    assert!(html.contains('©') && html.contains('Ď') && html.contains('∲') && html.contains("≧̸"));
    assert!(html.contains("&amp;#987654321;"));
}
