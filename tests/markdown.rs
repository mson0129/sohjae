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
    let source = "---\nlayout: default\nname: :smile:\n---\n__bold__ :smile: :unknown:\n`__code__ :smile:`\n```\n__code__ :smile:\n```\n<!-- __comment__ :smile: -->\n<br />\n\nline  \nnext\\\nlast";
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
        "# 제목\n# 제목\n> [!WARNING]\n- [x] done\n\n    100. nested\n[^a]: note\nref [^a]",
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
    let html = render("Heading\n===\n[example][ref]\n\n[ref]: https://example.test \"Title\"\nvisit https://example.test/a.\n<details>\n<summary>Title</summary>\nBody\n</details>", false);
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
    let source = "<widget odd=\"keep\">__raw__ :smile:</widget>\n\n100. parent\n     + child\n         * grandchild";
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
    assert_eq!(
        normalize(source),
        source.replace("Setext {#setext}\n---", "## Setext {#setext}")
    );
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

#[test]
fn setext_cannot_promote_list_items_or_other_block_starters() {
    let source = "## 서명\n- 이메일 하단에 자동으로 작성될 내용을 지정\n-";
    let blocks = parse(source);
    assert_eq!(blocks.len(), 3);
    assert!(matches!(
        blocks[0].kind,
        BlockKind::Heading { level: 2, .. }
    ));
    assert!(matches!(
        blocks[1].kind,
        BlockKind::ListItem { depth: 0, .. }
    ));
    assert!(
        matches!(blocks[2].kind, BlockKind::ListItem { ref content, .. } if content.start == content.end)
    );
    for reading in [false, true] {
        let html = render(source, reading);
        assert_eq!(html.matches("<h2 ").count(), 1);
        assert_eq!(html.matches("data-kind=\"list\"").count(), 2);
    }
    for prefix in [
        "- item",
        "* item",
        "+ item",
        "1. item",
        "- [x] task",
        "    - nested",
    ] {
        for underline in ["-", "--", "---", "="] {
            let source = format!("{prefix}\n{underline}");
            assert!(
                !parse(&source)
                    .iter()
                    .any(|b| matches!(b.kind, BlockKind::Heading { .. })),
                "{source}"
            );
        }
    }
    for source in ["> quote\n-", "```\n-\n```", "    code\n-", "***\n-"] {
        assert!(!render(source, true).contains("<h2"), "{source}");
    }
    assert_eq!(render("## heading\n-", true).matches("<h2 ").count(), 1);
    for (source, level) in [
        ("paragraph\n-", 2),
        ("paragraph\n---", 2),
        ("paragraph\n=", 1),
    ] {
        assert!(
            matches!(parse(source)[0].kind, BlockKind::Heading {level: actual, ..} if actual == level)
        );
    }
    for marker in ["-", "*", "+"] {
        assert!(matches!(parse(marker)[0].kind, BlockKind::ListItem { .. }));
    }
}

#[test]
fn empty_list_markers_do_not_interrupt_paragraphs() {
    for source in ["foo\n*", "*foo bar\n*", "foo\n+"] {
        assert!(!render(source, true).contains("data-kind=\"list\""));
    }
}

#[test]
fn four_space_root_list_marker_is_code_not_a_list() {
    assert!(matches!(
        parse("    - item")[0].kind,
        BlockKind::Code { .. }
    ));
    assert!(render("- parent\n  - child", true).contains("data-depth=\"1\""));
    assert!(!render("paragraph\n2. continuation", true).contains("<ol"));
}

#[test]
fn hierarchical_lists_quotes_and_loose_items_are_semantic_containers() {
    let html = render("> - 첫째\n>   1. 둘째\n>      > 셋째😀\n>\n> - 넷째", true);
    assert_eq!(html.matches("<blockquote ").count(), 2);
    assert!(html.contains("<ul>") && html.contains("<ol>") && html.contains("<li "));
    assert!(html.contains("data-depth=\"1\""));
    assert!(!html.contains("<div class=\"list_item\""));
    let loose = render("- a\n\n- b\n\n  continuation", true);
    assert!(loose.contains("<p>") && loose.matches("<li ").count() == 2);
    assert!(render("3. a\n4. b", true).contains("<ol start=\"3\">"));
}
#[test]
fn container_source_maps_keep_original_utf8_boundaries_and_empty_ranges() {
    let source = "> 한😀\n>\n> - 안녕\n>   - **세계**\n>     continued\n\n# 한😀";
    for reading in [false, true] {
        let html = render(source, reading);
        for tag in html
            .split('<')
            .filter_map(|part| part.split_once('>').map(|pair| pair.0))
        {
            let position = |key: &str| -> Option<usize> {
                let tail = tag.split_once(key)?.1;
                tail.split('"').next()?.parse().ok()
            };
            if let Some(start) = position("data-start=\"") {
                assert!(source.is_char_boundary(start), "{tag}");
                if let Some(end) = position("data-end=\"") {
                    assert!(start <= end && source.is_char_boundary(end), "{tag}");
                }
            }
        }
        let at = source.find("안녕").unwrap();
        assert!(html.contains(&format!(
            "data-start=\"{at}\" data-end=\"{}\">안녕",
            at + "안녕".len()
        )));
    }
}
#[test]
fn delimiter_flanking_rule_of_three_and_bracket_scope_are_respected() {
    assert!(!render("a*\"foo\"*", true).contains("<em"));
    assert!(!render("foo_bar_baz", true).contains("<em"));
    let html = render("*[foo*](/uri)", true);
    assert_eq!(html.matches("<a ").count(), 1);
    assert!(!html.contains("<em"));
    let html = render("**foo *bar **baz**\nbim* bop**", true);
    assert_eq!(html.matches("<strong ").count(), 2);
    assert_eq!(html.matches("<em ").count(), 1);
    assert_eq!(render("****foo****", true).matches("<strong ").count(), 1);
    assert!(render("*foo**bar***", true).contains("<strong"));
}
#[test]
fn link_destinations_titles_images_and_nested_anchor_precedence() {
    let html = render(
        "[a](</my uri> 'a &amp; b') [x]() ![**alt**](/img.png)",
        true,
    );
    assert!(html.contains("href=\"/my%20uri\" title=\"a &amp; b\""));
    assert!(html.contains("href=\"\""));
    assert!(html.contains("alt=\"alt\""));
    assert!(!render("[link](/my uri)", true).contains("<a "));
    assert_eq!(
        render("[https://example.test](/outer)", true)
            .matches("<a ")
            .count(),
        1
    );
    let html = render("[outer [inner](/inner)](/outer)", true);
    assert!(!html.contains("href=\"/outer\""));
    assert!(html.contains("href=\"/inner\""));
    assert!(!render("[x](javascript&colon;alert(1))", true).contains("href="));
}
#[test]
fn reference_definitions_collect_across_containers_before_rendering() {
    let source="[foo] [multi word]\n\n> [foo]: /first\n\n[foo]: /second\n\n[multi word]:\n  <my url>\n  'a title'";
    let html = render(source, true);
    assert!(html.contains("href=\"/first\""));
    assert!(!html.contains("href=\"/second\""));
    assert!(html.contains("href=\"my%20url\" title=\"a title\""));
    let html = render("text\n[foo]: /url\n\n[foo]", true);
    assert!(!html.contains("href=\"/url\""));
    let html = render("[foo]: /url\n\"title\" ok", true);
    assert!(!html.contains("[foo]"));
    assert!(html.contains("title"));
}
#[test]
fn rendering_depth_limits_and_context_isolation_are_safe() {
    let deep = format!("{}text", "> ".repeat(100));
    assert!(!render(&deep, true).contains("<script"));
    let images = format!("{}alt{}", "![".repeat(70), "](/image)".repeat(70));
    assert!(!render(&images, true).contains("<script"));
    assert!(render("[x]\n\n> [x]: /one", true).contains("href=\"/one\""));
    assert!(!render("[x]", true).contains("href="));
    let html = render("# Same\n\n> # Same\n\n# Same", true);
    let ids: Vec<_> = html
        .split(" id=\"")
        .skip(1)
        .map(|part| part.split('"').next().unwrap())
        .collect();
    let unique: std::collections::HashSet<_> = ids.iter().collect();
    assert_eq!(ids.len(), unique.len());
}

// Expected behavior follows the attributed GFM fixture; the inputs also exercise
// Korean/astral source coordinates used by the editor, rather than HTML alone.
fn visible_text(html: &str) -> String {
    let mut inside = false;
    html.chars()
        .filter(|c| {
            if *c == '<' {
                inside = true;
                false
            } else if *c == '>' {
                inside = false;
                false
            } else {
                !inside
            }
        })
        .collect()
}

#[test]
fn multiline_setext_and_indented_thematic_break_boundaries() {
    let source = "  첫째 *한글\n둘째😀*\n===\n";
    let html = render(source, true);
    assert_eq!(html.matches("<h1 ").count(), 1);
    assert_eq!(html.matches("<em ").count(), 1);
    assert_eq!(visible_text(&html), "첫째 한글\n둘째😀");
    for source in ["foo\n    ---", "foo\n    ***"] {
        let html = render(source, true);
        assert!(!html.contains("<hr") && !html.contains("<h2"));
    }
    for source in ["> 한글\n---", "- 한글\n---"] {
        let html = render(source, true);
        assert!(html.contains("<hr"));
        assert!(!html.contains("<h2"));
    }
    let html = render("> 한글\n이어짐\n===", true);
    assert!(!html.contains("<h1"));
    assert!(visible_text(&html).contains("한글\n이어짐\n==="));
}

#[test]
fn fenced_code_indent_closers_info_and_blank_lines() {
    let html = render("   ```rs\n   한글\n    😀\n  끝\n\n   ```", true);
    assert!(html.contains("<pre data-kind=\"code_block\""));
    assert_eq!(visible_text(&html), "한글\n 😀\n끝\n\n");
    assert_eq!(
        visible_text(&render("```\na\n    ```\n", true)),
        "a\n    ```\n"
    );
    for source in ["``` aa ```\nfoo", "```foo``"] {
        assert!(!render(source, true).contains("<pre"));
    }
    assert!(!render("```foo``", true).contains("<code"));
    assert_eq!(
        visible_text(&render("\n    \n    한글\n    \n\n", true)),
        "한글\n"
    );
    assert_eq!(
        visible_text(&render("    a\n\n\n    b", true)),
        "a\n\n\nb\n"
    );
}

#[test]
fn tabs_in_container_prefixes_keep_columns_and_original_utf8_coordinates() {
    for source in [
        "- 한😀\n\n\t\t끝\n",
        ">\t\t끝😀\n",
        "-\t\t끝😀\n",
        " - 한\n   - 글\n\t - 😀\n",
    ] {
        for reading in [false, true] {
            let html = render(source, reading);
            for tag in html
                .split('<')
                .filter_map(|s| s.split_once('>').map(|p| p.0))
            {
                let offset = |key: &str| {
                    tag.split_once(key)
                        .and_then(|p| p.1.split('"').next()?.parse::<usize>().ok())
                };
                if let (Some(start), Some(end)) = (offset("data-start=\""), offset("data-end=\"")) {
                    assert!(start <= end && end <= source.len(), "{tag}");
                    assert!(
                        source.is_char_boundary(start) && source.is_char_boundary(end),
                        "{tag}"
                    );
                }
            }
            assert!(html.contains('😀'));
        }
    }
    for source in [">\t\t끝😀\n", "-\t\t끝😀\n"] {
        assert_eq!(
            visible_text(&render(source, true)).trim_matches('\n'),
            "  끝😀"
        );
    }
    assert_eq!(visible_text(&render(">\t\t\t끝😀", true)), "  \t끝😀\n");
    assert_eq!(
        render(" - 한\n   - 글\n\t - 😀", true)
            .matches("<ul>")
            .count(),
        3
    );
}

#[test]
fn blank_lines_are_scoped_to_the_innermost_list_or_code_block() {
    let html = render("- 한\n  - 글\n\n    😀\n- 끝", true);
    assert_eq!(html.matches("<p>").count(), 2);
    let html = render("- 한\n- ```\n  글\n\n\n  ```\n- 끝", true);
    assert!(!html.contains("<p>"));
    assert!(visible_text(&html).contains("글\n\n\n"));
    let html = render("-\n\n  한글", true);
    assert!(html.contains("</ul></section><section"));
    assert_eq!(html.matches("<p>").count(), 1);
    let html = render(">     한글\n    😀", true);
    assert_eq!(html.matches("<pre ").count(), 2);
    assert!(html.contains("</blockquote></section><section"));
}

#[test]
fn invalid_inline_links_fall_back_and_non_ascii_spaces_remain_in_destinations() {
    let html = render("[한글](not a link)\n\n[한글]: /대상", true);
    assert!(html.contains("href=\"/%EB%8C%80%EC%83%81\""));
    assert!(visible_text(&html).contains("한글(not a link)"));
    let html = render("[링크](/url\u{a0}\"title\")", true);
    assert!(html.contains("href=\"/url%C2%A0%22title%22\""));
    assert!(!html.contains(" title="));
    assert!(render("<https://example.test/?q=[한글]>", true).contains("%5B%ED%95%9C%EA%B8%80%5D"));
}

#[test]
fn malformed_allowed_html_is_text_and_autolinks_protect_delimiters() {
    for source in [
        "<a h*#ref=\"hi\">",
        "<a href='bar'title=title>",
        "</a href=\"foo\">",
        "<a href=hi'>",
        "<33> <__>",
    ] {
        let html = render(source, true);
        assert!(!html.contains("<a>") && !html.contains("</a>"));
        assert!(!html.contains("raw_block"));
        assert!(html.contains("&lt;"));
    }
    for source in ["**a<http://foo.bar/?q=**>", "__a<http://foo.bar/?q=__>"] {
        let html = render(source, true);
        assert!(!html.contains("<strong"));
        assert!(html.contains("<a href=\"http://foo.bar/?q="));
    }
    assert!(!render("<img src='javascript:bad' onerror='bad()'>", true).contains("javascript:"));
    assert!(!render("<script>alert(1)</script>", true).contains("<script"));
}

#[test]
fn extended_autolink_suffixes_preserve_https_preference() {
    let html = render("www.example.test/a(b)))", true);
    assert!(html.contains("href=\"https://www.example.test/a(b)\""));
    assert!(visible_text(&html).ends_with("a(b)))"));
    let html = render("www.example.test/?q=x&hl;", true);
    assert!(html.contains("href=\"https://www.example.test/?q=x\""));
    assert!(!render("a.b-c_d@a.b-", true).contains("mailto:"));
    assert!(render("a.b-c_d@a.b.", true).contains("mailto:a.b-c_d@a.b\""));
}

#[test]
fn allowed_html_blocks_preserve_literal_markdown_and_do_not_interrupt_paragraphs() {
    let source = "<ins>\n*한😀*\n</ins>";
    assert_eq!(normalize(source), source);
    let html = render(source, true);
    assert!(html.contains("<ins>"));
    assert!(!html.contains("<em") && !html.contains("<p>"));
    assert!(visible_text(&html).contains("*한😀*"));
    assert!(render("앞\n<ins>\n*강조*", true).contains("<em "));
    assert!(render("    <ins>\n    *literal*", true).contains("<pre "));
    assert!(!render("    <ins>\n    *literal*", true).contains("<ins>"));
}

#[test]
fn incremental_cache_matches_full_render_for_every_gfm_fixture_and_edits() {
    let fixture = include_str!("fixtures/gfm-spec.txt");
    let mut cache = RenderCache::default();
    let mut examples = 0;
    let mut source = None::<String>;
    let mut expected = false;
    for line in fixture.split_inclusive('\n') {
        if line.starts_with("```````````````````````````````` example") {
            source = Some(String::new());
            expected = false;
        } else if source.is_some() && !expected && line.trim_end() == "." {
            let text = source.as_ref().unwrap().replace('→', "\t");
            assert_eq!(
                cache.render(&text),
                render(&text, false),
                "example {}",
                examples + 1
            );
            examples += 1;
            expected = true;
        } else if !expected {
            if let Some(source) = &mut source {
                source.push_str(line);
            }
        }
    }
    assert_eq!(examples, 672);
    for source in [
        "한글😀\n\nsecond\n\nthird",
        "앞\n\n한글😀\n\nsecond\n\nthird",
        "앞\n\n수정\n\nsecond\n\nthird",
        "앞\n\n수정\n\nsecond\n\nthird\n",
        "# 제목\n\n[ref]\n\n[ref]: /target",
        "평문\n\n끝",
        "# Same\n\nhello\n\n# Same\n\n# Same {#Same-1}",
    ] {
        assert_eq!(cache.render(source), render(source, false));
    }
    cache.clear();
    cache.render("첫째\n\n둘째\n\n셋째");
    cache.render("수정됨\n\n둘째\n\n셋째");
    assert_eq!(cache.stats.parsed, 1);
    assert!(cache.stats.reused >= 2 && !cache.stats.fallback);
    cache.render("[ref]\n\n[ref]: /target");
    assert!(cache.stats.fallback);
}

#[test]
fn definition_list_paragraphs_nested_blocks_and_following_text_are_bounded() {
    let source="용어😀\n\n: 첫 문단\n\n    다음 문단\n\n    - 중첩\n      - 목록\n\n    ```rs\n    let n = 1;\n    ```\n: 두 번째 정의\n\n밖의 문단";
    let html = render(source, true);
    assert_eq!(html.matches("<dd ").count(), 2);
    assert!(html.contains("<ul>") && html.contains("<pre "));
    assert!(visible_text(&html).contains("밖의 문단"));
    let blocks = parse(source);
    assert!(matches!(blocks[0].kind, BlockKind::DefinitionList { .. }));
    assert_eq!(&source[blocks[0].span.end..], "\n\n밖의 문단");
    assert!(normalize(source).contains("let n = 1;"));
    assert!(
        render("[ref]\n\n용어\n: 내용\n\n    [ref]: /nested", true).contains("href=\"/nested\"")
    );
}

#[test]
fn normalization_respects_flanking_code_urls_and_rendering_meaning() {
    for source in [
        "foo__bar__baz",
        "100. parent\n    + child\n        * grandchild",
        "```rs\n__raw__\n```",
        "[__label__](https://x.test/__keep__)\n\n[ref]: /__keep__",
    ] {
        let normalized = normalize(source);
        assert_eq!(normalize(&normalized), normalized);
        if source.starts_with("foo") || source.starts_with("100.") || source.starts_with("```") {
            assert_eq!(normalized, source);
        }
        if source.starts_with('[') {
            assert!(normalized.contains("https://x.test/__keep__"));
        }
    }
    assert_eq!(
        normalize("Title\n===\n\n_an italic_ and __bold__"),
        "# Title\n\n*an italic* and **bold**"
    );
}

#[test]
fn stateful_code_coloring_handles_multiline_strings_comments_templates_and_regex() {
    let python = render(
        "```py\nx = \"\"\"한😀\n# string, not comment\nend\"\"\"\n# comment\n```",
        true,
    );
    assert_eq!(python.matches("syntax_comment").count(), 1);
    assert_eq!(python.matches("syntax_string").count(), 3);
    let rust = render(
        "```rs\n/* outer /* nested */\nstill comment */ let n=1;\n```",
        true,
    );
    assert_eq!(rust.matches("syntax_comment").count(), 2);
    assert!(rust.contains("syntax_keyword"));
    let js = render(
        "```js\nconst x = `한 ${1 + 2}\n${/a[\\/]+/gi.test('x')} 끝`;\nconst y = 10 / 2;\n```",
        true,
    );
    assert!(js.matches("syntax_string").count() >= 4);
    assert!(js.matches("syntax_number").count() >= 4);
    assert!(!js.contains("<script"));
}
