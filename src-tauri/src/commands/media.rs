use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::commands::AppState;
use crate::downloads::supervisor::{build_filename, CompletedDownload, DownloadTask, SongInfo};

const LYRIC_CHANNEL: &str = "receive-lyric";

#[tauri::command(rename = "send-lyric")]
pub fn send_lyric(app: AppHandle, data: serde_json::Value) -> Result<(), String> {
    if let Some(lyric) = app.get_webview_window("lyric") {
        let _ = lyric.emit(LYRIC_CHANNEL, &data);
    }
    if let Some(island) = app.get_webview_window("dynamic-island") {
        let _ = island.emit(LYRIC_CHANNEL, &data);
    }
    Ok(())
}

#[tauri::command(rename = "tray-lyric-update")]
pub fn tray_lyric_update(app: AppHandle, data: serde_json::Value) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let text = data
            .get("text")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        if !text.is_empty() {
            let _ = tray.set_tooltip(Some(text));
        }
    }
    Ok(())
}

#[tauri::command(rename = "cache-lyric")]
pub fn cache_lyric(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    state.cache.lock().map_err(|_| "cache lock poisoned")?.set(
        key,
        value.into_bytes(),
        Some(86_400),
    );
    Ok(())
}

#[tauri::command(rename = "get-cached-lyric")]
pub fn get_cached_lyric(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    let bytes = state
        .cache
        .lock()
        .map_err(|_| "cache lock poisoned")?
        .get(&key);
    Ok(bytes.and_then(|b| String::from_utf8(b).ok()))
}

#[tauri::command(rename = "clear-lyric-cache")]
pub fn clear_lyric_cache(state: State<'_, AppState>) -> Result<(), String> {
    state
        .cache
        .lock()
        .map_err(|_| "cache lock poisoned")?
        .clear();
    Ok(())
}

#[tauri::command(rename = "clear-lyrics-cache")]
pub fn clear_lyrics_cache(state: State<'_, AppState>) -> Result<(), String> {
    clear_lyric_cache(state)
}

#[derive(Debug, Deserialize)]
pub struct LyricsPayload {
    #[serde(default)]
    pub action: String,
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub lrc: String,
    #[serde(default)]
    pub tlyric: String,
}

#[tauri::command(rename = "get-lyrics")]
pub fn get_lyrics(payload: LyricsPayload) -> Result<serde_json::Value, String> {
    if payload.id.is_empty() {
        return Err("missing lyric id".to_string());
    }
    Ok(serde_json::json!({
        "action": payload.action,
        "id": payload.id,
        "lrc": payload.lrc,
        "tlyric": payload.tlyric,
    }))
}

#[tauri::command(rename = "download:get-embedded-lyrics")]
pub fn get_embedded_lyrics(file_path: String) -> Result<Option<String>, String> {
    use lofty::prelude::*;
    use lofty::read_from_path;
    use lofty::tag::Accessor;

    let tagged = read_from_path(&file_path).map_err(|e| e.to_string())?;
    let tag = tagged
        .primary_tag()
        .or_else(|| tagged.first_tag())
        .ok_or_else(|| "no tags in file".to_string())?;

    Ok(tag
        .comment()
        .map(|c| c.to_string())
        .filter(|s| !s.trim().is_empty()))
}

#[tauri::command(rename = "get-downloads-path")]
pub fn get_downloads_path(state: State<'_, AppState>) -> String {
    state
        .downloads
        .downloads_dir()
        .to_string_lossy()
        .to_string()
}

#[tauri::command(rename = "download:get-queue")]
pub fn download_get_queue(state: State<'_, AppState>) -> Vec<DownloadTask> {
    state.downloads.get_queue()
}

#[tauri::command(rename = "download:get-completed")]
pub fn download_get_completed(state: State<'_, AppState>) -> Vec<CompletedDownload> {
    state.downloads.get_completed()
}

#[tauri::command(rename = "download:add")]
pub fn download_add(state: State<'_, AppState>, mut task: DownloadTask) -> Result<(), String> {
    ensure_task_paths(&mut task);
    state.downloads.add(task);
    Ok(())
}

#[tauri::command(rename = "download:add-batch")]
pub fn download_add_batch(
    state: State<'_, AppState>,
    mut tasks: Vec<DownloadTask>,
) -> Result<(), String> {
    for task in tasks.iter_mut() {
        ensure_task_paths(task);
    }
    state.downloads.add_batch(tasks);
    Ok(())
}

fn ensure_task_paths(task: &mut DownloadTask) {
    if task.final_file_path.is_empty() {
        let dir = PathBuf::from("downloads");
        let name = if task.filename.is_empty() {
            task.song_info.id.clone()
        } else {
            task.filename.clone()
        };
        task.final_file_path = dir.join(&name).to_string_lossy().to_string();
    }
    if task.temp_file_path.is_empty() {
        task.temp_file_path = format!("{}.part", task.final_file_path);
    }
}

#[tauri::command(rename = "download:pause")]
pub fn download_pause(state: State<'_, AppState>, task_id: String) -> Result<(), String> {
    state.downloads.pause(&task_id);
    Ok(())
}

#[tauri::command(rename = "download:resume")]
pub fn download_resume(state: State<'_, AppState>, task_id: String) -> Result<(), String> {
    state.downloads.resume(&task_id);
    Ok(())
}

#[tauri::command(rename = "download:cancel")]
pub fn download_cancel(state: State<'_, AppState>, task_id: String) -> Result<(), String> {
    state.downloads.cancel(&task_id);
    Ok(())
}

#[tauri::command(rename = "download:cancel-all")]
pub fn download_cancel_all(state: State<'_, AppState>) -> Result<(), String> {
    state.downloads.cancel_all();
    Ok(())
}

#[tauri::command(rename = "download:clear-completed")]
pub fn download_clear_completed(state: State<'_, AppState>) -> Result<(), String> {
    state.downloads.clear_completed();
    Ok(())
}

#[tauri::command(rename = "download:delete-completed")]
pub fn download_delete_completed(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<(), String> {
    state.downloads.delete_completed(&file_path)
}

#[tauri::command(rename = "download:provide-url")]
pub fn download_provide_url(
    state: State<'_, AppState>,
    task_id: String,
    url: String,
) -> Result<(), String> {
    state.downloads.provide_url(&task_id, url);
    Ok(())
}

#[tauri::command(rename = "download:set-concurrency")]
pub fn download_set_concurrency(state: State<'_, AppState>, n: usize) -> Result<(), String> {
    state.downloads.set_concurrency(n);
    Ok(())
}

/// Build a download filename from the configured format string.
pub fn filename_for(format: &str, separator: &str, extension: &str, song: &SongInfo) -> String {
    let base = build_filename(format, separator, song);
    let ext = if extension.starts_with('.') {
        extension.to_string()
    } else {
        format!(".{extension}")
    };
    format!("{base}{ext}")
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocalMusicMeta {
    pub file_path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: f64,
    pub cover_path: Option<String>,
    pub lyrics: Option<String>,
    pub file_size: u64,
    pub modified_time: u64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub path: String,
    pub modified_time: u64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScanResultWithStats {
    pub files: Vec<FileInfo>,
    pub count: usize,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub files: Vec<String>,
    pub count: usize,
}

const AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "m4a", "aac", "flac", "wav", "ogg", "opus", "wma", "aiff", "alac",
];

fn read_metadata(path: &Path, app: Option<&AppHandle>) -> Option<LocalMusicMeta> {
    use lofty::prelude::*;
    use lofty::read_from_path;
    use lofty::tag::Accessor;

    let fs_meta = std::fs::metadata(path).ok()?;
    let file_size = fs_meta.len();
    let modified_time = fs_meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let tagged = read_from_path(path).ok()?;
    let duration = tagged.properties().duration().as_secs_f64();

    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());
    let (name, artist, album, cover, lyrics) = match tag {
        Some(t) => {
            let c = t.pictures().first().and_then(|p| {
                if let Some(app_handle) = app {
                    if let Ok(cache_dir) = app_handle.path().app_cache_dir() {
                        let covers_dir = cache_dir.join("covers");
                        let _ = std::fs::create_dir_all(&covers_dir);
                        use std::hash::{Hash, Hasher};
                        let mut hasher = std::collections::hash_map::DefaultHasher::new();
                        p.data().hash(&mut hasher);
                        let file_name = format!("{:x}.jpg", hasher.finish());
                        let file_path = covers_dir.join(file_name);
                        let _ = std::fs::write(&file_path, p.data());
                        return Some(file_path.to_string_lossy().to_string());
                    }
                }
                None
            });
            (
                t.title().map(|s| s.to_string()),
                t.artist().map(|s| s.to_string()),
                t.album().map(|s| s.to_string()),
                c,
                t.comment()
                    .map(|s| s.to_string())
                    .filter(|s| !s.trim().is_empty()),
            )
        }
        None => (None, None, None, None, None),
    };

    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    Some(LocalMusicMeta {
        file_path: path.to_string_lossy().to_string(),
        title: name.unwrap_or(stem),
        artist: artist.unwrap_or_default(),
        album: album.unwrap_or_default(),
        duration,
        cover_path: cover,
        lyrics,
        file_size,
        modified_time,
    })
}

fn collect_audio_files(root: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_audio_files(&path, out);
        } else if path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| AUDIO_EXTENSIONS.contains(&e.to_lowercase().as_str()))
            .unwrap_or(false)
        {
            out.push(path);
        }
    }
}

#[tauri::command(rename = "scan-local-music")]
pub fn scan_local_music(folder_path: String) -> ScanResult {
    let mut files = Vec::new();
    collect_audio_files(Path::new(&folder_path), &mut files);
    let paths: Vec<String> = files
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();
    ScanResult {
        count: paths.len(),
        files: paths,
    }
}

#[tauri::command(rename = "scan-local-music-with-stats")]
pub fn scan_local_music_with_stats(folder_path: String) -> ScanResultWithStats {
    let mut files = Vec::new();
    collect_audio_files(Path::new(&folder_path), &mut files);

    let mut file_infos = Vec::new();
    for p in &files {
        let meta = std::fs::metadata(p).ok();
        let modified_time = meta
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        file_infos.push(FileInfo {
            path: p.to_string_lossy().to_string(),
            modified_time,
        });
    }
    ScanResultWithStats {
        count: file_infos.len(),
        files: file_infos,
    }
}

#[tauri::command(rename = "parse-local-music-metadata")]
pub fn parse_local_music_metadata(app: AppHandle, file_paths: Vec<String>) -> Vec<LocalMusicMeta> {
    file_paths
        .iter()
        .filter_map(|p| read_metadata(Path::new(p), Some(&app)))
        .collect()
}

#[tauri::command(rename = "check-file-exists")]
pub fn check_file_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command(rename = "unblock-music")]
pub fn unblock_music(
    id: String,
    _data: serde_json::Value,
    _enabled_sources: Vec<String>,
) -> Result<serde_json::Value, String> {
    Err(format!(
        "unblock-music is not implemented in the Tauri backend (id={id}); the NetEase \
         unblocker ran as a Node server under Electron and has no Rust equivalent yet"
    ))
}
