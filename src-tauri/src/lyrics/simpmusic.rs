use crate::lyrics::{LyricLine, LyricResult};
use reqwest::Client;
use serde::Deserialize;

#[derive(Deserialize)]
struct SimpMusicApiResponse {
    success: bool,
    data: Option<Vec<LyricsData>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LyricsData {
    rich_sync_lyrics: Option<String>,
    synced_lyrics: Option<String>,
    plain_lyrics: Option<String>,
}

pub async fn fetch(video_id: &Option<String>) -> Option<LyricResult> {
    let vid = video_id.as_ref()?;
    let client = Client::new();
    let mut url = format!("https://api-lyrics.simpmusic.org/v1/{}", vid);
    
    let mut resp: Option<SimpMusicApiResponse> = client
        .get(&url)
        .header("Accept", "application/json")
        .header("User-Agent", "SimpMusicLyrics/1.0")
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok();
        
    if resp.is_none() || !resp.as_ref().unwrap().success {
        // Try fallback
        url = format!("https://vivi-yt-music-server.onrender.com/v1/{}", vid);
        resp = client
            .get(&url)
            .header("Accept", "application/json")
            .header("User-Agent", "SimpMusicLyrics/1.0")
            .send()
            .await
            .ok()?
            .json()
            .await
            .ok();
    }
    
    let resp = resp?;
    if !resp.success {
        return None;
    }
    
    let tracks = resp.data?;
    if tracks.is_empty() {
        return None;
    }
    
    let track = tracks.into_iter().next()?;
    
    let (lyrics_str, is_synced) = if let Some(rich) = track.rich_sync_lyrics.filter(|s| !s.is_empty()) {
        (rich, true)
    } else if let Some(synced) = track.synced_lyrics.filter(|s| !s.is_empty()) {
        (synced, true)
    } else if let Some(plain) = track.plain_lyrics.filter(|s| !s.is_empty()) {
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
        provider: "SimpMusic".to_string(),
        is_synced,
        lines,
    })
}
