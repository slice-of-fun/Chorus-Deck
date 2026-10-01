use crate::lyrics::{LyricLine, LyricResult};
use reqwest::Client;
use serde::Deserialize;
use strsim::levenshtein;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LrcLibTrack {
    synced_lyrics: Option<String>,
    plain_lyrics: Option<String>,
    track_name: Option<String>,
    artist_name: Option<String>,
}

pub async fn fetch(title: &str, artist: &str) -> Option<LyricResult> {
    let client = Client::new();
    let query = format!("{} {}", title, artist);
    let url = format!("https://lrclib.net/api/search?q={}", urlencoding::encode(&query));

    let response = client.get(&url).send().await.ok()?;
    let tracks: Vec<LrcLibTrack> = response.json().await.ok()?;

    if tracks.is_empty() {
        return None;
    }

    let mut best_track = None;
    let mut min_distance = usize::MAX;

    for track in &tracks {
        if track.synced_lyrics.is_none() && track.plain_lyrics.is_none() {
            continue;
        }
        
        let t_name = track.track_name.as_deref().unwrap_or("").to_lowercase();
        let a_name = track.artist_name.as_deref().unwrap_or("").to_lowercase();
        
        let dist = levenshtein(&title.to_lowercase(), &t_name) + levenshtein(&artist.to_lowercase(), &a_name);
        if dist < min_distance {
            min_distance = dist;
            best_track = Some(track);
        }
    }

    let track = best_track?;

    let is_synced = track.synced_lyrics.is_some();
    let raw_lyrics = track.synced_lyrics.clone().unwrap_or_else(|| track.plain_lyrics.clone().unwrap_or_default());

    let mut lines = Vec::new();
    for line in raw_lyrics.lines() {
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
        } else {
             lines.push(LyricLine {
                time: 0,
                text: line.to_string(),
                words: None,
                translation: None,
                romaji: None,
             });
        }
    }

    Some(LyricResult {
        provider: "LrcLib".to_string(),
        is_synced,
        lines,
    })
}
