//! Small, deterministic lexical coloring. Never executes code or emits source HTML.
//! Unknown languages remain plain text; this is not a grammar validator.
pub(crate) struct Lexer {
    block_comment: usize,
    string: Option<&'static str>,
    template_depth: Vec<usize>,
    expect_expression: bool,
}
impl Default for Lexer {
    fn default() -> Self {
        Self {
            block_comment: 0,
            string: None,
            template_depth: Vec::new(),
            expect_expression: true,
        }
    }
}
impl Lexer {
    pub(crate) fn tokens(
        &mut self,
        text: &str,
        language: &str,
    ) -> Vec<(usize, usize, &'static str)> {
        let language = language.to_ascii_lowercase();
        let language = language.split_whitespace().next().unwrap_or("");
        if ![
            "json",
            "rust",
            "rs",
            "javascript",
            "js",
            "typescript",
            "ts",
            "python",
            "py",
            "bash",
            "sh",
            "shell",
            "css",
            "html",
            "xml",
        ]
        .contains(&language)
        {
            return Vec::new();
        }
        let hash_comment = ["python", "py", "bash", "sh", "shell"].contains(&language);
        let slash_comment =
            ["rust", "rs", "javascript", "js", "typescript", "ts", "css"].contains(&language);
        let javascript = ["js", "javascript", "ts", "typescript"].contains(&language);
        let rust = ["rust", "rs"].contains(&language);
        let python = ["python", "py"].contains(&language);
        let mut tokens = Vec::new();
        let mut index = 0;
        while index < text.len() {
            let tail = &text[index..];
            let c = tail.chars().next().unwrap();
            let (length, kind) = if let Some(delimiter) = self.string {
                if delimiter == "`" && tail.starts_with("${") {
                    self.string = None;
                    self.template_depth.push(1);
                    self.expect_expression = true;
                    (2, "literal")
                } else {
                    let (length, closed) = string_segment(tail, delimiter, 0, delimiter == "`");
                    if closed {
                        self.string = None;
                        self.expect_expression = false;
                    }
                    (length, "string")
                }
            } else if self.block_comment > 0 || slash_comment && tail.starts_with("/*") {
                let mut offset = 0;
                if self.block_comment == 0 {
                    self.block_comment = 1;
                    offset = 2;
                }
                while offset < tail.len() {
                    if rust && tail[offset..].starts_with("/*") {
                        self.block_comment += 1;
                        offset += 2;
                    } else if tail[offset..].starts_with("*/") {
                        self.block_comment -= 1;
                        offset += 2;
                        if self.block_comment == 0 {
                            break;
                        }
                    } else {
                        offset += tail[offset..].chars().next().unwrap().len_utf8();
                    }
                }
                (offset, "comment")
            } else if python
                && (tail.starts_with("\"\"\"") || tail.starts_with("\u{27}\u{27}\u{27}"))
            {
                let delimiter = if c == '"' {
                    "\"\"\""
                } else {
                    "\u{27}\u{27}\u{27}"
                };
                let (length, closed) = string_segment(tail, delimiter, 3, false);
                if !closed {
                    self.string = Some(delimiter);
                }
                (length, "string")
            } else if javascript && c == '`' {
                let (length, closed) = string_segment(tail, "`", 1, true);
                if !closed {
                    self.string = Some("`");
                }
                self.expect_expression = false;
                (length, "string")
            } else if javascript && c == '/' && self.expect_expression && !tail.starts_with("//") {
                if let Some(length) = regex_end(tail) {
                    self.expect_expression = false;
                    (length, "string")
                } else {
                    (1, "")
                }
            } else if (hash_comment && c == '#') || (slash_comment && tail.starts_with("//")) {
                (tail.len(), "comment")
            } else if c == '"'
                || c == '\''
                || (c == '`'
                    && [
                        "js",
                        "javascript",
                        "ts",
                        "typescript",
                        "sh",
                        "bash",
                        "shell",
                    ]
                    .contains(&language))
            {
                // A Rust lifetime is an identifier, rather than an unterminated string.
                if c == '\'' && ["rust", "rs"].contains(&language) && !tail[1..].contains('\'') {
                    index += 1;
                    continue;
                }
                let mut length = c.len_utf8();
                let mut escaped = false;
                for next in tail[c.len_utf8()..].chars() {
                    length += next.len_utf8();
                    if !escaped && next == c {
                        break;
                    }
                    escaped = !escaped && next == '\\';
                }
                let kind = if language == "json" && tail[length..].trim_start().starts_with(':') {
                    "key"
                } else {
                    "string"
                };
                self.expect_expression = false;
                (length, kind)
            } else if c.is_ascii_digit()
                || (c == '-' && tail.as_bytes().get(1).is_some_and(u8::is_ascii_digit))
            {
                let length = tail
                    .char_indices()
                    .skip(1)
                    .find(|(_, c)| !c.is_ascii_alphanumeric() && !['.', '_'].contains(c))
                    .map_or(tail.len(), |(offset, _)| offset);
                self.expect_expression = false;
                (length, "number")
            } else if c.is_alphabetic() || c == '_' {
                let length = tail
                    .char_indices()
                    .find(|(_, c)| !c.is_alphanumeric() && *c != '_')
                    .map_or(tail.len(), |(offset, _)| offset);
                let word = &tail[..length];
                if javascript {
                    self.expect_expression = [
                        "return", "throw", "case", "delete", "typeof", "void", "yield", "await",
                        "in", "of",
                    ]
                    .contains(&word);
                }
                let kind = if [
                    "true",
                    "false",
                    "null",
                    "None",
                    "True",
                    "False",
                    "undefined",
                ]
                .contains(&word)
                {
                    "literal"
                } else if keywords(language)
                    .split_whitespace()
                    .any(|keyword| keyword == word)
                {
                    "keyword"
                } else {
                    ""
                };
                (length, kind)
            } else {
                if javascript && !c.is_whitespace() {
                    if c == '{' {
                        if let Some(depth) = self.template_depth.last_mut() {
                            *depth += 1;
                        }
                    }
                    if c == '}' {
                        if let Some(depth) = self.template_depth.last_mut() {
                            *depth -= 1;
                            if *depth == 0 {
                                self.template_depth.pop();
                                self.string = Some("`");
                            }
                        }
                    }
                    self.expect_expression = "([{=,:;!?&|+*-~%<>".contains(c);
                }
                (c.len_utf8(), "")
            };
            if !kind.is_empty() {
                tokens.push((index, index + length, kind));
            }
            index += length;
        }
        tokens
    }
}
fn string_segment(text: &str, delimiter: &str, start: usize, template: bool) -> (usize, bool) {
    let mut i = start;
    while i < text.len() {
        if text[i..].starts_with(delimiter) {
            return (i + delimiter.len(), true);
        }
        if template && text[i..].starts_with("${") {
            return (i, false);
        }
        let c = text[i..].chars().next().unwrap();
        i += c.len_utf8();
        if c == '\\' && i < text.len() {
            i += text[i..].chars().next().unwrap().len_utf8();
        }
    }
    (text.len(), false)
}
fn regex_end(text: &str) -> Option<usize> {
    let mut i = 1;
    let mut class = false;
    while i < text.len() {
        let c = text[i..].chars().next()?;
        i += c.len_utf8();
        if c == '\\' {
            i += text[i..].chars().next()?.len_utf8();
            continue;
        }
        if c == '[' {
            class = true;
        }
        if c == ']' {
            class = false;
        }
        if c == '/' && !class {
            while text.as_bytes().get(i).is_some_and(u8::is_ascii_alphabetic) {
                i += 1;
            }
            return Some(i);
        }
    }
    None
}
fn keywords(language: &str) -> &'static str {
    match language {
        "rust" | "rs" => "as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait type unsafe use where while",
        "javascript" | "js" | "typescript" | "ts" => "as async await break case catch class const continue debugger default delete do else enum export extends finally for from function if implements import in instanceof interface let new of private protected public return static super switch this throw try type typeof var void while with yield",
        "python" | "py" => "and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield",
        "bash" | "sh" | "shell" => "if then else elif fi for while until do done case esac function in select export local readonly return",
        _ => "",
    }
}
