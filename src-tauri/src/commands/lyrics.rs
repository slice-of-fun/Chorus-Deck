use tauri::command;
use crate::lyrics::{betterlyrics, kugou, lrclib, paxsenix, simpmusic, youlyplus, LyricResult};

#[command]
pub async fn fetch_best_lyrics(
    title: String,
    artist: String,
    video_id: Option<String>,
) -> Result<Option<LyricResult>, String> {
    let (lrclib_res, kugou_res, better_res, pax_res, simp_res, youlyplus_res) = tokio::join!(
        lrclib::fetch(&title, &artist),
        kugou::fetch(&title, &artist),
        betterlyrics::fetch(&title, &artist),
        paxsenix::fetch(&title, &artist),
        simpmusic::fetch(&video_id),
        youlyplus::fetch(&title, &artist)
    );

    let results = vec![lrclib_res, kugou_res, better_res, pax_res, simp_res, youlyplus_res];
    let mut fallback_result = None;

    for res in results.into_iter().flatten() {
        if res.lines.is_empty() {
            continue;
        }

        if res.is_synced {
            return Ok(Some(res));
        }

        if fallback_result.is_none() {
            fallback_result = Some(res);
        }
    }

    Ok(fallback_result)
}
