//! Delimiter and bracket matching shared by reading and editing render paths.
use super::*;
use std::collections::BTreeMap;

#[derive(Clone, Debug)]
pub(super) struct Pair {
    pub open_end: usize,
    pub close: usize,
    pub end: usize,
    pub strong: bool,
}
struct Delimiter {
    start: usize,
    length: usize,
    remaining: usize,
    used_close: usize,
    marker: u8,
    open: bool,
    close: bool,
    scope: Option<(usize, usize)>,
}
fn punctuation(c: char) -> bool {
    !c.is_alphanumeric() && !c.is_whitespace()
}
pub(super) fn delimiters(source: &str, start: usize, end: usize) -> BTreeMap<usize, Pair> {
    let mut links = Vec::new();
    let mut cursor = start;
    while cursor < end {
        if let Some(link) = link_at(source, cursor, end, 0) {
            links.push(link.clone());
            cursor = link.end;
        } else {
            cursor += source[cursor..end].chars().next().unwrap().len_utf8();
        }
    }
    let mut runs = Vec::<Delimiter>::new();
    let mut i = start;
    while i < end {
        let tail = &source[i..end];
        if let Some(link) = links.iter().find(|link| i == link.label_end) {
            i = link.end;
            continue;
        }
        if tail.starts_with('<') {
            if let Some(length) = html_end(tail) {
                i += length;
                continue;
            }
        }
        if tail.starts_with('\\') {
            i += 1;
            if i < end {
                i += source[i..end].chars().next().unwrap().len_utf8();
            }
            continue;
        }
        if tail.starts_with('`') {
            let count = tail.bytes().take_while(|b| *b == b'`').count();
            if let Some(close) = code_close(&tail[count..], count) {
                i += count * 2 + close;
                continue;
            }
            i += count;
            continue;
        }
        let marker = tail.as_bytes()[0];
        if marker != b'*' && marker != b'_' {
            i += tail.chars().next().unwrap().len_utf8();
            continue;
        }
        let length = tail.bytes().take_while(|b| *b == marker).count();
        let before = source[start..i].chars().next_back();
        let after = source[i + length..end].chars().next();
        let bw = before.is_none_or(char::is_whitespace);
        let aw = after.is_none_or(char::is_whitespace);
        let bp = before.is_some_and(punctuation);
        let ap = after.is_some_and(punctuation);
        let left = !aw && (!ap || bw || bp);
        let right = !bw && (!bp || aw || ap);
        runs.push(Delimiter {
            start: i,
            length,
            remaining: length,
            used_close: 0,
            marker,
            open: left && (marker == b'*' || !right || bp),
            close: right && (marker == b'*' || !left || ap),
            scope: links
                .iter()
                .find(|link| i >= link.label_start && i < link.label_end)
                .map(|link| (link.label_start, link.label_end)),
        });
        i += length;
    }
    let mut pairs = BTreeMap::new();
    for close in 0..runs.len() {
        if !runs[close].close {
            continue;
        }
        while runs[close].remaining > 0 {
            let opener = (0..close).rev().find(|open| {
                let a = &runs[*open];
                let b = &runs[close];
                a.open
                    && a.remaining > 0
                    && a.marker == b.marker
                    && a.scope == b.scope
                    && !((a.close || b.open)
                        && (a.length + b.length).is_multiple_of(3)
                        && (!a.length.is_multiple_of(3) || !b.length.is_multiple_of(3)))
            });
            let Some(open) = opener else {
                break;
            };
            let used = if runs[open].remaining >= 2 && runs[close].remaining >= 2 {
                2
            } else {
                1
            };
            // The opener is consumed from its right edge, the closer from its left.
            let left = runs[open].start + runs[open].remaining + runs[open].used_close - used;
            let right = runs[close].start + runs[close].used_close;
            pairs.insert(
                left,
                Pair {
                    open_end: left + used,
                    close: right,
                    end: right + used,
                    strong: used == 2,
                },
            );
            runs[open].remaining -= used;
            runs[close].remaining -= used;
            runs[close].used_close += used;
            // Delimiters inside an established pair cannot match outside it.
            for run in &mut runs[open + 1..close] {
                run.open = false;
                run.close = false;
            }
        }
    }
    pairs
}

#[derive(Clone, Debug)]
pub(super) struct Link {
    pub image: bool,
    pub label_start: usize,
    pub label_end: usize,
    pub end: usize,
    pub url: String,
    pub title: Option<String>,
}
fn unescape(text: &str) -> String {
    let mut out = String::new();
    let mut i = 0;
    while i < text.len() {
        let tail = &text[i..];
        if let Some(rest) = tail.strip_prefix('\\') {
            if let Some(c) = rest.chars().next().filter(char::is_ascii_punctuation) {
                out.push(c);
                i += 1 + c.len_utf8();
                continue;
            }
        }
        if tail.starts_with('&') {
            if let Some(end) = tail.find(';').filter(|end| *end <= 34) {
                if let Some(value) = decode_entity(&tail[1..end]) {
                    out.push_str(&value);
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
fn url_encode(text: &str) -> String {
    let mut out = String::new();
    for byte in text.bytes() {
        if byte <= 0x20 || byte >= 0x7f || b"\"<>`\\[]".contains(&byte) {
            let _ = write!(out, "%{byte:02X}");
        } else {
            out.push(byte as char);
        }
    }
    out
}
fn whitespace(text: &str, mut i: usize) -> Option<usize> {
    let start = i;
    while i < text.len() && text.as_bytes()[i].is_ascii_whitespace() {
        i += 1;
    }
    if text[start..i].split('\n').count() > 2 {
        None
    } else {
        Some(i)
    }
}
fn destination(text: &str, start: usize) -> Option<(String, usize)> {
    let mut i = start;
    if text[i..].starts_with('<') {
        i += 1;
        let begin = i;
        while i < text.len() {
            let c = text[i..].chars().next()?;
            if c == '>' {
                return Some((unescape(&text[begin..i]), i + 1));
            }
            if c == '\n' || c == '<' {
                return None;
            }
            if c == '\\' && i + 1 < text.len() {
                i += 1;
                i += text[i..].chars().next()?.len_utf8();
            } else {
                i += c.len_utf8();
            }
        }
        return None;
    }
    let begin = i;
    let mut depth = 0;
    while i < text.len() {
        let c = text[i..].chars().next()?;
        if c.is_ascii_whitespace() || c.is_ascii_control() {
            break;
        }
        if c == '(' {
            depth += 1;
            if depth > 32 {
                return None;
            }
        }
        if c == ')' {
            if depth == 0 {
                break;
            }
            depth -= 1;
        }
        if c == '\\' && i + 1 < text.len() {
            i += 1;
            i += text[i..].chars().next()?.len_utf8();
        } else {
            i += c.len_utf8();
        }
    }
    if depth != 0 {
        return None;
    }
    Some((unescape(&text[begin..i]), i))
}
fn title(text: &str, start: usize) -> Option<(String, usize)> {
    let first = *text.as_bytes().get(start)?;
    let close = match first {
        b'"' => b'"',
        b'\'' => b'\'',
        b'(' => b')',
        _ => return None,
    };
    let mut i = start + 1;
    while i < text.len() {
        let c = text.as_bytes()[i];
        if c == close {
            let value = &text[start + 1..i];
            if value.contains("\n\n") {
                return None;
            }
            return Some((unescape(value), i + 1));
        }
        if first == b'(' && c == b'(' {
            return None;
        }
        if c == b'\\' && i + 1 < text.len() {
            i += 1;
        }
        i += text[i..].chars().next()?.len_utf8();
    }
    None
}
pub(super) fn html_end(text: &str) -> Option<usize> {
    if text.starts_with('<') {
        if let Some(close) = text.find('>') {
            if autolink(&text[1..close]).is_some() {
                return Some(close + 1);
            }
        }
    }
    if text.starts_with("<!--") {
        return text.find("-->").map(|n| n + 3);
    }
    let bytes = text.as_bytes();
    if bytes.first() != Some(&b'<') {
        return None;
    }
    let mut i = 1;
    let closing = bytes.get(i) == Some(&b'/');
    if closing {
        i += 1;
    }
    if !bytes.get(i)?.is_ascii_alphabetic() {
        return None;
    }
    i += 1;
    while bytes
        .get(i)
        .is_some_and(|b| b.is_ascii_alphanumeric() || *b == b'-')
    {
        i += 1;
    }
    loop {
        let before = i;
        while bytes.get(i).is_some_and(u8::is_ascii_whitespace) {
            i += 1;
        }
        if bytes.get(i) == Some(&b'>') {
            return Some(i + 1);
        }
        if !closing && bytes.get(i..i + 2) == Some(b"/>") {
            return Some(i + 2);
        }
        if closing || before == i {
            return None;
        }
        if !bytes
            .get(i)
            .is_some_and(|b| b.is_ascii_alphabetic() || b"_:".contains(b))
        {
            return None;
        }
        i += 1;
        while bytes
            .get(i)
            .is_some_and(|b| b.is_ascii_alphanumeric() || b"_.:-".contains(b))
        {
            i += 1;
        }
        let after_name = i;
        while bytes.get(i).is_some_and(u8::is_ascii_whitespace) {
            i += 1;
        }
        if bytes.get(i) != Some(&b'=') {
            i = after_name;
            continue;
        }
        i += 1;
        while bytes.get(i).is_some_and(u8::is_ascii_whitespace) {
            i += 1;
        }
        let quote = *bytes.get(i)?;
        if quote == b'\'' || quote == b'"' {
            i += 1;
            while *bytes.get(i)? != quote {
                i += 1;
            }
            i += 1;
        } else {
            let start = i;
            while bytes
                .get(i)
                .is_some_and(|b| !b.is_ascii_whitespace() && !b"\"'=<>`".contains(b))
            {
                i += 1;
            }
            if i == start {
                return None;
            }
        }
    }
}
pub(super) fn normalize_label(text: &str) -> Option<String> {
    if text.chars().count() > 999 || text.contains("\n\n") {
        return None;
    }
    let key = text
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
        .replace('ß', "ss")
        .replace('ς', "σ");
    if key.is_empty() {
        None
    } else {
        Some(key)
    }
}
pub(super) fn definition(text: &str) -> Option<(String, String, Option<String>, usize)> {
    let indent = text.bytes().take_while(|b| *b == b' ').count();
    if indent > 3 {
        return None;
    }
    let tail = &text[indent..];
    if !tail.starts_with('[') || tail.starts_with("[^") {
        return None;
    }
    let mut i = 1;
    while i < tail.len() {
        if tail.as_bytes()[i] == b'\\' && i + 1 < tail.len() {
            i += 2;
            continue;
        }
        if tail.as_bytes()[i] == b'[' {
            return None;
        }
        if tail.as_bytes()[i] == b']' {
            break;
        }
        i += tail[i..].chars().next()?.len_utf8();
    }
    if tail.as_bytes().get(i + 1) != Some(&b':') {
        return None;
    }
    let label = normalize_label(&tail[1..i])?;
    let start = whitespace(tail, i + 2)?;
    let (url, end) = destination(tail, start)?;
    if url.is_empty() && !tail[start..].starts_with("<>") {
        return None;
    }
    let line_end = tail[end..].find('\n').map_or(tail.len(), |n| end + n);
    let next = whitespace(tail, end).unwrap_or(end);
    let parsed = if next > end { title(tail, next) } else { None };
    let (title, end) = if let Some((value, stop)) = parsed {
        let rest = tail[stop..].split('\n').next().unwrap_or("");
        if !rest.trim().is_empty() {
            if next >= line_end {
                return Some((label, url, None, indent + line_end));
            }
            return None;
        }
        (Some(value), stop + rest.len())
    } else {
        if !tail[end..line_end].trim().is_empty() {
            return None;
        }
        (None, line_end)
    };
    Some((label, url, title, indent + end))
}
fn reference_local(source: &str, label: &str) -> Option<(String, Option<String>)> {
    let key = normalize_label(label)?;
    for block in parse(source) {
        if matches!(block.kind, BlockKind::ReferenceDefinition) {
            if let Some((name, url, title, _)) = definition(&source[block.span.start..]) {
                if name == key {
                    return Some((url, title));
                }
            }
        }
    }
    None
}
pub(super) fn reference(source: &str, label: &str) -> Option<(String, Option<String>)> {
    super::containers::reference(label)
        .or_else(|| super::containers::document(source, |doc| reference_local(doc, label)))
        .or_else(|| reference_local(source, label))
}
pub(super) fn link_at(source: &str, start: usize, end: usize, depth: usize) -> Option<Link> {
    if depth > 24 {
        return None;
    }
    let tail = &source[start..end];
    let image = tail.starts_with("![");
    let label_start = start + if image { 2 } else { 1 };
    if !image && !tail.starts_with('[') {
        return None;
    }
    let mut i = label_start;
    let mut brackets = 0;
    while i < end {
        let rest = &source[i..end];
        if rest.starts_with('\\') {
            i += 1;
            if i < end {
                i += source[i..end].chars().next()?.len_utf8();
            }
            continue;
        }
        if rest.starts_with('`') {
            let n = rest.bytes().take_while(|b| *b == b'`').count();
            if let Some(close) = code_close(&rest[n..], n) {
                i += n * 2 + close;
                continue;
            }
            i += n;
            continue;
        }
        if rest.starts_with('<') {
            if let Some(length) = html_end(rest) {
                i += length;
                continue;
            }
        }
        if rest.starts_with(']') {
            if brackets == 0 {
                break;
            }
            brackets -= 1;
        }
        if rest.starts_with('[') {
            brackets += 1;
        }
        i += rest.chars().next()?.len_utf8();
    }
    if i >= end {
        return None;
    }
    let label_end = i;
    let after = i + 1;
    let mut stop = after;
    let parsed = if source[after..end].starts_with('(') {
        (|| {
            let text = &source[..end];
            let first = whitespace(text, after + 1)?;
            let (url, last) = destination(text, first)?;
            let next = whitespace(text, last)?;
            let (title, last) = if next > last && text.as_bytes().get(next) != Some(&b')') {
                let (value, last) = title(text, next)?;
                (Some(value), whitespace(text, last)?)
            } else {
                (None, next)
            };
            if text.as_bytes().get(last) != Some(&b')') {
                return None;
            }
            stop = last + 1;
            Some((url, title))
        })()
    } else {
        None
    };
    let (url, title) = if let Some(parsed) = parsed {
        parsed
    } else {
        let mut label = &source[label_start..label_end];
        if source[after..end].starts_with('[') {
            let close = find_unescaped(&source[after + 1..end], "]")?;
            let explicit = &source[after + 1..after + 1 + close];
            if !explicit.is_empty() {
                label = explicit;
            }
            stop = after + close + 2;
        }
        reference(source, label)?
    };
    if !image {
        let mut j = label_start;
        while j < label_end {
            let rest = &source[j..label_end];
            if rest.starts_with('\\') {
                j += 1;
                if j < label_end {
                    j += source[j..label_end].chars().next()?.len_utf8();
                }
                continue;
            }
            if rest.starts_with('`') {
                let n = rest.bytes().take_while(|b| *b == b'`').count();
                if let Some(close) = code_close(&rest[n..], n) {
                    j += n * 2 + close;
                    continue;
                }
            }
            if rest.starts_with('[')
                && !source[..j].ends_with('!')
                && link_at(source, j, label_end, depth + 1).is_some()
            {
                return None;
            }
            j += rest.chars().next()?.len_utf8();
        }
    }
    let attachment = !image
        && url.to_ascii_lowercase().starts_with("data:")
        && title
            .as_ref()
            .is_some_and(|t| t.starts_with("attachment:") || t.starts_with("attachment-uri:"));
    if !safe_url(&url, image, attachment) {
        return None;
    }
    Some(Link {
        image,
        label_start,
        label_end,
        end: stop,
        url: url_encode(&url),
        title,
    })
}
pub(super) fn plain_label(source: &str, start: usize, end: usize) -> String {
    plain_label_inner(source, start, end, 0)
}
fn plain_label_inner(source: &str, start: usize, end: usize, depth: usize) -> String {
    if depth > 48 {
        return unescape(&source[start..end]);
    }
    let pairs = delimiters(source, start, end);
    let mut out = String::new();
    let mut i = start;
    while i < end {
        if let Some(pair) = pairs.get(&i) {
            out.push_str(&plain_label_inner(
                source,
                pair.open_end,
                pair.close,
                depth + 1,
            ));
            i = pair.end;
            continue;
        }
        if let Some(link) = link_at(source, i, end, 0) {
            out.push_str(&plain_label_inner(
                source,
                link.label_start,
                link.label_end,
                depth + 1,
            ));
            i = link.end;
            continue;
        }
        let tail = &source[i..end];
        if tail.starts_with('`') {
            let n = tail.bytes().take_while(|b| *b == b'`').count();
            if let Some(close) = code_close(&tail[n..], n) {
                let value = tail[n..n + close].replace('\n', " ");
                let value = if value.starts_with(' ')
                    && value.ends_with(' ')
                    && value.chars().any(|c| c != ' ')
                {
                    &value[1..value.len() - 1]
                } else {
                    &value
                };
                out.push_str(value);
                i += n * 2 + close;
                continue;
            }
        }
        if tail.starts_with('<') {
            if let Some(close) = tail.find('>') {
                i += close + 1;
                continue;
            }
        }
        if tail.starts_with('\\') || tail.starts_with('&') {
            let c = tail.chars().next().unwrap();
            let stop = if c == '\\' {
                1 + tail[1..].chars().next().map_or(0, char::len_utf8)
            } else {
                tail.find(';').map_or(c.len_utf8(), |n| n + 1)
            };
            out.push_str(&unescape(&tail[..stop]));
            i += stop;
            continue;
        }
        let c = tail.chars().next().unwrap();
        out.push(if c == '\n' { ' ' } else { c });
        i += c.len_utf8();
    }
    out
}

pub(super) fn flatten_strong(html: &str) -> String {
    let mut out = String::new();
    let mut i = 0;
    let mut emphasis: usize = 0;
    let mut stack = Vec::new();
    while i < html.len() {
        let tail = &html[i..];
        if tail.starts_with("<em ") {
            emphasis += 1;
        }
        if tail.starts_with("</em>") {
            emphasis = emphasis.saturating_sub(1);
        }
        if tail.starts_with("<strong ") {
            let flatten = emphasis == 0;
            stack.push(flatten);
            out.push_str(if flatten { "<span " } else { "<strong " });
            i += 8;
            continue;
        }
        if tail.starts_with("</strong>") {
            out.push_str(if stack.pop().unwrap_or(false) {
                "</span>"
            } else {
                "</strong>"
            });
            i += 9;
            continue;
        }
        let c = tail.chars().next().unwrap();
        out.push(c);
        i += c.len_utf8();
    }
    out
}
pub(super) fn autolink(text: &str) -> Option<(String, String)> {
    if text
        .chars()
        .any(|c| c.is_whitespace() || c.is_control() || c == '<' || c == '>')
    {
        return None;
    }
    if let Some((scheme, _)) = text.split_once(':') {
        if (2..=32).contains(&scheme.len())
            && scheme.as_bytes()[0].is_ascii_alphabetic()
            && scheme
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"+.-".contains(&b))
            && safe_url(text, false, false)
        {
            return Some((url_encode(&unescape(text)), text.into()));
        }
    }
    let (user, domain) = text.split_once('@')?;
    if user.is_empty()
        || !user
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b".!#$%&'*+/=?^_`{|}~-".contains(&b))
        || domain.is_empty()
        || !domain.split('.').all(|part| {
            !part.is_empty()
                && part.len() <= 63
                && part.as_bytes()[0].is_ascii_alphanumeric()
                && part.as_bytes()[part.len() - 1].is_ascii_alphanumeric()
                && part.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
        })
    {
        return None;
    }
    Some((format!("mailto:{text}"), text.into()))
}
