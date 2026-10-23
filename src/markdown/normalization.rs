//! Rendering fingerprint for rejecting normalization that would alter document meaning.
use super::*;
pub(super) fn equivalent(before: &str, after: &str) -> bool {
    fingerprint(&render(before, true)) == fingerprint(&render(after, true))
}
fn fingerprint(html: &str) -> String {
    let mut out = String::new();
    let mut text = String::new();
    let mut stack: Vec<String> = Vec::new();
    let mut cursor = 0;
    let mut after_break = false;
    while cursor < html.len() {
        if html.as_bytes()[cursor] != b'<' {
            let c = html[cursor..].chars().next().unwrap();
            text.push(c);
            cursor += c.len_utf8();
            continue;
        }
        let Some(end) = html[cursor..].find('>') else {
            text.push_str(&html[cursor..]);
            break;
        };
        let tag = &html[cursor + 1..cursor + end];
        cursor += end + 1;
        let closing = tag.starts_with('/');
        let body = tag.trim_start_matches('/');
        let name_end = body
            .find(|c: char| !c.is_ascii_alphanumeric())
            .unwrap_or(body.len());
        let name = &body[..name_end];
        if name == "span" || name == "section" {
            continue;
        }
        if after_break && text.starts_with('\n') {
            text.remove(0);
        }
        let container = stack.last().map(String::as_str).unwrap_or("root");
        if !text.trim().is_empty()
            || !["root", "ul", "ol", "blockquote", "table", "tr"].contains(&container)
        {
            out.push_str(&text);
        }
        text.clear();
        out.push('<');
        if closing {
            out.push('/');
        }
        out.push_str(name);
        let mut attrs = &body[name_end..];
        while !attrs.trim_start().is_empty() {
            attrs = attrs.trim_start();
            let end = attrs
                .find(|c: char| c.is_ascii_whitespace() || c == '=')
                .unwrap_or(attrs.len());
            if end == 0 {
                break;
            }
            let key = &attrs[..end];
            attrs = &attrs[end..];
            let mut value = "";
            if let Some(rest) = attrs.strip_prefix('=') {
                if let Some(rest) = rest.strip_prefix('"') {
                    let Some(end) = rest.find('"') else {
                        break;
                    };
                    value = &rest[..end];
                    attrs = &rest[end + 1..];
                } else {
                    break;
                }
            }
            if !(key.starts_with("data-") && key != "data-language"
                || key.starts_with("aria-")
                || ["class", "contenteditable", "loading", "rel"].contains(&key))
            {
                out.push(' ');
                out.push_str(key);
                out.push('=');
                out.push_str(value);
            }
            if key == "class" && value.starts_with("align_") {
                out.push(' ');
                out.push_str(value);
            }
        }
        out.push('>');
        if closing {
            if let Some(at) = stack.iter().rposition(|tag| tag == name) {
                stack.truncate(at);
            }
        } else if !["br", "hr", "img", "input", "source"].contains(&name) {
            stack.push(name.into());
        }
        after_break = name == "br";
    }
    if after_break && text.starts_with('\n') {
        text.remove(0);
    }
    if !text.trim().is_empty() || !stack.is_empty() {
        out.push_str(&text);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn normalization_is_idempotent_and_semantic_for_all_official_examples() {
        let fixture = include_str!("../../tests/fixtures/gfm-spec.txt");
        let mut source = None::<String>;
        let mut expected = false;
        let mut count = 0;
        for line in fixture.split_inclusive('\n') {
            if line.starts_with("```````````````````````````````` example") {
                source = Some(String::new());
                expected = false;
            } else if source.is_some() && !expected && line.trim_end() == "." {
                let text = source.as_ref().unwrap().replace('→', "\t");
                let normalized = normalize(&text);
                assert!(equivalent(&text, &normalized), "example {}", count + 1);
                assert_eq!(normalize(&normalized), normalized, "example {}", count + 1);
                expected = true;
                count += 1;
            } else if !expected {
                if let Some(source) = &mut source {
                    source.push_str(line);
                }
            }
        }
        assert_eq!(count, 672);
    }
}
