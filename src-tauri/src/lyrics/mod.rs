pub mod betterlyrics;
pub mod kugou;
pub mod lrclib;
pub mod paxsenix;
pub mod simpmusic;
pub mod youlyplus;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LyricLine {
    pub time: i64,
    pub text: String,
    pub words: Option<Vec<LyricWord>>,
    pub translation: Option<String>,
    pub romaji: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LyricWord {
    pub word: String,
    pub start: i64,
    pub duration: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LyricResult {
    pub provider: String,
    pub is_synced: bool,
    pub lines: Vec<LyricLine>,
}
