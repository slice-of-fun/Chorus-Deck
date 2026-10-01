use crate::lyrics::{LyricLine, LyricResult};
use reqwest::Client;
use serde::Deserialize;
use base64::{Engine as _, engine::general_purpose};
use regex::Regex;

#[derive(Deserialize)]
struct KuGouSearchResponse {
    candidates: Option<Vec<KuGouCandidate>>,
}

#[derive(Deserialize)]
struct KuGouCandidate {
    id: String,
    accesskey: String,
}

#[derive(Deserialize)]
struct KuGouDownloadResponse {
    content: String,
}

pub async fn fetch(title: &str, artist: &str) -> Option<LyricResult> {
    let client = Client::new();
    let query = format!("{} {}", title, artist);
    let search_url = format!("http://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword={}", urlencoding::encode(&query));

    let search_resp: KuGouSearchResponse = client.get(&search_url).send().await.ok()?.json().await.ok()?;
    
    let candidate = search_resp.candidates?.into_iter().next()?;

    let download_url = format!(
        "http://lyrics.kugou.com/download?ver=1&client=pc&id={}&accesskey={}&fmt=lrc&charset=utf8",
        candidate.id, candidate.accesskey
    );

    let dl_resp: KuGouDownloadResponse = client.get(&download_url).send().await.ok()?.json().await.ok()?;

    let decoded = general_purpose::STANDARD.decode(&dl_resp.content).ok()?;
    let lrc_str = String::from_utf8(decoded).ok()?;

    // Strip [id:$00000000] and similar
    let re = Regex::new(r"\[id:\$.*\]\n?").unwrap();
    let cleaned = re.replace_all(&lrc_str, "").to_string();

    let mut lines = Vec::new();
    for line in cleaned.lines() {
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

    if lines.is_empty() {
        return None;
    }

    Some(LyricResult {
        provider: "KuGou".to_string(),
        is_synced: true,
        lines,
    })
}
