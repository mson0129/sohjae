//! Conservative paragraph cache. Context-dependent Markdown always uses the full parser.
use super::*;
use std::collections::HashMap;

#[derive(Clone, Copy, Debug, Default)]
pub struct RenderStats {
    pub parsed: usize,
    pub reused: usize,
    pub fallback: bool,
}
#[derive(Default)]
pub struct RenderCache {
    fragments: HashMap<String, String>,
    pub stats: RenderStats,
}
impl RenderCache {
    pub fn clear(&mut self) {
        self.fragments.clear();
    }
    pub fn render(&mut self, source: &str) -> String {
        self.stats = RenderStats::default();
        // References, HTML and footnotes can change meaning outside the edited block.
        if source.contains(['[', '<']) || source.len() > 8 * 1024 * 1024 {
            return self.full(source);
        }
        let lines = lines(source);
        let mut parts = Vec::new();
        let mut index = 0;
        while index < lines.len() {
            let start = lines[index].start;
            let mut end = lines[index].end;
            if !lines[index].text.trim().is_empty() {
                while index + 1 < lines.len() && !lines[index + 1].text.trim().is_empty() {
                    index += 1;
                    end = lines[index].end;
                }
            }
            parts.push((start, end));
            index += 1;
        }
        let mut next = HashMap::new();
        let mut out = String::new();
        for (start, end) in parts {
            let text = &source[start..end];
            let html = if let Some(html) = next.get(text).or_else(|| self.fragments.get(text)) {
                self.stats.reused += 1;
                html.clone()
            } else {
                let blocks = parse(text);
                if !blocks
                    .iter()
                    .all(|b| matches!(b.kind, BlockKind::Paragraph | BlockKind::Heading { .. }))
                    || blocks
                        .iter()
                        .filter(|b| matches!(b.kind, BlockKind::Heading { .. }))
                        .count()
                        > 1
                {
                    return self.full(source);
                }
                self.stats.parsed += 1;
                let html = render(text, false);
                if html.contains("<ul>") || html.contains("<ol") || html.contains("<blockquote") {
                    return self.full(source);
                }
                html
            };
            out.push_str(&shift_offsets(&html, start));
            next.entry(text.to_owned()).or_insert(html);
        }
        self.fragments = next;
        if out.contains("<h") {
            containers::unique_heading_ids(&out)
        } else {
            out
        }
    }
    fn full(&mut self, source: &str) -> String {
        self.clear();
        self.stats.fallback = true;
        render(source, false)
    }
}
fn shift_offsets(html: &str, offset: usize) -> String {
    if offset == 0 {
        return html.into();
    }
    let mut out = String::with_capacity(html.len());
    let mut cursor = 0;
    while cursor < html.len() {
        if let Some(prefix) = [" data-start=\"", " data-end=\"", " data-task=\""]
            .into_iter()
            .find(|p| html[cursor..].starts_with(p))
        {
            out.push_str(prefix);
            cursor += prefix.len();
            let end = cursor + html[cursor..].find('"').unwrap_or(html.len() - cursor);
            if let Ok(value) = html[cursor..end].parse::<usize>() {
                out.push_str(&(value + offset).to_string());
            } else {
                out.push_str(&html[cursor..end]);
            }
            cursor = end;
        } else {
            let c = html[cursor..].chars().next().unwrap();
            out.push(c);
            cursor += c.len_utf8();
        }
    }
    out
}
