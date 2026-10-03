use serde::{Deserialize, Serialize};
use std::sync::Mutex;

pub const APP_ICON_URL: &str =
    "https://raw.githubusercontent.com/slice-of-fun/Chorus-Deck/main/resources/logo.png";

#[derive(Debug, Deserialize, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct DiscordPresence {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_art: Option<String>,
    pub artist_art: Option<String>,
    pub song_id: Option<String>,
    pub artist_id: Option<String>,
    pub album_id: Option<String>,
    pub duration: Option<f64>,
    pub is_playing: Option<bool>,
    pub start_timestamp: Option<i64>,
    pub activity_name: Option<String>,    
    pub activity_details: Option<String>, 
    pub activity_state: Option<String>,  
    pub activity_type: Option<String>,    
    pub large_image_type: Option<String>, 
    pub large_image_custom_url: Option<String>,
    pub small_image_type: Option<String>, 
    pub small_image_custom_url: Option<String>,
    pub show_when_paused: Option<bool>,
    pub button1_enabled: Option<bool>,
    pub button1_label: Option<String>,
    pub button1_url: Option<String>,
    pub button2_enabled: Option<bool>,
    pub button2_label: Option<String>,
    pub button2_url: Option<String>,
    pub token: Option<String>,
}

lazy_static::lazy_static! {
    pub static ref CURRENT_PRESENCE: Mutex<Option<DiscordPresence>> = Mutex::new(None);
}

pub fn resolve_source_text(source: &str, presence: &DiscordPresence) -> Option<String> {
    match source.to_uppercase().as_str() {
        "SONG" => presence.title.clone(),
        "ARTIST" => presence.artist.clone(),
        "ALBUM" => presence.album.clone(),
        "APP" => Some("Chorus Deck".to_string()),
        "NONE" | "DONTSHOW" => None,
        _ => None,
    }
}

pub fn resolve_image_url(image_type: &str, custom_url: Option<&str>, presence: &DiscordPresence) -> Option<String> {
    match image_type.to_lowercase().as_str() {
        "thumbnail" | "song" | "album" => {
            presence.album_art.clone().filter(|u| u.starts_with("http"))
        }
        "artist" => {
            presence.artist_art.clone()
                .filter(|u| u.starts_with("http"))
                .or_else(|| presence.album_art.clone().filter(|u| u.starts_with("http")))
        }
        "appicon" | "app" => Some(APP_ICON_URL.to_string()),
        "custom" => {
            custom_url
                .filter(|u| !u.is_empty())
                .map(|u| u.to_string())
                .filter(|u| u.starts_with("http"))
        }
        "dontshow" | "none" => None,
        _ => presence.album_art.clone().filter(|u| u.starts_with("http")),
    }
}
pub fn to_discord_text(value: Option<String>, max_len: usize, fallback: Option<&str>) -> Option<String> {
    let text = value
        .unwrap_or_default()
        .trim()
        .to_string();
    let text = if text.is_empty() {
        fallback.unwrap_or("").trim().to_string()
    } else {
        text
    };
    if text.is_empty() {
        None
    } else {
        Some(text.chars().take(max_len).collect())
    }
}

#[tauri::command(rename = "update-discord-presence")]
pub async fn update_discord_presence(presence: DiscordPresence) -> Result<(), String> {
    let is_playing = presence.is_playing.unwrap_or(false);
    let show_when_paused = presence.show_when_paused.unwrap_or(false);
    if !is_playing && !show_when_paused {
        return clear_discord_presence();
    }

    if let Ok(mut current) = CURRENT_PRESENCE.lock() {
        *current = Some(presence.clone());
    }

    // Gateway-only, like Chorus-Music: without a token there is no presence.
    let token = match presence.token.clone().filter(|t| !t.trim().is_empty()) {
        Some(token) => token,
        None => return clear_discord_presence(),
    };

    crate::commands::discord_gateway::update_presence_acked(presence, token).await
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
        if let Some(token) = presence.token.clone().filter(|t| !t.trim().is_empty()) {
            crate::commands::discord_gateway::update_presence(presence, token);
        } else {
            let _ = clear_discord_presence();
        }
    }
}

#[tauri::command(rename = "clear-discord-presence")]
pub fn clear_discord_presence() -> Result<(), String> {
    if let Ok(mut current) = CURRENT_PRESENCE.lock() {
        *current = None;
    }
    crate::commands::discord_gateway::clear_presence();
    Ok(())
}

#[tauri::command(rename = "discord-logout")]
pub fn discord_logout() -> Result<(), String> {
    if let Ok(mut current) = CURRENT_PRESENCE.lock() {
        *current = None;
    }
    crate::commands::discord_gateway::disconnect();
    Ok(())
}

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use sha2::{Digest, Sha256};

const DISCORD_APP_ID: &str = "1554131750899163186";
const DISCORD_REDIRECT_URI: &str = "http://localhost:7878/callback";
const DISCORD_AUTH_ENDPOINT: &str = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_ENDPOINT: &str = "https://discord.com/api/oauth2/token";
const DISCORD_USER_ENDPOINT: &str = "https://discord.com/api/v10/users/@me";

fn random_url_safe(byte_count: usize) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    use std::time::{SystemTime, UNIX_EPOCH};

    let mut data = Vec::with_capacity(byte_count);
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let mut h = DefaultHasher::new();
    seed.hash(&mut h);
    std::thread::current().id().hash(&mut h);
    let mut state = h.finish();
    while data.len() < byte_count {
        state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        data.extend_from_slice(&state.to_le_bytes());
    }
    data.truncate(byte_count);
    URL_SAFE_NO_PAD.encode(&data)
}

fn sha256_base64url(value: &str) -> String {
    let digest = Sha256::digest(value.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

#[derive(Serialize)]
pub struct DiscordUserInfo {
    pub token: String,
    pub username: Option<String>,
    pub name: Option<String>,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
    #[serde(rename = "refreshToken")]
    pub refresh_token: Option<String>,
    #[serde(rename = "expiresIn")]
    pub expires_in: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordTokenRefresh {
    pub token: String,
    #[serde(rename = "refreshToken")]
    pub refresh_token: Option<String>,
    #[serde(rename = "expiresIn")]
    pub expires_in: Option<i64>,
}

fn build_avatar_url(user_id: &str, avatar_hash: Option<&str>, discriminator: Option<&str>) -> Option<String> {
    if user_id.is_empty() {
        return None;
    }
    if let Some(hash) = avatar_hash.filter(|h| !h.is_empty()) {
        let ext = if hash.starts_with("a_") { "gif" } else { "png" };
        return Some(format!(
            "https://cdn.discordapp.com/avatars/{}/{}.{}?size=256",
            user_id, hash, ext
        ));
    }
    let default_index = discriminator
        .and_then(|d| d.parse::<u64>().ok())
        .filter(|&d| d > 0)
        .map(|d| (d % 5) as u64)
        .or_else(|| {
            user_id.parse::<u64>().ok().map(|id| (id >> 22) % 6)
        })
        .unwrap_or(0);
    Some(format!(
        "https://cdn.discordapp.com/embed/avatars/{}.png",
        default_index
    ))
}

#[tauri::command(rename = "discord-webview-login")]
pub async fn discord_webview_login(app: tauri::AppHandle) -> Result<Option<DiscordUserInfo>, String> {
    use tauri_plugin_opener::OpenerExt;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    // 1. PKCE
    let verifier = random_url_safe(64);
    let challenge = sha256_base64url(&verifier);
    let state = random_url_safe(32);

    // 2. Build authorization URL (openid + identify scopes — same as DiscordOAuthRepository.kt)
    let scopes = urlencoding::encode("openid identify");
    let redirect_encoded = urlencoding::encode(DISCORD_REDIRECT_URI);
    let auth_url = format!(
        "{}?client_id={}&response_type=code&redirect_uri={}&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
        DISCORD_AUTH_ENDPOINT, DISCORD_APP_ID, redirect_encoded, scopes, state, challenge
    );

    // 3. Bind local listener before opening browser
    let listener = TcpListener::bind("127.0.0.1:7878")
        .await
        .map_err(|e| format!("Failed to bind localhost:7878: {}", e))?;

    app.opener()
        .open_url(&auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    // 4. Wait for the redirect callback
    let accept_result = tokio::time::timeout(std::time::Duration::from_secs(120), listener.accept()).await;
    let (mut socket, _) = match accept_result {
        Ok(Ok(res)) => res,
        Ok(Err(e)) => return Err(format!("Failed to accept callback: {}", e)),
        Err(_) => return Err("Window closed before login".to_string()),
    };

    let mut buf = [0u8; 4096];
    socket.read(&mut buf).await.map_err(|e| e.to_string())?;

    let request = String::from_utf8_lossy(&buf[..]);
    let first_line = request.lines().next().unwrap_or("");

    // Parse ?code=...&state=... from the GET path
    let mut code = String::new();
    let mut returned_state = String::new();
    if first_line.starts_with("GET ") {
        let parts: Vec<&str> = first_line.split_whitespace().collect();
        if parts.len() >= 2 {
            if let Some(query) = parts[1].split('?').nth(1) {
                for kv in query.split('&') {
                    let mut it = kv.splitn(2, '=');
                    match (it.next(), it.next()) {
                        (Some("code"), Some(v)) => code = v.to_string(),
                        (Some("state"), Some(v)) => returned_state = v.to_string(),
                        _ => {}
                    }
                }
            }
        }
    }

    // Send HTTP 200 response so the browser tab closes cleanly
    let html_response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 72\r\n\r\n<html><body><h2>Logged in! You can close this tab.</h2></body></html>";
    let _ = socket.write_all(html_response.as_bytes()).await;
    drop(socket);

    if code.is_empty() {
        return Err("Discord authorization code missing from callback".to_string());
    }
    if returned_state != state {
        return Err("Discord OAuth state mismatch — possible CSRF".to_string());
    }

    // 5. Exchange code for token — POST /api/oauth2/token with PKCE verifier
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    let token_params = [
        ("client_id", DISCORD_APP_ID),
        ("grant_type", "authorization_code"),
        ("code", code.as_str()),
        ("redirect_uri", DISCORD_REDIRECT_URI),
        ("code_verifier", verifier.as_str()),
    ];

    let token_res = client
        .post(DISCORD_TOKEN_ENDPOINT)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .header("Accept", "application/json")
        .form(&token_params)
        .send()
        .await
        .map_err(|e| format!("Token exchange request failed: {}", e))?;

    if !token_res.status().is_success() {
        let status = token_res.status();
        let body = token_res.text().await.unwrap_or_default();
        return Err(format!("Discord token exchange failed ({}): {}", status, body));
    }

    let token_json: serde_json::Value = token_res
        .json()
        .await
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    let access_token = token_json
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "No access_token in Discord response".to_string())?
        .to_string();

    // 6. Fetch user info — GET /api/v10/users/@me
    let user_res = client
        .get(DISCORD_USER_ENDPOINT)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("User info request failed: {}", e))?;

    if !user_res.status().is_success() {
        let status = user_res.status();
        let body = user_res.text().await.unwrap_or_default();
        return Err(format!("Discord user info fetch failed ({}): {}", status, body));
    }

    let user_json: serde_json::Value = user_res
        .json()
        .await
        .map_err(|e| format!("Failed to parse user info: {}", e))?;

    // Parse fields exactly as DiscordOAuthRepository.kt does
    let user_id = user_json.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let username = user_json
        .get("username")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let global_name = user_json
        .get("global_name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let avatar_hash = user_json.get("avatar").and_then(|v| v.as_str());
    let discriminator = user_json.get("discriminator").and_then(|v| v.as_str());

    let display_name = global_name
        .clone()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| username.clone());

    let avatar_url = build_avatar_url(&user_id, avatar_hash, discriminator);

    let refresh_token = token_json
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let expires_in = token_json
        .get("expires_in")
        .and_then(|v| v.as_i64());

    Ok(Some(DiscordUserInfo {
        token: access_token,
        username: if username.is_empty() { None } else { Some(username) },
        name: if display_name.is_empty() { None } else { Some(display_name) },
        avatar_url,
        refresh_token,
        expires_in,
    }))
}

/// Mirrors DiscordOAuthRepository.getValidAccessToken()/refreshAccessToken() from Chorus-Music:
/// exchanges a refresh token for a fresh access token before gateway connect.
#[tauri::command(rename = "discord-refresh-token")]
pub async fn discord_refresh_token(refresh_token: String) -> Result<DiscordTokenRefresh, String> {
    let refresh_token = refresh_token.trim().to_string();
    if refresh_token.is_empty() {
        return Err("Discord refresh token is missing".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let params = [
        ("client_id", DISCORD_APP_ID),
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token.as_str()),
    ];

    let res = client
        .post(DISCORD_TOKEN_ENDPOINT)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .header("Accept", "application/json")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Token refresh request failed: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Discord token refresh failed ({}): {}", status, body));
    }

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse token refresh response: {}", e))?;

    let access_token = json
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Discord token refresh returned no access_token".to_string())?
        .to_string();

    Ok(DiscordTokenRefresh {
        token: access_token,
        refresh_token: json
            .get("refresh_token")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        expires_in: json.get("expires_in").and_then(|v| v.as_i64()),
    })
}
