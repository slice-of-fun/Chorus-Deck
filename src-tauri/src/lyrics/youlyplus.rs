use crate::lyrics::{LyricLine, LyricResult, LyricWord};
use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;
use futures_util::stream::{FuturesUnordered, StreamExt};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LyricsResponse {
    synced_lyrics: Option<String>,
    plain_lyrics: Option<String>,
    lyrics: Option<Vec<LyricsItem>>,
}

#[derive(Deserialize)]
struct LyricsItem {
    text: Option<String>,
    time: Option<i64>,
    syllabus: Option<Vec<Syllable>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Syllable {
    text: Option<String>,
    time: Option<i64>,
    duration: Option<i64>,
    is_background: Option<bool>,
}

const BASE_SERVERS: &[&str] = &[
    "https://lyricsplus.prjktla.my.id",
    "https://lyricsplus.atomix.one",
    "https://lyricsplus.binimum.org",
    "https://lyricsplus.prjktla.workers.dev",
    "https://lyricsplus-seven.vercel.app",
    "https://lyrics-plus-backend.vercel.app",
];

pub async fn fetch(title: &str, artist: &str) -> Option<LyricResult> {
    let client = Client::builder().timeout(Duration::from_secs(8)).build().ok()?;

    let mut tasks = FuturesUnordered::new();
    
    for server in BASE_SERVERS {
        let client_clone = client.clone();
        let title_clone = title.to_string();
        let artist_clone = artist.to_string();
        let url = format!("{}/v2/lyrics/get", server);
        
        tasks.push(tokio::spawn(async move {
            let req = client_clone.get(&url)
                .query(&[("title", &title_clone), ("artist", &artist_clone), ("duration", &"0".to_string())])
                .send()
                .await;
            match req {
                Ok(resp) if resp.status().is_success() => {
                    resp.json::<LyricsResponse>().await.ok()
                },
                _ => None
            }
        }));
    }

    let mut first_valid_response = None;

    while let Some(res) = tasks.next().await {
        if let Ok(Some(resp)) = res {
            if resp.synced_lyrics.is_some() || resp.lyrics.is_some() || resp.plain_lyrics.is_some() {
                first_valid_response = Some(resp);
                break;
            }
        }
    }

    let resp = first_valid_response?;
    
    // Parse response
    let mut lines = Vec::new();
    let mut is_synced = false;

    if let Some(synced) = resp.synced_lyrics.filter(|s| !s.trim().is_empty()) {
        is_synced = true;
        for line in synced.lines() {
            if let Some(pos) = line.find(']') {
                if line.starts_with('[') && pos >= 6 {
                    let time_str = &line[1..pos];
                    let text = line[pos+1..].trim().to_string();
                    let mut parts = time_str.split(':');
                    if let (Some(m), Some(s)) = (parts.next(), parts.next()) {
                        if let (Ok(m), Ok(s)) = (m.parse::<f64>(), s.parse::<f64>()) {
                            let time_ms = ((m * 60.0 + s) * 1000.0) as i64;
                            lines.push(LyricLine {
                                time: time_ms,
                                text,
                                words: None,
                                translation: None,
                                romaji: None,
                            });
                        }
                    }
                }
            }
        }
    } else if let Some(items) = resp.lyrics {
        is_synced = true;
        for item in items {
            let line_time = item.time.unwrap_or(0);
            let mut words = None;
            
            if let Some(syllables) = item.syllabus {
                if !syllables.is_empty() {
                    let mut w_list = Vec::new();
                    for syl in syllables {
                        let text = syl.text.unwrap_or_default();
                        let bg_marker = if syl.is_background.unwrap_or(false) { "{bg}" } else { "" };
                        w_list.push(LyricWord {
                            word: format!("{}{}", bg_marker, text),
                            start: syl.time.unwrap_or(line_time),
                            duration: syl.duration.unwrap_or(0),
                        });
                    }
                    words = Some(w_list);
                }
            }
            
            lines.push(LyricLine {
                time: line_time,
                text: item.text.unwrap_or_default(),
                words,
                translation: None,
                romaji: None,
            });
        }
    } else if let Some(plain) = resp.plain_lyrics {
        for line in plain.lines() {
            lines.push(LyricLine {
                time: 0,
                text: line.to_string(),
                words: None,
                translation: None,
                romaji: None,
            });
        }
    }

    if lines.is_empty() {
        return None;
    }

    Some(LyricResult {
        provider: "YouLyPlus".to_string(),
        is_synced,
        lines,
    })
}
