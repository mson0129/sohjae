//! Source-preserving Markdown tree and a renderer with UTF-8 source coordinates.
//! Unknown constructs remain text. No source HTML is inserted verbatim into the DOM.
use std::fmt::Write;
mod cache;
mod containers;
pub use cache::{RenderCache, RenderStats};
mod inlines;
mod normalization;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Span {
    pub start: usize,
    pub end: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Block {
    pub span: Span,
    pub kind: BlockKind,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum BlockKind {
    FrontMatter,
    Html,
    ReferenceDefinition,
    Raw,
    Code {
        content: Span,
        language: String,
        indent: usize,
    },
    Table {
        rows: Vec<Vec<Span>>,
        align: Vec<String>,
    },
    Heading {
        level: usize,
        content: Span,
    },
    DefinitionList {
        entries: Vec<(Span, Vec<Span>)>,
    },
    Rule,
    Quote {
        content: Span,
        alert: Option<String>,
    },
    ListItem {
        content: Span,
        ordered: Option<usize>,
        depth: usize,
        checked: Option<bool>,
    },
    Footnote {
        name: String,
        content: Span,
    },
    Comment,
    Paragraph,
}

#[derive(Clone, Debug)]
struct Line<'a> {
    text: &'a str,
    start: usize,
    end: usize,
}

fn lines(source: &str) -> Vec<Line<'_>> {
    let mut offset = 0;
    source
        .split('\n')
        .map(|text| {
            let start = offset;
            offset += text.len() + 1;
            Line {
                text,
                start,
                end: start + text.len(),
            }
        })
        .collect()
}

pub fn parse(source: &str) -> Vec<Block> {
    let lines = lines(source);
    let mut blocks = Vec::new();
    let mut index = 0;
    while index < lines.len() {
        let line = &lines[index];
        let start = line.start;
        let mut end = line.end;
        let kind = if index == 0 && line.text == "---" {
            if let Some(close) = lines[1..].iter().position(|line| line.text == "---") {
                index = close + 1;
                end = lines[index].end;
                BlockKind::FrontMatter
            } else {
                BlockKind::Rule
            }
        } else if indentation(line.text).0 <= 3
            && unknown_html_name(line.text.trim()).is_some()
            && inlines::html_end(source[start..].trim_start()).is_some()
        {
            let name = unknown_html_name(line.text.trim()).unwrap();
            let close = format!("</{name}>");
            if !line.text.contains(&close) && source[line.end..].contains(&close) {
                while index + 1 < lines.len() && !lines[index].text.contains(&close) {
                    index += 1;
                }
                end = lines[index].end;
            }
            BlockKind::Raw
        } else if indentation(line.text).0 <= 3
            && (line.text.trim_start().starts_with("<details")
                || line.text.trim_start().starts_with("<picture"))
        {
            let close = if line.text.trim_start().starts_with("<details") {
                "</details>"
            } else {
                "</picture>"
            };
            while index + 1 < lines.len() && !lines[index].text.contains(close) {
                index += 1;
            }
            end = lines[index].end;
            BlockKind::Html
        } else if indentation(line.text).0 <= 3
            // BR is an inline editing break even when alone on its source line.
            && !matches!(line.text.trim().to_ascii_lowercase().as_str(), "<br>" | "<br/>" | "<br />")
            && html_tag(line.text.trim())
                .is_some_and(|(length, _)| length == line.text.trim().len())
            && !blocks.last().is_some_and(|b: &Block| {
                matches!(b.kind, BlockKind::Paragraph)
                    && !source[b.span.start..b.span.end].trim().is_empty()
            })
        {
            while index + 1 < lines.len() && !lines[index + 1].text.trim().is_empty() {
                index += 1;
            }
            end = lines[index].end;
            BlockKind::Html
        } else if let Some((_, _, _, length)) = inlines::definition(&source[start..]).filter(|_| {
            !blocks.last().is_some_and(|block: &Block| {
                matches!(block.kind, BlockKind::Paragraph)
                    && !source[block.span.start..block.span.end].trim().is_empty()
            })
        }) {
            end = start + length;
            while index + 1 < lines.len() && lines[index + 1].start < end {
                index += 1;
            }
            BlockKind::ReferenceDefinition
        } else if let Some((marker, length, language)) = fence(line.text) {
            let content_start = (line.end + 1).min(source.len());
            let mut next = index + 1;
            while next < lines.len() {
                let raw = lines[next].text;
                let text = raw.trim();
                if indentation(raw).0 <= 3
                    && text.bytes().take_while(|byte| *byte == marker).count() >= length
                    && text.bytes().all(|byte| byte == marker)
                {
                    break;
                }
                next += 1;
            }
            let content_end = if next < lines.len() {
                lines[next].start.max(content_start)
            } else {
                source.len()
            };
            index = next.min(lines.len() - 1);
            end = lines[index].end;
            BlockKind::Code {
                content: Span {
                    start: content_start,
                    end: content_end,
                },
                language,
                indent: indentation(line.text).0,
            }
        } else if !line.text.trim().is_empty()
            && indentation(line.text).0 >= 4
            && !blocks.last().is_some_and(|block: &Block| {
                matches!(block.kind, BlockKind::ListItem { .. })
                    || matches!(block.kind, BlockKind::Paragraph)
                        && !source[block.span.start..block.span.end].trim().is_empty()
            })
        {
            let content_start = start;
            let mut next = index + 1;
            while next < lines.len() {
                if indentation(lines[next].text).0 >= 4 && !lines[next].text.trim().is_empty() {
                    index = next;
                } else if !lines[next].text.trim().is_empty() {
                    break;
                }
                next += 1;
            }
            end = lines[index].end;
            BlockKind::Code {
                content: Span {
                    start: content_start,
                    end,
                },
                language: String::new(),
                indent: 4,
            }
        } else if line.text.trim_start().starts_with("<!--") && !line.text.contains("-->") {
            while index + 1 < lines.len() && !lines[index].text.contains("-->") {
                index += 1;
            }
            end = lines[index].end;
            BlockKind::Comment
        } else if line.text.trim().starts_with("<!--") && line.text.trim().ends_with("-->") {
            BlockKind::Comment
        } else if index + 1 < lines.len()
            && line.text.contains('|')
            && table_separator(lines[index + 1].text)
                .is_some_and(|align| align.len() == table_cells(line.text, start).len())
        {
            let align = table_separator(lines[index + 1].text).unwrap();
            let mut rows = vec![table_cells(line.text, start)];
            index += 1;
            end = lines[index].end;
            while index + 1 < lines.len()
                && !lines[index + 1].text.trim().is_empty()
                && !lines[index + 1].text.trim_start().starts_with('>')
                && atx_heading(lines[index + 1].text).is_none()
                && list_prefix(lines[index + 1].text).is_none()
                && fence(lines[index + 1].text).is_none()
                && !is_rule(lines[index + 1].text)
            {
                index += 1;
                let mut cells = table_cells(lines[index].text, lines[index].start);
                cells.truncate(align.len());
                cells.resize(
                    align.len(),
                    Span {
                        start: lines[index].end,
                        end: lines[index].end,
                    },
                );
                rows.push(cells);
                end = lines[index].end;
            }
            BlockKind::Table { rows, align }
        } else {
            if let Some((level, content_start, content_end)) = atx_heading(line.text) {
                BlockKind::Heading {
                    level,
                    content: Span {
                        start: start + content_start,
                        end: start + content_end,
                    },
                }
            } else if is_rule(line.text) {
                BlockKind::Rule
            } else if let Some(body) = line
                .text
                .strip_prefix("> ")
                .or_else(|| line.text.strip_prefix('>'))
            {
                let alert = body
                    .strip_prefix("[!")
                    .and_then(|s| s.strip_suffix(']'))
                    .filter(|name| {
                        ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"].contains(name)
                    })
                    .map(str::to_string);
                BlockKind::Quote {
                    content: Span {
                        start: end - body.len(),
                        end,
                    },
                    alert,
                }
            } else if let Some((prefix, ordered, checked)) =
                list_prefix(line.text).filter(|(prefix, ordered, _)| {
                    !blocks.last().is_some_and(|block| {
                        matches!(block.kind, BlockKind::Paragraph)
                            && !source[block.span.start..block.span.end].trim().is_empty()
                    }) || (!line.text[*prefix..].trim().is_empty()
                        && line.text.bytes().take_while(|b| *b == b' ').count() <= 3
                        && ordered.is_none_or(|n| n == 1))
                })
            {
                let spaces = line.text.bytes().take_while(|byte| *byte == b' ').count();
                BlockKind::ListItem {
                    content: Span {
                        start: start + prefix,
                        end,
                    },
                    ordered,
                    depth: spaces / 4,
                    checked,
                }
            } else if !line.text.trim().is_empty() && definition_follows(&lines, index).is_some() {
                let entries = parse_definition_list(&lines, &mut index);
                end = lines[index].end;
                BlockKind::DefinitionList { entries }
            } else if let Some(rest) = line.text.strip_prefix("[^") {
                if let Some(close) = rest.find("]: ") {
                    let name = rest[..close].to_string();
                    let content_start = start + close + 5;
                    while index + 1 < lines.len()
                        && (lines[index + 1].text.starts_with("    ")
                            || (lines[index + 1].text.is_empty()
                                && index + 2 < lines.len()
                                && lines[index + 2].text.starts_with("    ")))
                    {
                        index += 1;
                    }
                    end = lines[index].end;
                    BlockKind::Footnote {
                        name,
                        content: Span {
                            start: content_start,
                            end,
                        },
                    }
                } else {
                    BlockKind::Paragraph
                }
            } else if !line.text.trim().is_empty()
                && index + 1 < lines.len()
                && setext_level(lines[index + 1].text).is_some()
            {
                // Only paragraph content can become a setext heading. In particular,
                // a following empty list marker must not promote a list/ATX block.
                let level = setext_level(lines[index + 1].text).unwrap();
                let content = Span {
                    start: start + line.text.len() - line.text.trim_start().len(),
                    end: start + line.text.trim_end().len(),
                };
                index += 1;
                end = lines[index].end;
                BlockKind::Heading { level, content }
            } else {
                BlockKind::Paragraph
            }
        };
        blocks.push(Block {
            span: Span { start, end },
            kind,
        });
        index += 1;
    }
    let mut merged: Vec<Block> = Vec::new();
    for block in blocks {
        if matches!(block.kind, BlockKind::Paragraph)
            && !source[block.span.start..block.span.end].trim().is_empty()
        {
            if let Some(previous) = merged.last_mut() {
                if matches!(previous.kind, BlockKind::Paragraph)
                    && !source[previous.span.start..previous.span.end]
                        .trim()
                        .is_empty()
                {
                    previous.span.end = block.span.end;
                    continue;
                }
            }
        }
        if let BlockKind::Heading { level, content } = &block.kind {
            if source[block.span.start..content.start].trim().is_empty() {
                if let Some(previous) = merged.last_mut().filter(|b| {
                    matches!(b.kind, BlockKind::Paragraph)
                        && !source[b.span.start..b.span.end].trim().is_empty()
                }) {
                    let begin = previous.span.start
                        + source[previous.span.start..previous.span.end].len()
                        - source[previous.span.start..previous.span.end]
                            .trim_start()
                            .len();
                    previous.kind = BlockKind::Heading {
                        level: *level,
                        content: Span {
                            start: begin,
                            end: content.end,
                        },
                    };
                    previous.span.end = block.span.end;
                    continue;
                }
            }
        }
        merged.push(block);
    }
    merged
}

fn definition_follows(lines: &[Line<'_>], index: usize) -> Option<usize> {
    let mut next = index + 1;
    while next < lines.len() && lines[next].text.trim().is_empty() {
        next += 1;
    }
    lines
        .get(next)
        .filter(|line| line.text.starts_with(": "))
        .map(|_| next)
}
fn parse_definition_list(lines: &[Line<'_>], index: &mut usize) -> Vec<(Span, Vec<Span>)> {
    let mut entries = Vec::new();
    loop {
        let term = Span {
            start: lines[*index].start,
            end: lines[*index].end,
        };
        let mut definitions = Vec::new();
        while let Some(next) = definition_follows(lines, *index) {
            *index = next;
            let start = lines[*index].start + 2;
            loop {
                let next = *index + 1;
                if next >= lines.len() {
                    break;
                }
                if indentation(lines[next].text).0 >= 4 && !lines[next].text.trim().is_empty() {
                    *index = next;
                    continue;
                }
                if lines[next].text.trim().is_empty() {
                    let mut after = next;
                    while after < lines.len() && lines[after].text.trim().is_empty() {
                        after += 1;
                    }
                    if after < lines.len() && indentation(lines[after].text).0 >= 4 {
                        *index = after;
                        continue;
                    }
                }
                break;
            }
            definitions.push(Span {
                start,
                end: lines[*index].end,
            });
        }
        entries.push((term, definitions));
        let mut next = *index + 1;
        while next < lines.len() && lines[next].text.trim().is_empty() {
            next += 1;
        }
        if next >= lines.len() || definition_follows(lines, next).is_none() {
            break;
        }
        *index = next;
    }
    entries
}

// A suffix is recognized only when separated from the heading by whitespace.
// Invalid IDs remain visible source. Duplicate explicit/automatic IDs get suffixes.
fn heading_suffix(body: &str) -> (&str, Option<&str>) {
    let trimmed = body.trim_end();
    if let Some(prefix) = trimmed.strip_suffix('}') {
        if let Some(open) = prefix.rfind("{#") {
            let id = &prefix[open + 2..];
            if open > 0
                && prefix[..open].ends_with(char::is_whitespace)
                && !id.is_empty()
                && id
                    .chars()
                    .all(|c| c.is_alphanumeric() || "_-.:".contains(c))
            {
                return (body[..open].trim_end(), Some(id));
            }
        }
    }
    (body, None)
}

fn indentation(text: &str) -> (usize, usize) {
    let mut width = 0;
    let mut bytes = 0;
    for c in text.chars() {
        match c {
            ' ' => width += 1,
            '\t' => width += 4 - width % 4,
            _ => break,
        }
        bytes += c.len_utf8();
    }
    (width, bytes)
}
fn deindent(text: &str, columns: usize) -> (usize, usize) {
    let mut width = 0;
    let mut bytes = 0;
    for c in text.chars() {
        if width >= columns {
            break;
        }
        match c {
            ' ' => width += 1,
            '\t' => width += 4 - width % 4,
            _ => break,
        }
        bytes += c.len_utf8();
    }
    (bytes, width.saturating_sub(columns))
}
fn setext_level(text: &str) -> Option<usize> {
    if text.bytes().take_while(|b| *b == b' ').count() > 3 {
        return None;
    }
    let body = text.trim();
    let first = body.as_bytes().first()?;
    if (*first == b'=' || *first == b'-') && body.bytes().all(|byte| byte == *first) {
        Some(if *first == b'=' { 1 } else { 2 })
    } else {
        None
    }
}
fn atx_heading(text: &str) -> Option<(usize, usize, usize)> {
    let indent = text.bytes().take_while(|b| *b == b' ').count();
    if indent > 3 {
        return None;
    }
    let hashes = text[indent..].bytes().take_while(|b| *b == b'#').count();
    if !(1..=6).contains(&hashes)
        || text
            .as_bytes()
            .get(indent + hashes)
            .is_some_and(|b| !b" \t".contains(b))
    {
        return None;
    }
    let start = indent
        + hashes
        + text[indent + hashes..]
            .bytes()
            .take_while(|b| b" \t".contains(b))
            .count();
    let mut end = text.trim_end_matches([' ', '\t']).len();
    let closing = text[..end].bytes().rev().take_while(|b| *b == b'#').count();
    if closing > 0 && end >= closing && text[..end - closing].ends_with([' ', '\t']) {
        end = text[..end - closing].trim_end_matches([' ', '\t']).len();
    }
    Some((hashes, start, end.max(start)))
}
fn code_close(text: &str, count: usize) -> Option<usize> {
    let mut offset = 0;
    while let Some(found) = text[offset..].find('`') {
        let start = offset + found;
        let run = text[start..].bytes().take_while(|b| *b == b'`').count();
        if run == count {
            return Some(start);
        }
        offset = start + run;
    }
    None
}
fn fence(text: &str) -> Option<(u8, usize, String)> {
    let (columns, bytes) = indentation(text);
    if columns > 3 {
        return None;
    }
    let text = &text[bytes..];
    let marker = *text.as_bytes().first()?;
    if marker != b'`' && marker != b'~' {
        return None;
    }
    let length = text.bytes().take_while(|byte| *byte == marker).count();
    (length >= 3 && (marker != b'`' || !text[length..].contains('`')))
        .then(|| (marker, length, text[length..].trim().to_string()))
}

fn is_rule(text: &str) -> bool {
    if indentation(text).0 > 3 {
        return false;
    }
    let compact: String = text.chars().filter(|c| !c.is_whitespace()).collect();
    compact.len() >= 3
        && b"-*_"
            .iter()
            .any(|marker| compact.bytes().all(|b| b == *marker))
}

fn unknown_html_name(text: &str) -> Option<&str> {
    let text = text.strip_prefix('<')?.trim_start_matches('/');
    if !text.as_bytes().first()?.is_ascii_alphabetic() {
        return None;
    }
    let length = text.bytes().take_while(u8::is_ascii_alphanumeric).count();
    if length == 0
        || !matches!(
            text.as_bytes().get(length),
            Some(b'>' | b' ' | b'/' | b'\t')
        )
    {
        return None;
    }
    let name = &text[..length];
    if [
        "br", "mark", "sub", "sup", "ins", "a", "picture", "source", "img", "details", "summary",
    ]
    .contains(&name.to_ascii_lowercase().as_str())
    {
        None
    } else {
        Some(name)
    }
}

pub fn list_prefix(text: &str) -> Option<(usize, Option<usize>, Option<bool>)> {
    let spaces = text.bytes().take_while(|byte| *byte == b' ').count();
    let body = &text[spaces..];
    let (marker, ordered) = if matches!(body, "-" | "*" | "+") {
        (1, None)
    } else if body.starts_with("- ") || body.starts_with("* ") || body.starts_with("+ ") {
        (2, None)
    } else {
        let digits = body.bytes().take_while(u8::is_ascii_digit).count();
        if digits == 0
            || digits > 9
            || !matches!(body.as_bytes().get(digits), Some(b'.' | b')'))
            || body.as_bytes().get(digits + 1) != Some(&b' ')
        {
            return None;
        }
        (digits + 2, body[..digits].parse().ok())
    };
    let rest = &body[marker..];
    let checked = if rest.starts_with("[ ] ") {
        Some(false)
    } else if rest.starts_with("[x] ") || rest.starts_with("[X] ") {
        Some(true)
    } else {
        None
    };
    Some((
        spaces + marker + if checked.is_some() { 4 } else { 0 },
        ordered,
        checked,
    ))
}

pub fn table_cells(text: &str, base: usize) -> Vec<Span> {
    let mut cuts = Vec::new();
    let mut escaped = false;
    for (index, c) in text.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if c == '\\' {
            escaped = true;
            continue;
        }
        if c == '|' {
            cuts.push(index);
        }
    }
    let mut boundaries = vec![0];
    boundaries.extend(cuts.iter().map(|index| index + 1));
    let mut cells = Vec::new();
    for (index, start) in boundaries.iter().copied().enumerate() {
        let end = cuts.get(index).copied().unwrap_or(text.len());
        if start > end {
            continue;
        }
        let body = &text[start..end];
        if (index == 0 && body.trim().is_empty() && text.trim_start().starts_with('|'))
            || (index == boundaries.len() - 1
                && body.trim().is_empty()
                && text.trim_end().ends_with('|'))
        {
            continue;
        }
        let left = body.len() - body.trim_start().len();
        let right = body.trim_end().len();
        let content_start = start + left;
        cells.push(Span {
            start: base + content_start,
            end: base + (start + right).max(content_start),
        });
    }
    cells
}

fn table_separator(text: &str) -> Option<Vec<String>> {
    if !text.contains('|') {
        return None;
    }
    let cells = table_cells(text, 0);
    if cells.is_empty() {
        return None;
    }
    let mut align = Vec::new();
    for cell in cells {
        let body = &text[cell.start..cell.end];
        let dashes = body.trim_matches(':');
        if dashes.is_empty() || !dashes.bytes().all(|byte| byte == b'-') {
            return None;
        }
        align.push(
            match (body.starts_with(':'), body.ends_with(':')) {
                (true, true) => "center",
                (false, true) => "right",
                _ => "left",
            }
            .into(),
        );
    }
    Some(align)
}

pub fn escape(source: &str) -> String {
    source
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn text_span(out: &mut String, source: &str, start: usize, end: usize, displayed: Option<&str>) {
    let _ = write!(
        out,
        "<span data-text=\"1\" data-start=\"{start}\" data-end=\"{end}\">{}</span>",
        escape(displayed.unwrap_or(&source[start..end]))
    );
}

fn element(out: &mut String, tag: &str, kind: &str, span: &Span) {
    let _ = write!(
        out,
        "<{tag} data-kind=\"{kind}\" data-start=\"{}\" data-end=\"{}\">",
        span.start, span.end
    );
}

pub fn render(source: &str, reading: bool) -> String {
    containers::render(source, reading)
}
fn render_flat(source: &str, reading: bool) -> String {
    let blocks = parse(source);
    let mut out = String::new();
    let mut heading_ids = std::collections::HashSet::<String>::new();
    let mut footnote_definitions = std::collections::HashSet::new();
    for block in &blocks {
        let start = block.span.start;
        let end = block.span.end;
        if reading
            && (matches!(
                block.kind,
                BlockKind::ReferenceDefinition | BlockKind::FrontMatter | BlockKind::Comment
            ) || matches!(block.kind, BlockKind::Paragraph)
                && source[start..end].trim().is_empty())
        {
            continue;
        }
        let _ = write!(
            out,
            "<section data-block=\"1\" data-start=\"{start}\" data-end=\"{end}\">"
        );
        match &block.kind {
            BlockKind::Raw => {
                out.push_str("<pre class=\"raw_block\">");
                text_span(&mut out, source, start, end, None);
                out.push_str("</pre>");
            }
            BlockKind::Html => {
                let extension = source[start..end].trim_start().starts_with("<details")
                    || source[start..end].trim_start().starts_with("<picture");
                if !reading || extension {
                    element(&mut out, "div", "html", &block.span);
                }
                if extension {
                    inline(&mut out, source, start, end, 0, reading);
                } else {
                    let stop = if source.as_bytes().get(end) == Some(&b'\n') {
                        end + 1
                    } else {
                        end
                    };
                    let mut cursor = start;
                    while cursor < stop {
                        if let Some((length, tag)) = html_tag(&source[cursor..stop]) {
                            out.push_str(&tag);
                            cursor += length;
                        } else {
                            let first =
                                cursor + source[cursor..stop].chars().next().unwrap().len_utf8();
                            let next = source[first..stop].find('<').map_or(stop, |at| first + at);
                            text_span(&mut out, source, cursor, next, None);
                            cursor = next;
                        }
                    }
                }
                if !reading || extension {
                    out.push_str("</div>");
                }
            }
            BlockKind::ReferenceDefinition => {
                if !reading {
                    out.push_str("<pre class=\"reference_definition\">");
                    text_span(&mut out, source, start, end, None);
                    out.push_str("</pre>");
                }
            }
            BlockKind::FrontMatter | BlockKind::Comment => {
                if !reading {
                    let kind = if matches!(block.kind, BlockKind::FrontMatter) {
                        "front_matter"
                    } else {
                        "comment"
                    };
                    let _ = write!(out, "<pre class=\"{kind}\">");
                    text_span(&mut out, source, start, end, None);
                    out.push_str("</pre>");
                }
            }
            BlockKind::Code {
                content,
                language,
                indent,
            } => {
                let _ = write!(out, "<pre data-kind=\"code_block\" data-start=\"{start}\" data-end=\"{end}\"><code data-language=\"{}\">", escape(language));
                let mut lexer = crate::syntax::Lexer::default();
                let mut line_start = content.start;
                for line in source[content.start..content.end].split_inclusive('\n') {
                    let newline = line.ends_with('\n');
                    let line_end = line_start + line.len() - usize::from(newline);
                    let (trim, remainder) = deindent(&source[line_start..line_end], *indent);
                    out.push_str("<span class=\"code_line\">");
                    if remainder > 0 {
                        text_span(
                            &mut out,
                            source,
                            line_start + trim - 1,
                            line_start + trim,
                            Some(&" ".repeat(remainder)),
                        );
                    }
                    let token_start = line_start + trim;
                    let mut cursor = token_start;
                    for (from, to, kind) in lexer.tokens(&source[token_start..line_end], language) {
                        if cursor < token_start + from {
                            text_span(&mut out, source, cursor, token_start + from, None);
                        }
                        let _ = write!(out, "<span class=\"syntax_{kind}\">");
                        text_span(&mut out, source, token_start + from, token_start + to, None);
                        out.push_str("</span>");
                        cursor = token_start + to;
                    }
                    if cursor < line_end {
                        text_span(&mut out, source, cursor, line_end, None);
                    }
                    out.push_str("</span>");
                    if newline {
                        text_span(&mut out, source, line_end, line_end + 1, None);
                    }
                    line_start += line.len();
                }
                if content.start == content.end {
                    text_span(&mut out, source, content.start, content.end, None);
                }
                if content.start < content.end
                    && !source[content.start..content.end].ends_with('\n')
                {
                    out.push('\n');
                }
                out.push_str("</code></pre>");
            }
            BlockKind::Table { rows, align } => {
                let _ = write!(out, "<div class=\"table_scroll\" data-kind=\"table\" data-start=\"{start}\" data-end=\"{end}\"><table aria-label=\"표\">");
                out.push_str("<thead>");
                for (row_index, row) in rows.iter().enumerate() {
                    out.push_str("<tr>");
                    for (column, cell) in row.iter().enumerate() {
                        let tag = if row_index == 0 { "th" } else { "td" };
                        let _ = write!(out, "<{tag}{} data-cell=\"1\" data-row=\"{row_index}\" data-column=\"{column}\" data-start=\"{}\" data-end=\"{}\" class=\"align_{}\" aria-label=\"{}행 {}열{}\">", if row_index == 0 { " scope=\"col\"" } else { "" }, cell.start, cell.end, align.get(column).map(String::as_str).unwrap_or("left"), row_index + 1, column + 1, if row_index == 0 { " 머리글" } else { "" });
                        inline_context(
                            &mut out, source, cell.start, cell.end, 0, reading, true, true,
                        );
                        if cell.start == cell.end && !reading {
                            out.push_str("<br>");
                        }
                        let _ = write!(out, "</{tag}>");
                    }
                    out.push_str("</tr>");
                    if row_index == 0 {
                        out.push_str("</thead><tbody>");
                    }
                }
                out.push_str("</tbody></table></div>");
            }
            BlockKind::Heading { level, content } => {
                let body = &source[content.start..content.end];
                let (visible, explicit) = heading_suffix(body);
                let base = explicit
                    .map(str::to_string)
                    .unwrap_or_else(|| slug(visible));
                let mut id = base.clone();
                let mut suffix = 1;
                while !heading_ids.insert(id.clone()) {
                    id = format!("{base}-{suffix}");
                    suffix += 1;
                }
                let _ = write!(out, "<h{level} id=\"{}\" data-kind=\"heading\" data-start=\"{start}\" data-end=\"{end}\">", escape(&id));
                inline(
                    &mut out,
                    source,
                    content.start,
                    content.start + visible.len(),
                    0,
                    reading,
                );
                if visible.is_empty() && !reading {
                    out.push_str("<br>");
                }
                let _ = write!(out, "</h{level}>");
            }
            BlockKind::DefinitionList { entries } => {
                element(&mut out, "dl", "definition_list", &block.span);
                for (term, definitions) in entries {
                    element(&mut out, "dt", "definition_term", term);
                    inline(&mut out, source, term.start, term.end, 0, reading);
                    out.push_str("</dt>");
                    for definition in definitions {
                        element(&mut out, "dd", "definition", definition);
                        out.push_str(&containers::definition_html(source, definition, reading));
                        out.push_str("</dd>");
                    }
                }
                out.push_str("</dl>");
            }
            BlockKind::Rule => {
                let _ = write!(
                    out,
                    "<hr data-kind=\"rule\" data-start=\"{start}\" data-end=\"{end}\">"
                );
            }
            BlockKind::Quote { content, alert } => {
                element(&mut out, "blockquote", "quote", &block.span);
                if let Some(name) = alert {
                    let _ = write!(
                        out,
                        "<span class=\"alert_label alert_{}\" contenteditable=\"false\">{}</span>",
                        name.to_lowercase(),
                        name
                    );
                } else {
                    inline(&mut out, source, content.start, content.end, 0, reading);
                }
                out.push_str("</blockquote>");
            }
            BlockKind::ListItem {
                content,
                ordered,
                depth,
                checked,
            } => {
                let _ = write!(out, "<div class=\"list_item\" data-depth=\"{depth}\" data-kind=\"list\" data-start=\"{start}\" data-end=\"{end}\" style=\"margin-inline-start:{}ch\">", depth * 4);
                if let Some(value) = checked {
                    let _ = write!(out, "<input type=\"checkbox\" aria-label=\"작업 완료\" data-task=\"{start}\" contenteditable=\"false\" {} {}>", if *value { "checked" } else { "" }, if reading { "disabled" } else { "" });
                } else {
                    let marker = ordered.map_or("•".into(), |number| format!("{number}."));
                    let _ = write!(
                        out,
                        "<span class=\"list_marker\" contenteditable=\"false\">{marker}</span>"
                    );
                }
                inline(&mut out, source, content.start, content.end, 0, reading);
                out.push_str("</div>");
            }
            BlockKind::Footnote { name, content } => {
                if !footnote_definitions.insert(name.clone()) {
                    if !reading {
                        out.push_str("<pre class=\"raw_block\">");
                        text_span(&mut out, source, start, end, None);
                        out.push_str("</pre>");
                    }
                    out.push_str("</section>");
                    continue;
                }
                let number = footnote_number(source, name).map_or(name.clone(), |n| n.to_string());
                let _ = write!(out, "<div class=\"footnote\" id=\"fn-{}\" data-kind=\"footnote\" data-start=\"{start}\" data-end=\"{end}\"><span contenteditable=\"false\">[{}] </span>", escape(name), escape(&number));
                inline(&mut out, source, content.start, content.end, 0, reading);
                let _ = write!(out, "<a href=\"#ref-{}\" contenteditable=\"false\" aria-label=\"각주 참조로 돌아가기\">↩</a></div>", escape(name));
            }
            BlockKind::Paragraph => {
                out.push_str("<p>");
                let value = &source[start..end];
                let from = start + value.len() - value.trim_start_matches([' ', '\t']).len();
                let to = (start + value.trim_end_matches([' ', '\t']).len()).max(from);
                inline(&mut out, source, from, to, 0, reading);
                if start == end {
                    out.push_str("<br>");
                }
                out.push_str("</p>");
            }
        }
        out.push_str("</section>");
    }
    out
}

fn slug(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || *c == '-' || *c == '_')
        .map(|c| if c.is_whitespace() { '-' } else { c })
        .collect()
}

pub fn safe_url(url: &str, image: bool, attachment: bool) -> bool {
    if url.chars().any(|c| c.is_control() || c == '\\') {
        return false;
    }
    let lower = url.trim().to_ascii_lowercase();
    if lower.starts_with("data:") {
        if image {
            return [
                "data:image/png;base64,",
                "data:image/jpeg;base64,",
                "data:image/gif;base64,",
                "data:image/webp;base64,",
                "data:image/avif;base64,",
            ]
            .iter()
            .any(|prefix| lower.starts_with(prefix));
        }
        return attachment && lower.contains(";base64,");
    }
    if lower.starts_with("//") {
        return false;
    }
    if let Some(colon) = lower.find(':') {
        let boundary = lower.find(['/', '?', '#']).unwrap_or(lower.len());
        if colon < boundary {
            return lower.starts_with("https:")
                || lower.starts_with("http:")
                || (!image && lower.starts_with("mailto:"));
        }
    }
    true
}

fn extended_url_body(text: &str) -> &str {
    let mut body = text;
    loop {
        let previous = body.len();
        if body.ends_with(';') {
            if let Some(amp) = body.rfind('&') {
                let name = &body[amp + 1..body.len() - 1];
                if !name.is_empty() && name.bytes().all(|b| b.is_ascii_alphanumeric()) {
                    body = &body[..amp];
                }
            }
        }
        body = body.trim_end_matches(['.', ',', ';', ':', '!', '?', '*', '_', '~']);
        if body.ends_with(')')
            && body.bytes().filter(|b| *b == b')').count()
                > body.bytes().filter(|b| *b == b'(').count()
        {
            body = &body[..body.len() - 1];
        }
        if body.len() == previous {
            return body;
        }
    }
}

fn inline(out: &mut String, source: &str, start: usize, end: usize, depth: usize, reading: bool) {
    inline_context(out, source, start, end, depth, reading, false, true)
}
fn code_spans(out: &mut String, source: &str, mut start: usize, mut end: usize, table_cell: bool) {
    let value = source[start..end].replace(['\r', '\n'], " ");
    if value.starts_with(' ') && value.ends_with(' ') && value.chars().any(|c| c != ' ') {
        start += 1;
        end -= 1;
    }
    let mut index = start;
    let mut plain = start;
    while index < end {
        let tail = &source[index..end];
        let replacement = if tail.starts_with("\r\n") {
            Some((2, " "))
        } else if tail.starts_with(['\r', '\n']) {
            Some((1, " "))
        } else if table_cell && tail.starts_with("\\|") {
            Some((2, "|"))
        } else {
            None
        };
        if let Some((length, text)) = replacement {
            if plain < index {
                text_span(out, source, plain, index, None);
            }
            text_span(out, source, index, index + length, Some(text));
            index += length;
            plain = index;
        } else {
            index += tail.chars().next().unwrap().len_utf8();
        }
    }
    if plain < end {
        text_span(out, source, plain, end, None);
    }
}
// Link context prevents nested anchors in labels.
#[allow(clippy::too_many_arguments)]
fn inline_context(
    out: &mut String,
    source: &str,
    start: usize,
    end: usize,
    depth: usize,
    reading: bool,
    table_cell: bool,
    links: bool,
) {
    if depth > 24 {
        text_span(out, source, start, end, None);
        return;
    }
    let pairs = inlines::delimiters(source, start, end);
    let mut index = start;
    while index < end {
        let tail = &source[index..end];
        if tail.starts_with("  ") && tail.trim_start_matches(' ').starts_with('\n') {
            let count = tail.len() - tail.trim_start_matches(' ').len();
            let _ = write!(
                out,
                "<br data-break=\"1\" data-start=\"{index}\" data-end=\"{}\">",
                index + count + 1
            );
            if reading {
                out.push('\n');
            }
            index += count + 1;
            continue;
        }
        if tail.starts_with("\\\n") {
            let _ = write!(
                out,
                "<br data-break=\"1\" data-start=\"{index}\" data-end=\"{}\">",
                index + 2
            );
            if reading {
                out.push('\n');
            }
            index += 2;
            continue;
        }
        if index > start && source[..index].ends_with('\n') && tail.starts_with([' ', '\t']) {
            index += tail.len() - tail.trim_start_matches([' ', '\t']).len();
            continue;
        }
        if tail.starts_with(" \n") {
            index += 1;
            continue;
        }
        if tail.chars().next().unwrap().is_whitespace() {
            let length = tail.chars().next().unwrap().len_utf8();
            text_span(out, source, index, index + length, None);
            index += length;
            continue;
        }
        if tail.starts_with('&') {
            if let Some(close) = tail.find(';').filter(|end| *end <= 34) {
                if let Some(value) = decode_entity(&tail[1..close]) {
                    text_span(out, source, index, index + close + 1, Some(&value));
                    index += close + 1;
                    continue;
                }
            }
        }
        if let Some(stripped) = tail.strip_prefix('\\') {
            if let Some(c) = stripped.chars().next().filter(char::is_ascii_punctuation) {
                text_span(
                    out,
                    source,
                    index,
                    index + 1 + c.len_utf8(),
                    Some(&c.to_string()),
                );
                index += 1 + c.len_utf8();
                continue;
            }
        }
        if tail.starts_with("<!--") {
            if let Some(close) = tail.find("-->") {
                let stop = index + close + 3;
                if !reading {
                    element(
                        out,
                        "span",
                        "comment",
                        &Span {
                            start: index,
                            end: stop,
                        },
                    );
                    text_span(out, source, index, stop, None);
                    out.push_str("</span>");
                }
                index = stop;
                continue;
            }
        }
        if let Some(name) = unknown_html_name(tail).filter(|_| inlines::html_end(tail).is_some()) {
            let stop = tail
                .find(&format!("</{name}>"))
                .map(|close| close + name.len() + 3)
                .or_else(|| tail.find('>').map(|close| close + 1))
                .unwrap_or(tail.len());
            text_span(out, source, index, index + stop, None);
            index += stop;
            continue;
        }
        if let Some((length, html)) = html_tag(tail) {
            // A formatting newline following BR does not create a second visual break.
            let length =
                length + usize::from(html == "<br>" && tail.as_bytes().get(length) == Some(&b'\n'));
            if html == "<br>" {
                let _ = write!(
                    out,
                    "<br data-break=\"1\" data-start=\"{index}\" data-end=\"{}\">",
                    index + length
                );
            } else {
                out.push_str(&html);
            }
            index += length;
            continue;
        }
        if tail.starts_with('`') {
            let count = tail.bytes().take_while(|b| *b == b'`').count();
            if let Some(close) = code_close(&tail[count..], count) {
                let stop = index + count + close + count;
                element(
                    out,
                    "code",
                    "inline_code",
                    &Span {
                        start: index,
                        end: stop,
                    },
                );
                code_spans(out, source, index + count, stop - count, table_cell);
                out.push_str("</code>");
                index = stop;
                continue;
            }
            text_span(out, source, index, index + count, None);
            index += count;
            continue;
        }
        if let Some(pair) = pairs.get(&index) {
            let (tag, kind) = if pair.strong {
                ("strong", "bold")
            } else {
                ("em", "italic")
            };
            element(
                out,
                tag,
                kind,
                &Span {
                    start: index,
                    end: pair.end,
                },
            );
            let mut nested = String::new();
            inline_context(
                &mut nested,
                source,
                pair.open_end,
                pair.close,
                depth + 1,
                reading,
                table_cell,
                links,
            );
            if pair.strong {
                nested = inlines::flatten_strong(&nested);
            }
            out.push_str(&nested);
            let _ = write!(out, "</{tag}>");
            index = pair.end;
            continue;
        }
        let mut matched = false;
        for (marker, tag, kind) in [
            ("~~", "del", "strikethrough"),
            ("==", "mark", "highlight"),
            ("~", "sub", "subscript"),
            ("^", "sup", "superscript"),
        ] {
            if marker.len() == 1
                && (tail.as_bytes().get(1) == marker.as_bytes().first()
                    || source[..index].ends_with(marker))
            {
                continue;
            }
            if marker == "==" && (tail.starts_with("===") || source[..index].ends_with('=')) {
                continue;
            }
            if let Some(body) = tail.strip_prefix(marker) {
                if body.chars().next().is_none_or(char::is_whitespace) {
                    continue;
                }
                if marker.starts_with('_')
                    && source[..index]
                        .chars()
                        .next_back()
                        .is_some_and(char::is_alphanumeric)
                {
                    continue;
                }
                if let Some(close) = if marker.len() == 1 {
                    find_script_close(body, marker)
                } else if marker == "==" {
                    find_highlight_close(body)
                } else {
                    find_emphasis_close(body, marker)
                } {
                    if close == 0
                        || body[..close].ends_with(char::is_whitespace)
                        || (marker == "==" && body[..close].contains('\n'))
                    {
                        continue;
                    }
                    let stop = index + marker.len() * 2 + close;
                    element(
                        out,
                        tag,
                        kind,
                        &Span {
                            start: index,
                            end: stop,
                        },
                    );
                    if marker.len() == 3 {
                        out.push_str("<em>");
                    }
                    inline_context(
                        out,
                        source,
                        index + marker.len(),
                        stop - marker.len(),
                        depth + 1,
                        reading,
                        table_cell,
                        links,
                    );
                    if marker.len() == 3 {
                        out.push_str("</em>");
                    }
                    let _ = write!(out, "</{tag}>");
                    index = stop;
                    matched = true;
                    break;
                }
            }
        }
        if matched {
            continue;
        }
        if let Some(rest) = tail.strip_prefix("[^") {
            if let Some(close) = rest.find(']') {
                let name = &rest[..close];
                if !name.is_empty() && !name.contains(char::is_whitespace) {
                    let stop = index + close + 3;
                    let defined = containers::document(source,parse).iter().any(|block| matches!(&block.kind, BlockKind::Footnote { name: defined, .. } if defined == name));
                    if !defined {
                        text_span(out, source, index, stop, None);
                        index = stop;
                        continue;
                    }
                    let number =
                        containers::document(source, |doc| footnote_number(doc, name)).unwrap_or(1);
                    let occurrence = source[..index].matches(&format!("[^{name}]")).count();
                    let id = if occurrence == 0 {
                        format!("ref-{name}")
                    } else {
                        format!("ref-{name}-{occurrence}")
                    };
                    let _ = write!(out, "<sup data-kind=\"footnote\" data-start=\"{index}\" data-end=\"{stop}\"><a id=\"{}\" href=\"#fn-{}\">", escape(&id), escape(name));
                    text_span(out, source, index, stop, Some(&format!("[{number}]")));
                    out.push_str("</a></sup>");
                    index = stop;
                    continue;
                }
            }
        }
        let word_end = tail
            .find(|c: char| c.is_whitespace() || ['<', '>'].contains(&c))
            .unwrap_or(tail.len());
        let word = tail[..word_end].trim_end_matches(['.', ',', ';', '!', '?']);
        if let Some((user, domain)) = word.split_once('@').filter(|_| links) {
            if !user.is_empty()
                && domain.contains('.')
                && domain
                    .as_bytes()
                    .last()
                    .is_some_and(u8::is_ascii_alphanumeric)
                && user
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"._+-".contains(&b))
                && domain
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b".-".contains(&b))
            {
                let stop = index + word.len();
                let _ = write!(out, "<a data-kind=\"link\" data-start=\"{index}\" data-end=\"{stop}\" href=\"mailto:{}\">", escape(word));
                text_span(out, source, index, stop, None);
                out.push_str("</a>");
                index = stop;
                continue;
            }
        }
        if links
            && (tail.starts_with("http://")
                || tail.starts_with("https://")
                || tail.starts_with("www."))
        {
            let length = tail
                .find(|c: char| c.is_whitespace() || ['<', '>'].contains(&c))
                .unwrap_or(tail.len());
            let body = extended_url_body(&tail[..length]);
            let url = if body.starts_with("www.") {
                format!("https://{body}")
            } else {
                body.into()
            };
            if safe_url(&url, false, false) {
                let stop = index + body.len();
                let _ = write!(out, "<a data-kind=\"link\" data-start=\"{index}\" data-end=\"{stop}\" href=\"{}\" rel=\"noopener noreferrer\">", escape(&url));
                text_span(out, source, index, stop, None);
                out.push_str("</a>");
                index = stop;
                continue;
            }
        }
        if let Some(link) =
            inlines::link_at(source, index, end, 0).filter(|link| links || link.image)
        {
            let title = link.title.as_ref().map_or(String::new(), |title| {
                format!(" title=\"{}\"", escape(title))
            });
            if link.image {
                let alt = inlines::plain_label(source, link.label_start, link.label_end);
                let _=write!(out,"<span data-kind=\"image\" data-start=\"{index}\" data-end=\"{}\"><img src=\"{}\" alt=\"{}\"{title} loading=\"lazy\"></span>",link.end,escape(&link.url),escape(&alt));
            } else {
                let download = link
                    .title
                    .as_ref()
                    .filter(|title| {
                        link.url.starts_with("data:")
                            && (title.starts_with("attachment:")
                                || title.starts_with("attachment-uri:"))
                    })
                    .map_or(String::new(), |title| {
                        format!(" download=\"{}\"", escape(&attachment_name(title)))
                    });
                let _=write!(out,"<a data-kind=\"link\" data-start=\"{index}\" data-end=\"{}\" href=\"{}\"{title}{download} rel=\"noopener noreferrer\">",link.end,escape(&link.url));
                inline_context(
                    out,
                    source,
                    link.label_start,
                    link.label_end,
                    depth + 1,
                    reading,
                    table_cell,
                    false,
                );
                out.push_str("</a>");
            }
            index = link.end;
            continue;
        }
        if links && tail.starts_with('<') {
            if let Some(close) = tail.find('>') {
                if let Some((url, label)) = inlines::autolink(&tail[1..close]) {
                    let _ = write!(
                        out,
                        "<a href=\"{}\" rel=\"noopener noreferrer\">",
                        escape(&url)
                    );
                    text_span(out, source, index + 1, index + close, Some(&label));
                    out.push_str("</a>");
                    index += close + 1;
                    continue;
                }
            }
        }
        let mut stop = index + tail.chars().next().unwrap().len_utf8();
        while stop < end
            && !source[stop..].chars().next().unwrap().is_whitespace()
            && !"\\`*_~^=[!<:&".contains(source[stop..].chars().next().unwrap())
            && !source[stop..end].starts_with("https://")
            && !source[stop..end].starts_with("http://")
            && !source[stop..end].starts_with("www.")
            && !(source[stop..end].starts_with("  ")
                && source[stop..end].trim_start_matches(' ').starts_with('\n'))
        {
            stop += source[stop..].chars().next().unwrap().len_utf8();
        }
        if tail.starts_with(':') {
            if let Some((alias, unicode)) = emoji_match(tail) {
                text_span(out, source, index, index + alias.len(), Some(unicode));
                index += alias.len();
                continue;
            }
        }
        text_span(out, source, index, stop, None);
        index = stop;
    }
}

pub const EMOJI: &[(&str, &str)] = &[
    (":smile:", "😄"),
    (":+1:", "👍"),
    (":thumbsup:", "👍"),
    (":heart:", "❤️"),
    (":warning:", "⚠️"),
    (":check:", "✅"),
    (":rocket:", "🚀"),
    (":tada:", "🎉"),
    (":fire:", "🔥"),
    (":eyes:", "👀"),
    (":tent:", "⛺"),
    (":joy:", "😂"),
];
fn emoji_match(text: &str) -> Option<(&'static str, &'static str)> {
    EMOJI
        .iter()
        .copied()
        .find(|(alias, _)| text.starts_with(alias))
}

fn decode_entity(name: &str) -> Option<String> {
    if let Ok(index) = crate::entities::NAMED.binary_search_by_key(&name, |(key, _)| *key) {
        return Some(crate::entities::NAMED[index].1.to_string());
    }
    let value = if let Some(hex) = name.strip_prefix("#x").or_else(|| name.strip_prefix("#X")) {
        if hex.is_empty() || hex.len() > 6 || !hex.bytes().all(|b| b.is_ascii_hexdigit()) {
            return None;
        }
        u32::from_str_radix(hex, 16).ok()?
    } else {
        let digits = name.strip_prefix('#')?;
        if digits.is_empty() || digits.len() > 7 || !digits.bytes().all(|b| b.is_ascii_digit()) {
            return None;
        }
        digits.parse().ok()?
    };
    Some(
        char::from_u32(value)
            .filter(|c| *c != '\0')
            .unwrap_or('\u{fffd}')
            .to_string(),
    )
}

fn find_unescaped(source: &str, marker: &str) -> Option<usize> {
    source
        .match_indices(marker)
        .find(|(index, _)| {
            source[..*index]
                .bytes()
                .rev()
                .take_while(|b| *b == b'\\')
                .count()
                % 2
                == 0
        })
        .map(|(index, _)| index)
}

fn footnote_number(source: &str, name: &str) -> Option<usize> {
    let mut names = Vec::<String>::new();
    for block in parse(source) {
        if matches!(
            block.kind,
            BlockKind::Code { .. }
                | BlockKind::FrontMatter
                | BlockKind::Comment
                | BlockKind::Raw
                | BlockKind::Footnote { .. }
        ) {
            continue;
        }
        let text = &source[block.span.start..block.span.end];
        for (index, _) in text.match_indices("[^") {
            if let Some(close) = text[index + 2..].find(']') {
                let value = &text[index + 2..index + 2 + close];
                if !names.iter().any(|name| name == value) {
                    names.push(value.into());
                }
            }
        }
    }
    names
        .iter()
        .position(|value| value == name)
        .map(|index| index + 1)
}

// Single-marker scripts never consume a double tilde strike delimiter or code span.
fn find_script_close(body: &str, marker: &str) -> Option<usize> {
    let close = find_outside_code(body, marker)?;
    if close == 0
        || body[..close].contains(['\n', '\r'])
        || body[close + 1..].starts_with(marker)
        || body[..close].ends_with(marker)
    {
        return None;
    }
    Some(close)
}

fn find_highlight_close(body: &str) -> Option<usize> {
    let mut offset = 0;
    while offset < body.len() {
        let close = offset + find_unescaped(&body[offset..], "==")?;
        let run = body[close..].bytes().take_while(|b| *b == b'=').count();
        if run == 2 {
            return Some(close);
        }
        offset = close + run;
    }
    None
}

fn find_outside_code(text: &str, marker: &str) -> Option<usize> {
    let mut index = 0;
    while index < text.len() {
        let tail = &text[index..];
        if tail.starts_with('\\') {
            index += 1;
            if index < text.len() {
                index += text[index..].chars().next().unwrap().len_utf8();
            }
            continue;
        }
        if tail.starts_with('`') {
            let count = tail.bytes().take_while(|b| *b == b'`').count();
            if let Some(close) = code_close(&tail[count..], count) {
                index += count * 2 + close;
            } else {
                index += count;
            }
            continue;
        }
        if tail.starts_with(marker) {
            return Some(index);
        }
        index += tail.chars().next().unwrap().len_utf8();
    }
    None
}
fn find_emphasis_close(body: &str, marker: &str) -> Option<usize> {
    let byte = marker.as_bytes()[0];
    let mut offset = 0;
    while offset < body.len() {
        let close = offset + find_outside_code(&body[offset..], marker)?;
        let run = body[close..].bytes().take_while(|b| *b == byte).count();
        if marker.len() == 1 && run == 2 {
            offset = close + 2;
            continue;
        }
        if marker.len() == 1 && run >= 3 {
            return Some(close + run - 1);
        }
        if marker.len() == 2 && run >= 3 {
            let singles = body[..close].bytes().filter(|b| *b == byte).count();
            if singles % 2 == 1 {
                return Some(close + 1);
            }
        }
        return Some(close);
    }
    None
}

fn closing_paren(text: &str) -> Option<usize> {
    let mut level = 0;
    let mut escaped = false;
    let mut quote = false;
    for (index, c) in text.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if c == '\\' {
            escaped = true;
            continue;
        }
        if c == '"' {
            quote = !quote;
        }
        if quote {
            continue;
        }
        if c == '(' {
            level += 1;
        }
        if c == ')' {
            if level == 0 {
                return Some(index);
            }
            level -= 1;
        }
    }
    None
}

fn attachment_name(title: &str) -> String {
    let Some(encoded) = title.strip_prefix("attachment-uri:") else {
        return title.strip_prefix("attachment:").unwrap_or(title).into();
    };
    let mut bytes = Vec::new();
    let mut index = 0;
    while index < encoded.len() {
        if encoded.as_bytes()[index] == b'%' && index + 2 < encoded.len() {
            if let Some(value) = encoded
                .get(index + 1..index + 3)
                .and_then(|digits| u8::from_str_radix(digits, 16).ok())
            {
                bytes.push(value);
                index += 3;
                continue;
            }
        }
        bytes.push(encoded.as_bytes()[index]);
        index += 1;
    }
    String::from_utf8(bytes).unwrap_or_else(|_| encoded.into())
}

/// Parses only quoted/unquoted attribute values and emits a fixed allowlist.
fn html_tag(text: &str) -> Option<(usize, String)> {
    let tail = text.strip_prefix('<')?;
    let end = inlines::html_end(text)? - 2;
    let raw = &tail[..end];
    let closing = raw.starts_with('/');
    let raw = raw.trim_start_matches('/');
    let name_end = raw
        .find(|c: char| !c.is_ascii_alphanumeric())
        .unwrap_or(raw.len());
    let name = raw[..name_end].to_ascii_lowercase();
    if ![
        "br", "mark", "sub", "sup", "ins", "a", "picture", "source", "img", "details", "summary",
    ]
    .contains(&name.as_str())
    {
        return None;
    }
    let mut html = String::new();
    if closing {
        if ["br", "img", "source"].contains(&name.as_str()) {
            return Some((end + 2, String::new()));
        }
        let _ = write!(html, "</{name}>");
        return Some((end + 2, html));
    }
    let _ = write!(html, "<{name}");
    let mut rest = raw[name_end..].trim().trim_end_matches('/').trim();
    while !rest.is_empty() {
        let key_end = rest
            .find(|c: char| c.is_whitespace() || c == '=')
            .unwrap_or(rest.len());
        if key_end == 0 {
            break;
        }
        let key = rest[..key_end].to_ascii_lowercase();
        rest = rest[key_end..].trim_start();
        let mut value = "";
        if let Some(after) = rest.strip_prefix('=') {
            rest = after.trim_start();
            if let Some(quote) = rest.chars().next().filter(|c| *c == '\'' || *c == '"') {
                rest = &rest[1..];
                let stop = rest.find(quote)?;
                value = &rest[..stop];
                rest = rest[stop + 1..].trim_start();
            } else {
                let stop = rest.find(char::is_whitespace).unwrap_or(rest.len());
                value = &rest[..stop];
                rest = rest[stop..].trim_start();
            }
        }
        let allowed = match name.as_str() {
            "a" => key == "name",
            "img" => ["src", "alt", "title", "width", "height"].contains(&key.as_str()),
            "source" => ["srcset", "media", "type"].contains(&key.as_str()),
            "details" => key == "open",
            _ => false,
        };
        let valid = match key.as_str() {
            "src" => safe_url(value, true, false),
            "srcset" => value.split(',').all(|candidate| {
                candidate
                    .split_whitespace()
                    .next()
                    .is_some_and(|url| safe_url(url, true, false))
            }),
            "width" | "height" => value.parse::<u32>().is_ok_and(|n| (1..=10000).contains(&n)),
            _ => !value.chars().any(char::is_control),
        };
        if allowed && valid {
            let _ = write!(html, " {key}=\"{}\"", escape(value));
        }
    }
    html.push('>');
    Some((end + 2, html))
}

pub fn front_matter_layout(source: &str) -> Option<String> {
    let block = parse(source).into_iter().next()?;
    if block.kind != BlockKind::FrontMatter {
        return None;
    }
    for line in source[..block.span.end].lines().skip(1) {
        if let Some(value) = line.strip_prefix("layout:") {
            let value = value.trim();
            let value = if value.len() >= 2 && value.starts_with('"') && value.ends_with('"')
                || value.len() >= 2 && value.starts_with('\'') && value.ends_with('\'')
            {
                &value[1..value.len() - 1]
            } else {
                value
            };
            if !value.is_empty()
                && value
                    .chars()
                    .all(|c| c.is_alphanumeric() || ['-', '_'].contains(&c))
            {
                return Some(value.into());
            }
        }
    }
    None
}

/// Normalize recognized constructs without touching code, front matter, comments or raw HTML.
pub fn normalize(source: &str) -> String {
    let candidate = normalize_candidate(source);
    if candidate == source || normalization::equivalent(source, &candidate) {
        candidate
    } else {
        source.into()
    }
}
fn normalize_candidate(source: &str) -> String {
    let blocks = parse(source);
    let mut out = String::new();
    let mut list_stack: Vec<(usize, usize, usize)> = Vec::new();
    for (index, block) in blocks.iter().enumerate() {
        if index > 0 {
            out.push('\n');
        }
        let raw = &source[block.span.start..block.span.end];
        match &block.kind {
            BlockKind::FrontMatter
            | BlockKind::Html
            | BlockKind::Raw
            | BlockKind::Comment
            | BlockKind::ReferenceDefinition
            | BlockKind::Code { .. } => out.push_str(raw),
            BlockKind::Heading { level, content } => {
                list_stack.clear();
                let body = &source[content.start..content.end];
                let (visible, id) = heading_suffix(body);
                if !body.contains('\n') {
                    out.push_str(&"#".repeat(*level));
                    out.push(' ');
                    out.push_str(&normalize_inline(visible));
                    if let Some(id) = id {
                        out.push_str(" {#");
                        out.push_str(id);
                        out.push('}');
                    }
                } else {
                    out.push_str(raw);
                }
            }
            BlockKind::ListItem {
                content,
                ordered,
                checked,
                ..
            } => {
                let indent = raw.bytes().take_while(|b| *b == b' ').count();
                while list_stack
                    .last()
                    .is_some_and(|(original, _, _)| *original >= indent)
                {
                    list_stack.pop();
                }
                let canonical = list_stack
                    .last()
                    .map_or(0, |(_, parent, width)| parent + (*width).max(4));
                let marker = ordered.map_or("-".into(), |number| format!("{number}."));
                list_stack.push((indent, canonical, marker.len() + 1));
                out.push_str(&" ".repeat(canonical));
                out.push_str(&marker);
                out.push(' ');
                if let Some(value) = checked {
                    out.push_str(if *value { "[x] " } else { "[ ] " });
                }
                out.push_str(&normalize_inline(&source[content.start..content.end]));
            }
            _ => {
                if !raw.trim().is_empty() {
                    list_stack.clear();
                }
                out.push_str(
                    &raw.split('\n')
                        .map(normalize_inline)
                        .collect::<Vec<_>>()
                        .join("\n"),
                );
            }
        }
    }
    out
}

fn normalize_inline(raw: &str) -> String {
    normalize_inline_depth(raw, 0)
}

fn normalize_inline_depth(raw: &str, depth: usize) -> String {
    if depth > 24 {
        return raw.into();
    }
    let mut out = String::new();
    let mut index = 0;
    let pairs = inlines::delimiters(raw, 0, raw.len());
    while index < raw.len() {
        let tail = &raw[index..];
        if let Some(stripped) = tail.strip_prefix('\\') {
            let stop = 1 + stripped.chars().next().map_or(0, char::len_utf8);
            out.push_str(&tail[..stop]);
            index += stop;
            continue;
        }
        if tail.starts_with('`') {
            let count = tail.bytes().take_while(|b| *b == b'`').count();
            if let Some(end) = code_close(&tail[count..], count) {
                let stop = count * 2 + end;
                out.push_str(&tail[..stop]);
                index += stop;
                continue;
            }
        }
        if tail.starts_with("<!--") {
            if let Some(end) = tail.find("-->") {
                out.push_str(&tail[..end + 3]);
                index += end + 3;
                continue;
            }
        }
        if let Some(name) = unknown_html_name(tail) {
            let stop = tail
                .find(&format!("</{name}>"))
                .map(|close| close + name.len() + 3)
                .or_else(|| tail.find('>').map(|close| close + 1))
                .unwrap_or(tail.len());
            out.push_str(&tail[..stop]);
            index += stop;
            continue;
        }
        if tail.starts_with('<') {
            if let Some(end) = tail.find('>') {
                let tag = &tail[..end + 1];
                out.push_str(if ["<br>", "<br/>", "<br />"].contains(&tag) {
                    "<br>"
                } else {
                    tag
                });
                index += end + 1;
                continue;
            }
        }
        let image = tail.starts_with("![");
        if image || tail.starts_with('[') {
            let label_start = if image { 2 } else { 1 };
            if let Some(close) = find_outside_code(&tail[label_start..], "](") {
                let url_start = label_start + close + 2;
                if let Some(end) = closing_paren(&tail[url_start..]) {
                    out.push_str(&tail[..label_start]);
                    out.push_str(&normalize_inline_depth(
                        &tail[label_start..label_start + close],
                        depth + 1,
                    ));
                    out.push_str(&tail[label_start + close..url_start + end + 1]);
                    index += url_start + end + 1;
                    continue;
                }
            }
        }
        if tail.starts_with("https://") || tail.starts_with("http://") {
            let end = tail.find(char::is_whitespace).unwrap_or(tail.len());
            out.push_str(&tail[..end]);
            index += end;
            continue;
        }
        if let Some(pair) = pairs.get(&index) {
            let marker = if pair.strong { "**" } else { "*" };
            out.push_str(marker);
            out.push_str(&normalize_inline_depth(
                &raw[pair.open_end..pair.close],
                depth + 1,
            ));
            out.push_str(marker);
            index = pair.end;
            continue;
        }
        if let Some((alias, unicode)) = emoji_match(tail) {
            out.push_str(unicode);
            index += alias.len();
            continue;
        }
        let c = tail.chars().next().unwrap();
        out.push(c);
        index += c.len_utf8();
    }
    if out.ends_with("  ") {
        out.truncate(out.trim_end_matches(' ').len());
        out.push_str("<br>");
    } else if out.ends_with('\\') && out.bytes().rev().take_while(|b| *b == b'\\').count() % 2 == 1
    {
        out.pop();
        out.push_str("<br>");
    }
    out
}

mod viewer;

pub fn render_viewer(source: &str) -> String {
    viewer::clean(&render(source, true), source)
}
