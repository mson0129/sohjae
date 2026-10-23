//! Length-prefixed audit helper; not included in the browser runtime.
use std::io::{self, Read, Write};
fn main() {
    let mut input = Vec::new();
    io::stdin().read_to_end(&mut input).unwrap();
    let mut cursor = 0;
    let mut output = io::BufWriter::new(io::stdout());
    while cursor < input.len() {
        let length = u32::from_le_bytes(input[cursor..cursor + 4].try_into().unwrap()) as usize;
        cursor += 4;
        let source = std::str::from_utf8(&input[cursor..cursor + length]).unwrap();
        cursor += length;
        let html = sohjae_core::markdown::render(source, true);
        output
            .write_all(&(html.len() as u32).to_le_bytes())
            .unwrap();
        output.write_all(html.as_bytes()).unwrap();
    }
}
