//! Small, deterministic lexical coloring. Never executes code or emits source HTML.
//! Unknown languages remain plain text; this is not a grammar validator.
#[derive(Default)]
pub(crate) struct Lexer {
    block_comment: bool,
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
        let mut tokens = Vec::new();
        let mut index = 0;
        while index < text.len() {
            let tail = &text[index..];
            let c = tail.chars().next().unwrap();
            let (length, kind) = if self.block_comment {
                let length = tail.find("*/").map_or(tail.len(), |end| end + 2);
                self.block_comment = !tail.contains("*/");
                (length, "comment")
            } else if slash_comment && tail.starts_with("/*") {
                let length = tail[2..].find("*/").map_or(tail.len(), |end| end + 4);
                self.block_comment = !tail[2..].contains("*/");
                (length, "comment")
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
                (length, kind)
            } else if c.is_ascii_digit()
                || (c == '-' && tail.as_bytes().get(1).is_some_and(u8::is_ascii_digit))
            {
                let length = tail
                    .char_indices()
                    .skip(1)
                    .find(|(_, c)| !c.is_ascii_alphanumeric() && !['.', '_'].contains(c))
                    .map_or(tail.len(), |(offset, _)| offset);
                (length, "number")
            } else if c.is_alphabetic() || c == '_' {
                let length = tail
                    .char_indices()
                    .find(|(_, c)| !c.is_alphanumeric() && *c != '_')
                    .map_or(tail.len(), |(offset, _)| offset);
                let word = &tail[..length];
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
fn keywords(language: &str) -> &'static str {
    match language {
        "rust" | "rs" => "as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait type unsafe use where while",
        "javascript" | "js" | "typescript" | "ts" => "as async await break case catch class const continue debugger default delete do else enum export extends finally for from function if implements import in instanceof interface let new of private protected public return static super switch this throw try type typeof var void while with yield",
        "python" | "py" => "and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield",
        "bash" | "sh" | "shell" => "if then else elif fi for while until do done case esac function in select export local readonly return",
        _ => "",
    }
}
