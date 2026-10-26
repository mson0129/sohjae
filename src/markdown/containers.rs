//! Recursive list/blockquote parsing with a byte map back to the untouched source.
use super::*;
use std::cell::RefCell;
struct Document {
    source: String,
    collecting: bool,
    references: std::collections::BTreeMap<String, (usize, String, Option<String>)>,
}
thread_local! {static DOCUMENT: RefCell<Vec<Document>> = const {RefCell::new(Vec::new())};}
struct Scope;
impl Drop for Scope {
    fn drop(&mut self) {
        DOCUMENT.with(|docs| {
            docs.borrow_mut().pop();
        });
    }
}
pub(super) fn document<T>(fallback: &str, run: impl FnOnce(&str) -> T) -> T {
    DOCUMENT.with(|docs| {
        let docs = docs.borrow();
        run(docs.last().map_or(fallback, |doc| doc.source.as_str()))
    })
}
pub(super) fn render(source: &str, reading: bool) -> String {
    DOCUMENT.with(|docs| {
        docs.borrow_mut().push(Document {
            source: source.to_owned(),
            collecting: false,
            references: Default::default(),
        })
    });
    let _scope = Scope;
    let lines = lines(source);
    let spans = protected(source);
    let html = if lines.iter().any(|line| is_container(line, &spans))
        || source.contains("\n: ")
            && parse(source)
                .iter()
                .any(|block| matches!(block.kind, BlockKind::DefinitionList { .. }))
    {
        let map = Mapped::identity(source);
        DOCUMENT.with(|docs| docs.borrow_mut().last_mut().unwrap().collecting = true);
        let _ = render_mapped(&map, reading, false, 0, 0);
        DOCUMENT.with(|docs| docs.borrow_mut().last_mut().unwrap().collecting = false);
        render_mapped(&map, reading, false, 0, 0)
    } else {
        let mut html = render_flat(source, reading);
        if reading {
            for block in parse(source)
                .into_iter()
                .filter(|b| b.span.start == b.span.end)
            {
                let at = block.span.start;
                html=html.replace(&format!("<section data-block=\"1\" data-start=\"{at}\" data-end=\"{at}\"><p><br></p></section>"),"");
            }
        }
        html
    };
    unique_heading_ids(&html)
}
thread_local! {static DEFINITION_DEPTH: std::cell::Cell<usize> = const {std::cell::Cell::new(0)};}
struct DefinitionScope;
impl Drop for DefinitionScope {
    fn drop(&mut self) {
        DEFINITION_DEPTH.with(|depth| depth.set(depth.get() - 1));
    }
}
pub(super) fn definition_html(source: &str, span: &Span, reading: bool) -> String {
    if DEFINITION_DEPTH.with(|depth| depth.get() >= 24) {
        let mut out = String::new();
        text_span(&mut out, source, span.start, span.end, None);
        return out;
    }
    DEFINITION_DEPTH.with(|depth| depth.set(depth.get() + 1));
    let _scope = DefinitionScope;
    let child = definition_child(&Mapped::identity(source), span);
    let tight = !child.text.contains("\n\n");
    render_mapped(
        &child,
        reading,
        tight,
        0,
        DEFINITION_DEPTH.with(|depth| depth.get()),
    )
}
fn definition_child(original: &Mapped, span: &Span) -> Mapped {
    let mut child = Mapped::empty(original.starts[span.start]);
    for (index, line) in lines(&original.text[span.start..span.end])
        .iter()
        .enumerate()
    {
        let start = span.start + line.start;
        if index == 0 {
            child.append(original, start, span.start + line.end);
        } else {
            child.append_deindented(original, start, span.start + line.end, 4);
        }
        if span.start + line.end < span.end {
            child.append(original, span.start + line.end, span.start + line.end + 1);
        }
    }
    child
}
fn collect_map_references(map: &Mapped, doc: &mut Document, depth: usize) {
    if depth > 24 {
        return;
    }
    for block in parse(&map.text) {
        if let BlockKind::DefinitionList { entries } = &block.kind {
            for (_, definitions) in entries {
                for span in definitions {
                    collect_map_references(&definition_child(map, span), doc, depth + 1);
                }
            }
        }
        if matches!(block.kind, BlockKind::ReferenceDefinition) {
            if let Some((label, url, title, _)) = inlines::definition(&map.text[block.span.start..])
            {
                let position = map.starts[block.span.start];
                if doc
                    .references
                    .get(&label)
                    .is_none_or(|(old, _, _)| position < *old)
                {
                    doc.references.insert(label, (position, url, title));
                }
            }
        }
    }
}
pub(super) fn reference(label: &str) -> Option<(String, Option<String>)> {
    let key = inlines::normalize_label(label)?;
    DOCUMENT.with(|docs| {
        docs.borrow()
            .last()?
            .references
            .get(&key)
            .map(|(_, url, title)| (url.clone(), title.clone()))
    })
}
fn collect_references(map: &Mapped) -> bool {
    DOCUMENT.with(|docs| {
        let mut docs = docs.borrow_mut();
        let Some(doc) = docs.last_mut() else {
            return false;
        };
        if !doc.collecting {
            return false;
        }
        collect_map_references(map, doc, 0);
        true
    })
}
pub(super) fn unique_heading_ids(html: &str) -> String {
    let mut used = std::collections::HashSet::new();
    let mut out = String::new();
    let mut i = 0;
    while i < html.len() {
        let tail = &html[i..];
        if tail.starts_with("<h")
            && tail
                .as_bytes()
                .get(2)
                .is_some_and(|b| b"123456".contains(b))
        {
            if let Some(end) = tail.find('>') {
                let tag = &tail[..end];
                if let Some(at) = tag.find(" id=\"") {
                    let start = at + 5;
                    let stop = start + tag[start..].find('"').unwrap();
                    let base = &tag[start..stop];
                    let mut id = base.to_string();
                    let mut suffix = 1;
                    while !used.insert(id.clone()) {
                        id = format!("{base}-{suffix}");
                        suffix += 1;
                    }
                    out.push_str(&tag[..start]);
                    out.push_str(&id);
                    out.push_str(&tag[stop..]);
                    out.push('>');
                    i += end + 1;
                    continue;
                }
            }
        }
        let c = tail.chars().next().unwrap();
        out.push(c);
        i += c.len_utf8();
    }
    out
}
#[derive(Clone)]
struct Mapped {
    text: String,
    starts: Vec<usize>,
    ends: Vec<usize>,
}
impl Mapped {
    fn identity(text: &str) -> Self {
        Self {
            text: text.into(),
            starts: (0..=text.len()).collect(),
            ends: (0..=text.len()).collect(),
        }
    }
    fn empty(position: usize) -> Self {
        Self {
            text: String::new(),
            starts: vec![position],
            ends: vec![position],
        }
    }
    fn append(&mut self, other: &Self, start: usize, end: usize) {
        let length = self.text.len();
        self.text.push_str(&other.text[start..end]);
        self.starts.pop();
        self.starts.extend_from_slice(&other.starts[start..=end]);
        self.ends.extend_from_slice(&other.ends[start + 1..=end]);
        if length == 0 {
            self.ends[0] = other.ends[start];
        }
    }
    fn append_deindented(&mut self, other: &Self, start: usize, end: usize, columns: usize) {
        let (bytes, remainder) = deindent(&other.text[start..end], columns);
        if remainder > 0 {
            for _ in 0..remainder {
                self.append_displayed(other, start + bytes - 1, start + bytes, " ");
            }
        }
        self.append_expanded(
            other,
            start + bytes,
            end,
            indentation(&other.text[start..start + bytes]).0,
        );
    }
    fn append_expanded(&mut self, other: &Self, mut start: usize, end: usize, mut column: usize) {
        while start < end {
            let byte = other.text.as_bytes()[start];
            if byte == b'\t' {
                let width = 4 - column % 4;
                self.append_displayed(other, start, start + 1, &" ".repeat(width));
                column += width;
            } else if byte == b' ' {
                self.append(other, start, start + 1);
                column += 1;
            } else {
                break;
            }
            start += 1;
        }
        self.append(other, start, end);
    }
    fn append_displayed(&mut self, other: &Self, start: usize, end: usize, text: &str) {
        self.starts.pop();
        for _ in text.bytes() {
            self.starts.push(other.starts[start]);
            self.ends.push(other.ends[end]);
        }
        self.starts.push(other.starts[end]);
        self.text.push_str(text);
    }
    fn range(&self, start: usize, end: usize) -> Self {
        let mut result = Self::empty(self.starts[start]);
        result.append(self, start, end);
        result
    }
    fn html(&self, html: &str) -> String {
        let mut out = String::new();
        let mut index = 0;
        let mut element_start = None;
        let mut code = false;
        while index < html.len() {
            if html[index..].starts_with("<code ") || html[index..].starts_with("<code>") {
                code = true;
            }
            if html[index..].starts_with("</code>") {
                code = false;
            }
            // Expanded tab columns and literal source characters cannot share one
            // linear text span: the editor must be able to place a caret after it.
            if let Some(rest) = html[index..].strip_prefix("<span data-text=\"1\" data-start=\"") {
                if let Some((from, rest)) = rest.split_once("\" data-end=\"") {
                    if let Some((to, rest)) = rest.split_once("\">") {
                        if let (Ok(from), Ok(to), Some(close)) = (
                            from.parse::<usize>(),
                            to.parse::<usize>(),
                            rest.find("</span>"),
                        ) {
                            if let Some(raw) = self.text.get(from..to) {
                                if escape(raw) == rest[..close] && !raw.is_empty() {
                                    let mut chunks: Vec<(usize, usize, bool)> = Vec::new();
                                    for (offset, c) in raw.char_indices() {
                                        let at = from + offset;
                                        let end = at + c.len_utf8();
                                        let linear = self.ends[end].saturating_sub(self.starts[at])
                                            == c.len_utf8()
                                            && document(&self.text, |source| {
                                                source.get(self.starts[at]..self.ends[end])
                                                    == Some(&self.text[at..end])
                                            });
                                        if let Some((begin, previous, preceding_linear)) =
                                            chunks.last_mut()
                                        {
                                            let same = self.starts[*begin] == self.starts[at]
                                                && self.ends[*previous] == self.ends[end];
                                            if same && !linear && !*preceding_linear
                                                || linear
                                                    && *preceding_linear
                                                    && self.ends[*previous] == self.starts[at]
                                            {
                                                *previous = end;
                                                continue;
                                            }
                                        }
                                        chunks.push((at, end, linear));
                                    }
                                    for (begin, end, _) in chunks {
                                        let raw = &self.text[begin..end];
                                        // Keep complete original tabs in code. Only a tab
                                        // partly consumed by a container/code prefix becomes spaces.
                                        let complete_tab = code
                                            && raw.bytes().all(|b| b == b' ')
                                            && document(&self.text, |source| {
                                                let start = self.starts[begin];
                                                if source.get(start..self.ends[end]) != Some("\t") {
                                                    return false;
                                                }
                                                let line = source[..start]
                                                    .rsplit('\n')
                                                    .next()
                                                    .unwrap_or("");
                                                let column = line.chars().fold(0, |column, c| {
                                                    column
                                                        + if c == '\t' { 4 - column % 4 } else { 1 }
                                                });
                                                raw.len() == 4 - column % 4
                                            });
                                        let displayed = if complete_tab { "\t" } else { raw };
                                        let _ = write!(out, "<span data-text=\"1\" data-start=\"{}\" data-end=\"{}\">{}</span>", self.starts[begin], self.ends[end], escape(displayed));
                                    }
                                    index = html.len() - rest.len() + close + 7;
                                    continue;
                                }
                            }
                        }
                    }
                }
            }
            if let Some((prefix, startmap)) = [
                (" data-start=\"", true),
                (" data-end=\"", false),
                (" data-task=\"", true),
            ]
            .into_iter()
            .find(|(prefix, _)| html[index..].starts_with(prefix))
            {
                out.push_str(prefix);
                index += prefix.len();
                let end = html[index..].find('"').map_or(html.len(), |n| index + n);
                if let Ok(offset) = html[index..end].parse::<usize>() {
                    let map = if startmap { &self.starts } else { &self.ends };
                    let mut value = map[offset.min(map.len() - 1)];
                    if prefix == " data-start=\"" {
                        element_start = Some((offset, value));
                    }
                    if !startmap {
                        if let Some((at, start)) = element_start {
                            if at == offset {
                                value = start;
                            }
                        }
                    }
                    out.push_str(&value.to_string());
                } else {
                    out.push_str(&html[index..end]);
                }
                index = end;
            } else {
                let c = html[index..].chars().next().unwrap();
                if c == '<' {
                    element_start = None;
                }
                out.push(c);
                index += c.len_utf8();
            }
        }
        out
    }
}
#[derive(Clone, Copy)]
struct Marker {
    indent: usize,
    content: usize,
    width: usize,
    ordered: Option<usize>,
    delimiter: u8,
    empty: bool,
}
fn indent(text: &str) -> (usize, usize) {
    let mut columns = 0;
    let mut bytes = 0;
    for c in text.chars() {
        match c {
            ' ' => columns += 1,
            '\t' => columns += 4 - columns % 4,
            _ => break,
        }
        bytes += c.len_utf8();
    }
    (columns, bytes)
}
fn marker(text: &str) -> Option<Marker> {
    let (indent, bytes) = indent(text);
    let body = &text[bytes..];
    let first = *body.as_bytes().first()?;
    let (length, ordered, delimiter) = if b"-+*".contains(&first) {
        (1, None, first)
    } else {
        let n = body.bytes().take_while(u8::is_ascii_digit).count();
        if n == 0 || n > 9 || !matches!(body.as_bytes().get(n), Some(b'.' | b')')) {
            return None;
        }
        (n + 1, Some(body[..n].parse().ok()?), body.as_bytes()[n])
    };
    if body
        .as_bytes()
        .get(length)
        .is_some_and(|b| !b" \t".contains(b))
    {
        return None;
    }
    let mut cursor = bytes + length;
    let mut spaces = 0;
    while let Some(byte) = text.as_bytes().get(cursor) {
        if *byte == b' ' {
            spaces += 1;
        } else if *byte == b'\t' {
            spaces += 4 - (indent + length + spaces) % 4;
        } else {
            break;
        }
        cursor += 1;
    }
    let empty = text[cursor..].trim().is_empty();
    let padding = if (1..=4).contains(&spaces) && !empty {
        spaces
    } else {
        1
    };
    let content = if spaces <= 4 || empty {
        cursor
    } else {
        bytes + length + 1
    };
    Some(Marker {
        indent,
        content,
        width: indent + length + padding,
        ordered,
        delimiter,
        empty,
    })
}
fn quote(text: &str) -> Option<usize> {
    let (columns, bytes) = indent(text);
    if columns > 3 || text.as_bytes().get(bytes) != Some(&b'>') {
        return None;
    }
    let mut end = bytes + 1;
    if matches!(text.as_bytes().get(end), Some(b' ' | b'\t')) {
        end += 1;
    }
    Some(end)
}
fn interrupts(text: &str) -> bool {
    let (columns, bytes) = indent(text);
    let body = &text[bytes..];
    columns <= 3
        && (quote(text).is_some()
            || atx_heading(text).is_some()
            || is_rule(text)
            || fence(body).is_some()
            || marker(text)
                .is_some_and(|m| !m.empty && (m.ordered.is_none() || m.ordered == Some(1))))
}
fn paragraph_end(text: &str) -> bool {
    let last = text.lines().last().unwrap_or("");
    if last.trim().is_empty() {
        return false;
    }
    if atx_heading(last).is_some() || is_rule(last) || fence(last.trim_start()).is_some() {
        return false;
    }
    if marker(last).is_some_and(|m| m.empty) {
        return false;
    }
    // Code blocks cannot acquire unmarked lazy continuation lines.
    !parse(text)
        .iter()
        .rfind(|b| !text[b.span.start..b.span.end].trim().is_empty())
        .is_some_and(|b| matches!(b.kind, BlockKind::Code { .. }))
}
fn reading_item_spacing(html: &str, loose: bool) -> String {
    let mut out = String::new();
    let mut cursor = 0;
    while cursor < html.len() {
        let rest = &html[cursor..];
        if !rest.starts_with("<section ") {
            out.push_str(rest);
            break;
        }
        let Some(open) = rest.find('>') else {
            out.push_str(rest);
            break;
        };
        let mut depth = 1;
        let mut at = open + 1;
        let mut close = rest.len();
        while let Some(next) = rest[at..].find('<') {
            at += next;
            if rest[at..].starts_with("<section ") {
                depth += 1;
            }
            if rest[at..].starts_with("</section>") {
                depth -= 1;
                if depth == 0 {
                    close = at + 10;
                    break;
                }
            }
            at += 1;
        }
        let content = &rest[open + 1..close.saturating_sub(10)];
        let block = loose
            || [
                "<h1",
                "<h2",
                "<h3",
                "<h4",
                "<h5",
                "<h6",
                "<hr",
                "<pre",
                "<ul",
                "<ol",
                "<blockquote",
                "<div",
                "<dl",
            ]
            .iter()
            .any(|tag| content.starts_with(tag));
        if block && !out.ends_with('\n') {
            out.push('\n');
        }
        out.push_str(&rest[..close]);
        if block {
            out.push('\n');
        }
        cursor += close;
    }
    out
}
fn has_top_level_blank(text: &str) -> bool {
    let lines = lines(text);
    let blocks = parse(text);
    for (i, line) in lines.iter().enumerate() {
        if !line.text.trim().is_empty() {
            continue;
        }
        let Some(previous) = lines[..i].iter().rfind(|l| !l.text.trim().is_empty()) else {
            continue;
        };
        let Some(next) = lines[i + 1..].iter().find(|l| !l.text.trim().is_empty()) else {
            continue;
        };
        if blocks.iter().any(|b| {
            matches!(b.kind, BlockKind::Code { .. })
                && b.span.start <= previous.start
                && b.span.end >= next.end
        }) {
            continue;
        }
        if marker(previous.text).is_some_and(|m| indentation(next.text).0 >= m.width) {
            continue;
        }
        if lines[..i]
            .iter()
            .rev()
            .take_while(|l| !l.text.trim().is_empty())
            .any(|l| {
                marker(l.text).is_some_and(|m| m.indent <= 3 && indentation(next.text).0 >= m.width)
            })
        {
            continue;
        }
        return true;
    }
    false
}
fn protected(source: &str) -> Vec<Span> {
    parse(source)
        .into_iter()
        .filter(|b| {
            matches!(
                b.kind,
                BlockKind::Code { .. }
                    | BlockKind::Raw
                    | BlockKind::FrontMatter
                    | BlockKind::Html
                    | BlockKind::Footnote { .. }
                    | BlockKind::Comment
            )
        })
        .map(|b| b.span)
        .collect()
}
fn is_container(line: &Line<'_>, spans: &[Span]) -> bool {
    !spans
        .iter()
        .any(|span| line.start >= span.start && line.start < span.end)
        && (quote(line.text).is_some()
            || marker(line.text).is_some_and(|m| m.indent <= 3) && !is_rule(line.text))
}
fn render_plain(map: &Mapped, reading: bool, tight: bool) -> String {
    if collect_references(map) {
        return String::new();
    }
    let mut html = render_flat(&map.text, reading);
    if tight || reading {
        for block in parse(&map.text)
            .into_iter()
            .filter(|block| block.span.start == block.span.end)
        {
            let at = block.span.start;
            html=html.replace(&format!("<section data-block=\"1\" data-start=\"{at}\" data-end=\"{at}\"><p><br></p></section>"),"");
        }
    }
    if tight {
        html = html.replace("<p>", "").replace("</p>", "");
    }
    map.html(&html)
}
fn section(out: &mut String, map: &Mapped, start: usize, end: usize) {
    let _ = write!(
        out,
        "<section data-block=\"1\" data-start=\"{}\" data-end=\"{}\">",
        map.starts[start], map.ends[end]
    );
}
fn render_mapped(map: &Mapped, reading: bool, tight: bool, nesting: usize, depth: usize) -> String {
    if depth > 48 {
        return render_plain(map, reading, tight);
    }
    let lines = lines(&map.text);
    let spans = protected(&map.text);
    let mut out = String::new();
    let mut index = 0;
    let mut plain = 0;
    while index < lines.len() {
        let line = &lines[index];
        let continuing = index > plain
            && !lines[index - 1].text.trim().is_empty()
            && paragraph_end(&map.text[lines[plain].start..line.start]);
        if !is_container(line, &spans)
            || marker(line.text)
                .is_some_and(|m| continuing && (m.empty || m.ordered.is_some_and(|n| n != 1)))
        {
            index += 1;
            continue;
        }
        if plain < index {
            let html = render_plain(&map.range(lines[plain].start, line.start), reading, tight);
            // The fragment ends before a container, not at the document EOF.
            // split('\n') creates a synthetic final empty line at this boundary.
            let at = map.starts[line.start];
            let sentinel = format!("<section data-block=\"1\" data-start=\"{at}\" data-end=\"{at}\"><p><br></p></section>");
            out.push_str(html.strip_suffix(&sentinel).unwrap_or(&html));
        }
        let start = line.start;
        if quote(line.text).is_some() {
            let mut child = Mapped::empty(map.starts[start]);
            let mut end = line.end;
            while index < lines.len() {
                let line = &lines[index];
                if let Some(prefix) = quote(line.text) {
                    if line.text.as_bytes().get(prefix - 1) == Some(&b'\t') {
                        let consumed = prefix - 1;
                        let extra = 4 - consumed % 4 - 1;
                        child.append_displayed(
                            map,
                            line.start + prefix - 1,
                            line.start + prefix,
                            &" ".repeat(extra),
                        );
                    }
                    child.append_expanded(
                        map,
                        line.start + prefix,
                        line.end,
                        prefix
                            + if line.text.as_bytes().get(prefix - 1) == Some(&b'\t') {
                                4 - (prefix - 1) % 4 - 1
                            } else {
                                0
                            },
                    );
                } else if !line.text.trim().is_empty()
                    && !interrupts(line.text)
                    && paragraph_end(&child.text)
                {
                    if setext_level(line.text).is_some() {
                        child.append_displayed(map, line.start, line.start, "    ");
                    }
                    child.append(map, line.start, line.end);
                } else {
                    break;
                }
                end = line.end;
                if end < map.text.len() {
                    child.append(map, end, end + 1);
                }
                index += 1;
            }
            section(&mut out, map, start, end);
            let _ = write!(
                out,
                "<blockquote data-kind=\"quote\" data-start=\"{}\" data-end=\"{}\">",
                map.starts[start], map.ends[end]
            );
            if let Some(first) = child
                .text
                .lines()
                .next()
                .and_then(|line| line.strip_prefix("[!"))
                .and_then(|line| line.strip_suffix(']'))
                .filter(|name| ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"].contains(name))
            {
                let _ = write!(
                    out,
                    "<span class=\"alert_label alert_{}\" contenteditable=\"false\">{first}</span>",
                    first.to_lowercase()
                );
                let from = child.text.find('\n').map_or(child.text.len(), |n| n + 1);
                out.push_str(&render_mapped(
                    &child.range(from, child.text.len()),
                    reading,
                    false,
                    nesting,
                    depth + 1,
                ));
            } else {
                out.push_str(&render_mapped(&child, reading, false, nesting, depth + 1));
            }
            out.push_str("</blockquote></section>");
        } else {
            let first = marker(line.text).unwrap();
            let mut items = Vec::<(usize, usize, Mapped)>::new();
            let mut loose = false;
            while index < lines.len() {
                let line = &lines[index];
                let Some(current) = marker(line.text).filter(|m| {
                    m.indent <= 3
                        && m.delimiter == first.delimiter
                        && m.ordered.is_some() == first.ordered.is_some()
                }) else {
                    break;
                };
                if is_rule(line.text) {
                    break;
                }
                let item_start = line.start;
                let mut item_end = line.end;
                let mut child = Mapped::empty(map.starts[line.start + current.content]);
                // Marker bytes are not whitespace; measure padding in its original column.
                let mut column = 0;
                for c in line.text[..current.content].chars() {
                    column += if c == '\t' { 4 - column % 4 } else { 1 };
                }
                if !current.empty && column > current.width {
                    child.append_displayed(
                        map,
                        line.start + current.content - 1,
                        line.start + current.content,
                        &" ".repeat(column - current.width),
                    );
                }
                child.append_expanded(map, line.start + current.content, line.end, column);
                if line.end < map.text.len() {
                    child.append(map, line.end, line.end + 1);
                }
                index += 1;
                let mut blanks = 0;
                let mut inner_blank = false;
                while index < lines.len() {
                    let next = &lines[index];
                    if next.text.trim().is_empty() {
                        blanks += 1;
                        child.append(map, next.start, next.end);
                        if next.end < map.text.len() {
                            child.append(map, next.end, next.end + 1);
                        }
                        index += 1;
                        continue;
                    }
                    let (width, _) = indent(next.text);
                    if width >= current.width {
                        if current.empty && blanks > 0 {
                            break;
                        }
                        child.append_deindented(map, next.start, next.end, current.width);
                        if next.end < map.text.len() {
                            child.append(map, next.end, next.end + 1);
                        }
                        inner_blank |= blanks > 0;
                        blanks = 0;
                        item_end = next.end;
                        index += 1;
                        continue;
                    }
                    if marker(next.text).is_some_and(|m| m.indent <= 3) {
                        break;
                    }
                    if blanks == 0
                        && !current.empty
                        && !interrupts(next.text)
                        && paragraph_end(&child.text)
                    {
                        child.append(map, next.start, next.end);
                        if next.end < map.text.len() {
                            child.append(map, next.end, next.end + 1);
                        }
                        item_end = next.end;
                        index += 1;
                        continue;
                    }
                    break;
                }
                let next_item = lines
                    .get(index)
                    .and_then(|line| marker(line.text))
                    .is_some_and(|m| {
                        m.indent <= 3
                            && m.delimiter == first.delimiter
                            && m.ordered.is_some() == first.ordered.is_some()
                    });
                loose |=
                    (inner_blank && has_top_level_blank(&child.text)) || (blanks > 0 && next_item);
                items.push((item_start, item_end, child));
                if !next_item {
                    break;
                }
            }
            let end = items.last().map_or(start, |item| item.1);
            section(&mut out, map, start, end);
            if let Some(number) = first.ordered {
                if number != 1 {
                    let _ = write!(out, "<ol start=\"{number}\">");
                } else {
                    out.push_str("<ol>");
                }
            } else {
                out.push_str("<ul>");
            }
            for (begin, end, mut child) in items {
                let _=write!(out,"<li class=\"list_item\" data-depth=\"{nesting}\" data-kind=\"list\" data-start=\"{}\" data-end=\"{}\">",map.starts[begin],map.ends[end]);
                let task = ["[ ]", "[x]", "[X]"]
                    .iter()
                    .any(|marker| child.text.starts_with(marker))
                    && matches!(child.text.as_bytes().get(3), None | Some(b' ' | b'\n'));
                if task {
                    let checked = child.text.as_bytes()[1] != b' ';
                    let _=write!(out,"<input type=\"checkbox\" aria-label=\"작업 완료\" data-task=\"{}\" contenteditable=\"false\" {} {}>",map.starts[begin],if checked{"checked"}else{""},if reading{"disabled"}else{""});
                    out.push(' ');
                    let prefix = if child.text.as_bytes().get(3) == Some(&b' ') {
                        4
                    } else {
                        3
                    };
                    child = child.range(prefix, child.text.len());
                }
                let html = render_mapped(&child, reading, !loose, nesting + 1, depth + 1);
                if reading {
                    out.push_str(&reading_item_spacing(&html, loose));
                } else {
                    out.push_str(&html);
                }
                if child.text.trim().is_empty() && !reading {
                    out.push_str("<br>");
                }
                out.push_str("</li>");
            }
            out.push_str(if first.ordered.is_some() {
                "</ol></section>"
            } else {
                "</ul></section>"
            });
        }
        plain = index;
    }
    if plain < lines.len() {
        let start = lines[plain].start;
        if start < map.text.len() || out.is_empty() {
            out.push_str(&render_plain(
                &map.range(start, map.text.len()),
                reading,
                tight,
            ));
        }
    }
    out
}
