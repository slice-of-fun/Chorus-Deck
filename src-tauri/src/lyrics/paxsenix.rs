use crate::lyrics::{LyricLine, LyricResult};
use reqwest::Client;
use serde::Deserialize;

#[derive(Deserialize)]
struct PaxsenixSearchResult {
    id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PaxsenixLyricsResponse {
    elrc_multi_person: Option<String>,
    elrc: Option<String>,
    plain: Option<String>,
}

pub async fn fetch(title: &str, artist: &str) -> Option<LyricResult> {
    let client = Client::new();
    let query = format!("{} {}", title, artist);
    let search_url = format!("https://lyrics.paxsenix.org/apple-music/search?q={}", urlencoding::encode(&query));
    
    let search_resp: Vec<PaxsenixSearchResult> = client
        .get(&search_url)
        .header("User-Agent", "chorusmusic/Unknown")
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()?;
        
    let first_match = search_resp.into_iter().next()?;
    
    let lyrics_url = format!("https://lyrics.paxsenix.org/apple-music/lyrics?id={}", urlencoding::encode(&first_match.id));
    let lyrics_resp: PaxsenixLyricsResponse = client
        .get(&lyrics_url)
        .header("User-Agent", "chorusmusic/Unknown")
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()?;
        
    let (lyrics_str, is_synced) = if let Some(elrc) = lyrics_resp.elrc_multi_person.filter(|s| !s.is_empty()) {
        (elrc, true)
    } else if let Some(elrc) = lyrics_resp.elrc.filter(|s| !s.is_empty()) {
        (elrc, true)
    } else if let Some(plain) = lyrics_resp.plain.filter(|s| !s.is_empty()) {
        (plain, false)
    } else {
        return None;
    };
    
    let mut lines = Vec::new();
    if is_synced {
        for line in lyrics_str.lines() {
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
    } else {
        for line in lyrics_str.lines() {
            lines.push(LyricLine {
                time: 0,
                text: line.to_string(),
                words: None,
                translation: None,
                romaji: None,
            });
        }
    }
    
    if lines.is_empty() && is_synced {
        return None;
    }
    
    Some(LyricResult {
        provider: "Paxsenix".to_string(),
        is_synced,
        lines,
    })
}
