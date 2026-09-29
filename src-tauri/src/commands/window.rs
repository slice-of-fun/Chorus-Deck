use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, PhysicalSize, WebviewUrl, WebviewWindow};

use crate::smtc::windows_smtc::{self, PlaybackState};

const LYRIC_URL: &str = "index.html#lyric";

fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())
}

#[tauri::command]
pub fn minimize_window(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn maximize_window(window: WebviewWindow) -> Result<(), String> {
    if window.is_maximized().map_err(|e| e.to_string())? {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command(rename = "close-window")]
pub fn close_window(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command(rename = "quit-app")]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn restart(app: AppHandle) {
    app.restart();
}

#[tauri::command(rename = "restore-window")]
pub fn restore_window(window: WebviewWindow) -> Result<(), String> {
    window.unminimize().map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command(rename = "resize-window")]
pub fn resize_window(window: WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    if !(1.0..=20000.0).contains(&width) || !(1.0..=20000.0).contains(&height) {
        return Err(format!("invalid size {width}x{height}"));
    }
    let scale = window.scale_factor().unwrap_or(1.0);
    window
        .set_size(PhysicalSize::new(
            (width * scale) as u32,
            (height * scale) as u32,
        ))
        .map_err(|e| e.to_string())
}

const MINI_SIZE: (u32, u32) = (420, 130);
const MINI_WITH_PLAYLIST: (u32, u32) = (420, 460);

/// Toggle the compact player size. `showPlaylist` expands the popup playlist.
#[tauri::command(rename = "resize-mini-window")]
pub fn resize_mini_window(window: WebviewWindow, show_playlist: bool) -> Result<(), String> {
    let (w, h) = if show_playlist {
        MINI_WITH_PLAYLIST
    } else {
        MINI_SIZE
    };
    window
        .set_size(PhysicalSize::new(w, h))
        .map_err(|e| e.to_string())
}

#[tauri::command(rename = "mini-window")]
pub fn mini_window(app: AppHandle) -> Result<(), String> {
    let window = main_window(&app)?;
    window
        .set_size(PhysicalSize::new(MINI_SIZE.0, MINI_SIZE.1))
        .map_err(|e| e.to_string())
}

#[tauri::command(rename = "mini-tray")]
pub fn mini_tray(app: AppHandle) -> Result<(), String> {
    let window = main_window(&app)?;
    window
        .set_size(PhysicalSize::new(MINI_SIZE.0, MINI_SIZE.1))
        .map_err(|e| e.to_string())?;
    window.set_always_on_top(true).map_err(|e| e.to_string())
}

/// Platform identifier, matching what the renderer expects from
/// `process.platform` under Electron.
#[tauri::command(rename = "get-platform")]
pub fn get_platform(_app: AppHandle) -> &'static str {
    if cfg!(target_os = "windows") {
        "win32"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else {
        "unknown"
    }
}

// ---------------------------------------------------------------- lyric window

/// Create (or focus) the detached lyric window.
#[tauri::command(rename = "open-lyric")]
pub fn open_lyric(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("lyric") {
        existing.show().map_err(|e| e.to_string())?;
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let url = WebviewUrl::App(LYRIC_URL.into());
    let window = tauri::WebviewWindowBuilder::new(&app, "lyric", url)
        .title("Chorus Deck Lyrics")
        .inner_size(520.0, 220.0)
        .min_inner_size(320.0, 120.0)
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .shadow(true)
        .build()
        .map_err(|e| e.to_string())?;

    // The lyric window is hidden by default; the renderer reveals it once it
    // has painted, which is what the renderer waits for on this channel.
    let _ = window.emit("lyric-window-ready", ());

    // Notify the main window that a new lyric window exists.
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.emit("lyric-window-ready", ());
    }
    Ok(())
}

// ------------------------------------------------------- playback / tray state

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SongUpdate {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub artist: String,
    #[serde(default)]
    pub album: String,
    #[serde(default)]
    pub cover_url: String,
    #[serde(default)]
    pub duration: f64,
    #[serde(default)]
    pub is_playing: bool,
}

#[tauri::command(rename = "update-current-song")]
pub fn update_current_song(app: AppHandle, data: SongUpdate) -> Result<(), String> {
    windows_smtc::set_now_playing(data.title.clone(), data.artist.clone());
    if data.is_playing {
        windows_smtc::set_playback_state(PlaybackState::Playing);
    }

    // Keep the tray tooltip in sync.
    if let Some(tray) = app.tray_by_id("main-tray") {
        if let Some(line) = windows_smtc::display_line() {
            let _ = tray.set_tooltip(Some(&line));
        }
    }

    // Mirror the update to the lyric window if it is open.
    if let Some(lyric) = app.get_webview_window("lyric") {
        let _ = lyric.emit("update-current-song", &data);
    }
    Ok(())
}

#[tauri::command(rename = "update-play-state")]
pub fn update_play_state(app: AppHandle, is_playing: bool) -> Result<(), String> {
    windows_smtc::set_playback_state(if is_playing {
        PlaybackState::Playing
    } else {
        PlaybackState::Paused
    });
    if let Some(lyric) = app.get_webview_window("lyric") {
        let _ = lyric.emit("update-play-state", is_playing);
    }
    Ok(())
}

#[tauri::command(rename = "set-content-zoom")]
pub fn set_content_zoom(
    window: WebviewWindow,
    state: tauri::State<'_, crate::commands::AppState>,
    zoom: f64,
) -> Result<(), String> {
    if !(0.25..=5.0).contains(&zoom) {
        return Err(format!("zoom {zoom} out of range"));
    }
    window.set_zoom(zoom).map_err(|e| e.to_string())?;
    *state.zoom.lock().map_err(|_| "zoom lock poisoned")? = zoom;
    Ok(())
}

#[tauri::command(rename = "get-content-zoom")]
pub fn get_content_zoom(state: tauri::State<'_, crate::commands::AppState>) -> Result<f64, String> {
    Ok(*state.zoom.lock().map_err(|_| "zoom lock poisoned")?)
}
