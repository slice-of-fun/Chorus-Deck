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

const DISCORD_APP_ID: &str = "1554131750899163186";
const DISCORD_TOKEN_ENDPOINT: &str = "https://discord.com/api/oauth2/token";
const DISCORD_USER_ENDPOINT: &str = "https://discord.com/api/v10/users/@me";

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

/// Best-effort account lookup for a token. Mirrors DiscordOAuthRepository.getJson():
/// account tokens (which contain '.') are sent raw, everything else with a
/// Bearer prefix; if the preferred form is rejected, the other is tried.
/// Fails soft — presence works even when the lookup does not.
async fn fetch_discord_user(token: &str) -> Result<DiscordUserInfo, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    let raw_first = token.contains('.');
    let attempts: [String; 2] = if raw_first {
        [token.to_string(), format!("Bearer {}", token)]
    } else {
        [format!("Bearer {}", token), token.to_string()]
    };

    let mut last_error = String::new();
    for auth in attempts {
        let response = match client
            .get(DISCORD_USER_ENDPOINT)
            .header("Authorization", &auth)
            .header("Accept", "application/json")
            .send()
            .await
        {
            Ok(res) => res,
            Err(e) => {
                last_error = e.to_string();
                continue;
            }
        };

        let status = response.status();
        if !status.is_success() {
            last_error = format!("HTTP {}", status);
            continue;
        }

        let user_json: serde_json::Value = match response.json().await {
            Ok(json) => json,
            Err(e) => {
                last_error = e.to_string();
                continue;
            }
        };

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
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| username.clone());

        let avatar_url = build_avatar_url(&user_id, avatar_hash, discriminator);

        return Ok(DiscordUserInfo {
            token: token.to_string(),
            username: if username.is_empty() { None } else { Some(username) },
            name: if display_name.is_empty() { None } else { Some(display_name) },
            avatar_url,
            refresh_token: None,
            expires_in: None,
        });
    }

    Err(format!("Discord account lookup failed ({})", last_error))
}

/// Chorus-Music-style login: open an embedded webview on discord.com/login,
/// let the user sign in, then extract the account token from localStorage
/// (same key DiscordTokenWebView.kt reads) and hand it back to the app.
/// The account token is what the gateway IDENTIFY accepts — OAuth access
/// tokens are rejected with close code 4004.
#[tauri::command(rename = "discord-webview-login")]
pub async fn discord_webview_login(app: tauri::AppHandle) -> Result<Option<DiscordUserInfo>, String> {
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Arc;
    use tauri::Manager;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    if let Some(existing) = app.get_webview_window("discord-login") {
        let _ = existing.set_focus();
        return Err("A Discord login window is already open".to_string());
    }

    let listener = TcpListener::bind("127.0.0.1:7878")
        .await
        .map_err(|e| format!("Failed to bind localhost:7878: {}", e))?;

    let login_url = "https://discord.com/login"
        .parse()
        .map_err(|e| format!("Invalid login URL: {}", e))?;
    let init_script = r#"
        window.__chorus_discord_token = null;
        const origFetch = window.fetch;
        window.fetch = async function() {
            const req = arguments[0];
            const options = arguments[1];
            if (options && options.headers) {
                let auth = null;
                if (options.headers instanceof Headers) {
                    auth = options.headers.get('Authorization');
                } else if (typeof options.headers === 'object') {
                    auth = options.headers['Authorization'] || options.headers['authorization'];
                }
                if (auth && auth !== 'undefined' && auth !== 'null') {
                    window.__chorus_discord_token = auth;
                }
            }
            return origFetch.apply(this, arguments);
        };
        const origSetRequestHeader = window.XMLHttpRequest.prototype.setRequestHeader;
        window.XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
            if (header.toLowerCase() === 'authorization' && value && value !== 'undefined' && value !== 'null') {
                window.__chorus_discord_token = value;
            }
            return origSetRequestHeader.apply(this, arguments);
        };
    "#;

    let window = tauri::WebviewWindowBuilder::new(
        &app,
        "discord-login",
        tauri::WebviewUrl::External(login_url),
    )
    .title("Login to Discord")
    .inner_size(560.0, 740.0)
    .min_inner_size(420.0, 520.0)
    .center()
    .resizable(true)
    .initialization_script(init_script)
    .build()
    .map_err(|e| format!("Failed to open login window: {}", e))?;

    // Poll the page for the account token in localStorage.
    let eval_failures = Arc::new(AtomicU32::new(0));
    {
        let failures = eval_failures.clone();
        let poll_window = window.clone();
        tauri::async_runtime::spawn(async move {
            let script = r#"(function(){try{var t=window.__chorus_discord_token||localStorage.getItem('token');if(!t)return;t=t.replace(/['"]/g,'');if(t.length<20||window.__chorusTokenSent)return;window.__chorusTokenSent=true;location.href='http://127.0.0.1:7878/token?t='+encodeURIComponent(t);}catch(e){}})();"#;
            let mut consecutive = 0u32;
            loop {
                tokio::time::sleep(std::time::Duration::from_millis(1200)).await;
                match poll_window.eval(script) {
                    Ok(()) => {
                        consecutive = 0;
                        failures.store(0, Ordering::SeqCst);
                    }
                    Err(_) => {
                        consecutive += 1;
                        failures.store(consecutive, Ordering::SeqCst);
                        if consecutive >= 3 {
                            break;
                        }
                    }
                }
            }
        });
    }

    // Wait for the token hand-off (or cancellation via window close).
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(300);
    let token = loop {
        if eval_failures.load(Ordering::SeqCst) >= 3 {
            return Err("Window closed before login".to_string());
        }
        if tokio::time::Instant::now() >= deadline {
            let _ = window.close();
            return Err("Window closed before login".to_string());
        }

        match tokio::time::timeout(std::time::Duration::from_millis(250), listener.accept()).await {
            Ok(Ok((mut socket, _))) => {
                let mut buf = [0u8; 8192];
                let n = socket.read(&mut buf).await.unwrap_or(0);
                let request = String::from_utf8_lossy(&buf[..n]);
                let mut token_found: Option<String> = None;

                if let Some(first_line) = request.lines().next() {
                    if first_line.starts_with("GET ") {
                        if let Some(target) = first_line.split_whitespace().nth(1) {
                            if let Some(query) = target.split('?').nth(1) {
                                for kv in query.split('&') {
                                    let mut parts = kv.splitn(2, '=');
                                    if let (Some(key), Some(value)) = (parts.next(), parts.next()) {
                                        if key == "t" {
                                            if let Ok(decoded) = urlencoding::decode(value) {
                                                let clean = decoded.trim().trim_matches('"').to_string();
                                                if clean.len() >= 20 {
                                                    token_found = Some(clean);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                let html = match &token_found {
                    Some(_) => "<html><body style=\"font-family:system-ui,sans-serif;text-align:center;margin-top:90px\"><h2>Connected!</h2><p>You can close this window.</p></body></html>",
                    None => "<html><body style=\"font-family:system-ui,sans-serif;text-align:center;margin-top:90px\"><p>Waiting for Discord login\u{2026}</p></body></html>",
                };
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    html.len(),
                    html
                );
                let _ = socket.write_all(response.as_bytes()).await;
                drop(socket);

                if let Some(found) = token_found {
                    break found;
                }
            }
            Ok(Err(_)) => {}
            Err(_) => {}
        }
    };

    // Account lookup is best-effort (Chorus-Music tolerates it failing too).
    let user_info = fetch_discord_user(&token).await.unwrap_or_else(|_| DiscordUserInfo {
        token: token.clone(),
        username: None,
        name: None,
        avatar_url: None,
        refresh_token: None,
        expires_in: None,
    });
    let _ = window.close();
    Ok(Some(user_info))
}

/// Exchanges a refresh token for a fresh access token before gateway connect.
/// Account tokens (Webview login) do not expire, so this is only used when an
/// OAuth session with an expiry is present.
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
