//! Remove editor instrumentation from trusted parser output, preserving semantic markup.
pub(super) fn clean(html: &str, source: &str) -> String {
    let mut out = String::new();
    let mut stack: Vec<(String, bool)> = Vec::new();
    let mut cursor = 0;
    while cursor < html.len() {
        if html.as_bytes()[cursor] != b'<' {
            let end = html[cursor..].find('<').map_or(html.len(), |n| cursor + n);
            out.push_str(&html[cursor..end]);
            cursor = end;
            continue;
        }
        let mut end = cursor + 1;
        let mut quote = None;
        while end < html.len() {
            let byte = html.as_bytes()[end];
            if let Some(q) = quote {
                if byte == q {
                    quote = None;
                }
            } else if byte == b'"' || byte == b'\'' {
                quote = Some(byte);
            } else if byte == b'>' {
                break;
            }
            end += 1;
        }
        if end == html.len() {
            out.push_str(&html[cursor..]);
            break;
        }
        let tag = &html[cursor + 1..end];
        if let Some(name) = tag.strip_prefix('/') {
            if let Some(at) = stack.iter().rposition(|(open, _)| open == name) {
                let (_, omit) = stack.remove(at);
                if !omit {
                    out.push_str(&html[cursor..=end]);
                }
            } else {
                out.push_str(&html[cursor..=end]);
            }
        } else {
            let name_end = tag.find([' ', '/', '\n']).unwrap_or(tag.len());
            let name = &tag[..name_end];
            let omit = name == "section" && tag.contains(" data-block=\"1\"")
                || name == "div" && tag.contains(" class=\"table_scroll\"")
                || name == "span"
                    && (tag.contains(" data-text=\"1\"") || tag.contains(" data-kind=\"image\""));
            if !omit {
                out.push('<');
                out.push_str(name);
                let mut attrs = &tag[name_end..];
                while !attrs.is_empty() {
                    let trimmed = attrs.trim_start();
                    if trimmed.is_empty() {
                        break;
                    }
                    if trimmed == "/" {
                        out.push('/');
                        break;
                    }
                    let stop = trimmed.find(['=', ' ']).unwrap_or(trimmed.len());
                    let key = &trimmed[..stop];
                    let mut length = stop;
                    let mut value = "";
                    if trimmed.as_bytes().get(stop) == Some(&b'=') {
                        let rest = &trimmed[stop + 1..];
                        if rest.starts_with(['"', '\'']) {
                            let q = rest.as_bytes()[0] as char;
                            let close = rest[1..].find(q).map_or(rest.len(), |n| n + 1);
                            value = &rest[1..close];
                            length = stop + 1 + (close + 1).min(rest.len());
                        } else {
                            length = trimmed.find(' ').unwrap_or(trimmed.len());
                        }
                    }
                    let auto_heading_id = key == "id"
                        && matches!(name, "h1" | "h2" | "h3" | "h4" | "h5" | "h6")
                        && !source.contains(&format!("{{#{value}}}"))
                        && !html.contains(&format!("href=\"#{value}\""));
                    if (!key.starts_with("data-") || key == "data-language")
                        && key != "contenteditable"
                        && !auto_heading_id
                    {
                        out.push(' ');
                        out.push_str(&trimmed[..length]);
                    }
                    attrs = &trimmed[length..];
                }
                out.push('>');
            }
            if !matches!(
                name,
                "br" | "hr"
                    | "img"
                    | "input"
                    | "source"
                    | "wbr"
                    | "area"
                    | "base"
                    | "col"
                    | "embed"
                    | "link"
                    | "meta"
                    | "param"
                    | "track"
            ) && !tag.ends_with('/')
            {
                stack.push((name.to_owned(), omit));
            }
        }
        cursor = end + 1;
    }
    separate_blocks(&out)
}

// Keep block boundaries readable without changing inline runs or preformatted text.
fn separate_blocks(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut cursor = 0;
    let mut blocks: Vec<(String, bool)> = Vec::new();
    let mut pre = false;
    while cursor < html.len() {
        if html.as_bytes()[cursor] != b'<' {
            let end = html[cursor..].find('<').map_or(html.len(), |n| cursor + n);
            let text = &html[cursor..end];
            out.push_str(text);
            cursor = end;
            continue;
        }
        let mut end = cursor + 1;
        let mut quote = None;
        while end < html.len() {
            let byte = html.as_bytes()[end];
            if let Some(q) = quote {
                if byte == q {
                    quote = None;
                }
            } else if byte == b'"' || byte == b'\'' {
                quote = Some(byte);
            } else if byte == b'>' {
                break;
            }
            end += 1;
        }
        if end == html.len() {
            out.push_str(&html[cursor..]);
            break;
        }
        let tag = &html[cursor + 1..end];
        let name = tag
            .trim_start_matches('/')
            .split([' ', '/', '\n'])
            .next()
            .unwrap_or("");
        let block = matches!(
            name,
            "p" | "h1"
                | "h2"
                | "h3"
                | "h4"
                | "h5"
                | "h6"
                | "table"
                | "thead"
                | "tbody"
                | "tfoot"
                | "tr"
                | "th"
                | "td"
                | "ul"
                | "ol"
                | "li"
                | "blockquote"
                | "pre"
                | "hr"
                | "div"
                | "dl"
                | "dt"
                | "dd"
                | "details"
                | "summary"
        );
        let closing = tag.starts_with('/');
        if block && (!pre || name == "pre" && closing) {
            let child_blocks = if closing {
                blocks.pop().is_some_and(|(_, children)| children)
            } else {
                if let Some((_, children)) = blocks.last_mut() {
                    *children = true;
                }
                false
            };
            if !closing || child_blocks {
                while out.ends_with([' ', '\t', '\n', '\r']) {
                    out.pop();
                }
                if !out.is_empty() {
                    out.push('\n');
                }
                out.push_str(&"    ".repeat(blocks.len()));
            }
            if !closing && name != "hr" && !tag.ends_with('/') {
                blocks.push((name.to_owned(), false));
            }
        }
        out.push_str(&html[cursor..=end]);
        if name == "pre" {
            pre = !closing;
        }
        cursor = end + 1;
    }
    out
}
