use std::sync::Mutex;

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
        *slot = Some(NowPlaying { title, artist });
    }
}

pub fn set_playback_state(state: PlaybackState) {
    if let Ok(mut slot) = PLAYBACK.lock() {
        *slot = Some(state);
    }
}

pub fn now_playing() -> Option<NowPlaying> {
    NOW_PLAYING.lock().ok().and_then(|slot| slot.clone())
}

pub fn playback_state() -> Option<PlaybackState> {
    PLAYBACK.lock().ok().and_then(|slot| slot.clone())
}

/// Text for the tray tooltip / SMTC display.
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

#[cfg(windows)]
pub struct SmtcSession;

#[cfg(windows)]
impl SmtcSession {
    pub fn new() -> Result<Self, String> {
        Err("SMTC session is not implemented yet".to_string())
    }

    pub fn update(&self, _np: &NowPlaying, _state: PlaybackState) -> Result<(), String> {
        Err("SMTC session is not implemented yet".to_string())
    }
}
