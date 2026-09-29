use std::sync::Mutex;
use lazy_static::lazy_static;
use souvlaki::{MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, PlatformConfig};
use tauri::{AppHandle, Emitter, Manager};
use raw_window_handle::HasRawWindowHandle;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlaybackState {
    Playing,
    Paused,
    Stopped,
}

#[derive(Debug, Clone, Default)]
pub struct NowPlaying {
    pub title: String,
    pub artist: String,
}

static NOW_PLAYING: Mutex<Option<NowPlaying>> = Mutex::new(None);
static PLAYBACK: Mutex<Option<PlaybackState>> = Mutex::new(None);

pub fn set_now_playing(title: String, artist: String) {
    if let Ok(mut slot) = NOW_PLAYING.lock() {
        *slot = Some(NowPlaying { title: title.clone(), artist: artist.clone() });
    }
    update_smtc();
}

pub fn set_playback_state(state: PlaybackState) {
    if let Ok(mut slot) = PLAYBACK.lock() {
        *slot = Some(state);
    }
    update_smtc();
}

pub fn now_playing() -> Option<NowPlaying> {
    NOW_PLAYING.lock().ok().and_then(|slot| slot.clone())
}

pub fn playback_state() -> Option<PlaybackState> {
    PLAYBACK.lock().ok().and_then(|slot| slot.clone())
}

pub fn display_line() -> Option<String> {
    let playing = now_playing()?;
    if playing.title.is_empty() {
        return None;
    }
    if playing.artist.is_empty() {
        Some(playing.title)
    } else {
        Some(format!("{} - {}", playing.title, playing.artist))
    }
}

lazy_static! {
    static ref CONTROLS: Mutex<Option<MediaControls>> = Mutex::new(None);
}

pub fn init_smtc(app: &AppHandle) {
    let hwnd = app.get_webview_window("main")
        .and_then(|w| w.hwnd().ok())
        .map(|h| h.0 as *mut std::ffi::c_void);

    let config = PlatformConfig {
        dbus_name: "chorus-deck",
        display_name: "Chorus Deck",
        hwnd,
    };

    if let Ok(mut controls) = MediaControls::new(config) {
        let app_handle = app.clone();
        let _ = controls.attach(move |event| {
            match event {
                MediaControlEvent::Play => {
                    let _ = app_handle.emit("mpris-play", ());
                }
                MediaControlEvent::Pause => {
                    let _ = app_handle.emit("mpris-pause", ());
                }
                MediaControlEvent::Next => {
                    let _ = app_handle.emit("mpris-next", ());
                }
                MediaControlEvent::Previous => {
                    let _ = app_handle.emit("mpris-previous", ());
                }
                _ => {}
            }
        });
        
        if let Ok(mut slot) = CONTROLS.lock() {
            *slot = Some(controls);
        }
    }
}

fn update_smtc() {
    if let Ok(mut slot) = CONTROLS.lock() {
        if let Some(controls) = slot.as_mut() {
            let np = now_playing().unwrap_or_default();
            let _ = controls.set_metadata(MediaMetadata {
                title: Some(&np.title),
                artist: Some(&np.artist),
                ..Default::default()
            });

            let state = playback_state().unwrap_or(PlaybackState::Stopped);
            let playback = match state {
                PlaybackState::Playing => MediaPlayback::Playing { progress: None },
                PlaybackState::Paused => MediaPlayback::Paused { progress: None },
                PlaybackState::Stopped => MediaPlayback::Stopped,
            };
            let _ = controls.set_playback(playback);
        }
    }
}
