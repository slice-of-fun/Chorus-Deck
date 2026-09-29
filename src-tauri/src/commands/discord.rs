use std::sync::Mutex;
use lazy_static::lazy_static;
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct DiscordPresence {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_art: Option<String>,
    pub song_id: Option<String>,
    pub artist_id: Option<String>,
    pub album_id: Option<String>,
    pub duration: Option<f64>,
    pub is_playing: Option<bool>,
    pub start_timestamp: Option<i64>,
}

lazy_static! {
    static ref DISCORD_CLIENT: Mutex<Option<DiscordIpcClient>> = Mutex::new(None);
    pub static ref CURRENT_PRESENCE: Mutex<Option<DiscordPresence>> = Mutex::new(None);
}

fn ensure_connection() -> bool {
    let mut client_lock = DISCORD_CLIENT.lock().unwrap();
    if client_lock.is_none() {
        let app_id = "1554131750899163186";
        let mut client = DiscordIpcClient::new(app_id);
        if client.connect().is_ok() {
            *client_lock = Some(client);
            return true;
        }
        return false;
    }
    true
}

#[tauri::command(rename = "update-discord-presence")]
pub fn update_discord_presence(presence: DiscordPresence) -> Result<(), String> {
    if !ensure_connection() {
        return Err("Failed to connect to Discord".to_string());
    }

    if let Ok(mut current) = CURRENT_PRESENCE.lock() {
        *current = Some(presence.clone());
    }

    update_discord_presence_internal(&presence)
}

pub fn set_discord_playing_state(is_playing: bool) {
    let presence_opt = {
        let mut current_lock = CURRENT_PRESENCE.lock().unwrap();
        if let Some(presence) = current_lock.as_mut() {
            presence.is_playing = Some(is_playing);
            Some(presence.clone())
        } else {
            None
        }
    };

    if let Some(presence) = presence_opt {
        let _ = update_discord_presence_internal(&presence);
    }
}

pub fn update_discord_presence_internal(presence: &DiscordPresence) -> Result<(), String> {
    if let Ok(mut client_lock) = DISCORD_CLIENT.lock() {
        if let Some(client) = client_lock.as_mut() {
            let mut assets = activity::Assets::new();
            
            if let Some(ref album_art) = presence.album_art {
                assets = assets.large_image(album_art);
            } else {
                assets = assets.large_image("chorus_logo"); // Default fallback
            }
            
            if let Some(ref album) = presence.album {
                assets = assets.large_text(album);
            }
            
            let is_playing = presence.is_playing.unwrap_or(false);
            if is_playing {
                assets = assets.small_image("play_icon");
                assets = assets.small_text("Playing");
            } else {
                assets = assets.small_image("pause_icon");
                assets = assets.small_text("Paused");
            }

            let mut act = activity::Activity::new().assets(assets);

            if let Some(ref title) = presence.title {
                act = act.details(title);
            }
            if let Some(ref artist) = presence.artist {
                act = act.state(artist);
            }

            if is_playing {
                if let Some(start) = presence.start_timestamp {
                    // Start timestamp is in milliseconds in JS, Discord expects seconds for the epoch
                    let start_secs = start / 1000;
                    let timestamps = activity::Timestamps::new().start(start_secs);
                    act = act.timestamps(timestamps);
                }
            }

            let _ = client.set_activity(act);
        }
    }
    Ok(())
}

#[tauri::command(rename = "clear-discord-presence")]
pub fn clear_discord_presence() -> Result<(), String> {
    if let Ok(mut current) = CURRENT_PRESENCE.lock() {
        *current = None;
    }
    if let Ok(mut client_lock) = DISCORD_CLIENT.lock() {
        if let Some(client) = client_lock.as_mut() {
            let _ = client.clear_activity();
        }
    }
    Ok(())
}

#[tauri::command(rename = "discord-logout")]
pub fn discord_logout() -> Result<(), String> {
    if let Ok(mut client_lock) = DISCORD_CLIENT.lock() {
        if let Some(mut client) = client_lock.take() {
            let _ = client.close();
        }
    }
    Ok(())
}

#[derive(Serialize)]
pub struct DiscordUserInfo {
    pub token: String,
    pub username: Option<String>,
    pub name: Option<String>,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
}

#[tauri::command(rename = "discord-webview-login")]
pub fn discord_webview_login() -> Result<Option<DiscordUserInfo>, String> {
    // Returning an error here matches the frontend's handling of closed window before login.
    // We would implement the OAuth flow inside a Tauri window here later.
    Err("Window closed before login".to_string())
}
