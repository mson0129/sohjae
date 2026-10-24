//! Native renderer microbenchmark; excludes WASM serialization and browser layout.
use sohjae_core::markdown::{render, RenderCache};
use std::time::Instant;
fn main() {
    let source = (0..1000)
        .map(|i| format!("문단 {i}: 한글😀 and **formatted** text."))
        .collect::<Vec<_>>()
        .join("\n\n");
    let edits: Vec<_> = (0..9)
        .map(|i| source.replacen("문단 0:", &format!("문단 0 수정 {i}:"), 1))
        .collect();
    let mut cache = RenderCache::default();
    cache.render(&source);
    let mut full = Vec::new();
    let mut incremental = Vec::new();
    for text in &edits {
        let start = Instant::now();
        let expected = render(text, false);
        full.push(start.elapsed().as_secs_f64() * 1000.);
        let start = Instant::now();
        let actual = cache.render(text);
        incremental.push(start.elapsed().as_secs_f64() * 1000.);
        assert_eq!(actual, expected);
        assert_eq!(cache.stats.parsed, 1);
        assert!(!cache.stats.fallback);
    }
    full.sort_by(f64::total_cmp);
    incremental.sort_by(f64::total_cmp);
    println!("{{\"scope\":\"native release renderer only; no WASM/DOM\",\"paragraphs\":1000,\"source_bytes\":{},\"runs\":9,\"full_median_ms\":{:.3},\"cached_median_ms\":{:.3},\"last_parsed\":{},\"last_reused\":{}}}",source.len(),full[4],incremental[4],cache.stats.parsed,cache.stats.reused);
}
