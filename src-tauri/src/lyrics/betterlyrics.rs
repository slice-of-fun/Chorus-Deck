use crate::lyrics::{LyricLine, LyricResult, LyricWord};
use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;
use regex::Regex;

#[derive(Deserialize)]
struct TTMLResponse {
    ttml: String,
}

pub async fn fetch(title: &str, artist: &str) -> Option<LyricResult> {
    let client = Client::builder().timeout(Duration::from_secs(15)).build().ok()?;
    let url = "https://lyrics-api.boidu.dev/getLyrics";
    
    let resp = client.get(url)
        .query(&[("s", title), ("a", artist)])
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let ttml_res: TTMLResponse = resp.json().await.ok()?;
    
    let p_regex = Regex::new(r#"<p[^>]*begin="([^"]+)"[^>]*>(.*?)</p>"#).ok()?;
    let span_regex = Regex::new(r#"<span[^>]*begin="([^"]+)"[^>]*end="([^"]+)"[^>]*>(.*?)</span>"#).ok()?;
    let strip_tags = Regex::new(r#"<[^>]+>"#).ok()?;
    
    let mut lines = Vec::new();
    
    for cap in p_regex.captures_iter(&ttml_res.ttml) {
        let begin_str = cap.get(1).map_or("", |m| m.as_str());
        let inner_html = cap.get(2).map_or("", |m| m.as_str());
        
        let line_time = parse_time(begin_str);
        
        let mut words = Vec::new();
        for span_cap in span_regex.captures_iter(inner_html) {
            let word_begin = span_cap.get(1).map_or("", |m| m.as_str());
            let word_end = span_cap.get(2).map_or("", |m| m.as_str());
            let word_text = span_cap.get(3).map_or("", |m| m.as_str());
            
            let clean_word = strip_tags.replace_all(word_text, "").into_owned();
            let decoded_word = decode_html_entities(&clean_word).trim().to_string();
            
            if !decoded_word.is_empty() {
                let start = parse_time(word_begin);
                let end = parse_time(word_end);
                
                words.push(LyricWord {
                    word: decoded_word,
                    start,
                    duration: if end > start { end - start } else { 0 },
                });
            }
        }
        
        let line_text = strip_tags.replace_all(inner_html, "").into_owned();
        let clean_line_text = decode_html_entities(&line_text).trim().to_string();
        
        if !clean_line_text.is_empty() {
            lines.push(LyricLine {
                time: line_time,
                text: clean_line_text,
                words: if words.is_empty() { None } else { Some(words) },
                translation: None,
                romaji: None,
            });
        }
    }
    
    if lines.is_empty() {
        return None;
    }
    
    Some(LyricResult {
        provider: "BetterLyrics".to_string(),
        is_synced: true,
        lines,
    })
}

fn parse_time(time_str: &str) -> i64 {
    let parts: Vec<&str> = time_str.split(':').collect();
    let mut seconds = 0.0;
    
    if parts.len() == 3 {
        if let (Ok(h), Ok(m), Ok(s)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>(), parts[2].parse::<f64>()) {
            seconds = h * 3600.0 + m * 60.0 + s;
        }
    } else if parts.len() == 2 {
        if let (Ok(m), Ok(s)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
            seconds = m * 60.0 + s;
        }
    } else if parts.len() == 1 {
        if let Ok(s) = parts[0].parse::<f64>() {
            seconds = s;
        }
    }
    
    (seconds * 1000.0) as i64
}

fn decode_html_entities(text: &str) -> String {
    text.replace("&apos;", "'")
        .replace("&quot;", "\"")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}
