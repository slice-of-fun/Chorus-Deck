use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateState {
    pub status: String,
    #[serde(default)]
    pub current_version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub available_version: Option<String>,
    #[serde(default)]
    pub progress: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(default)]
    pub manual: bool,
}

impl Default for AppUpdateState {
    fn default() -> Self {
        AppUpdateState {
            status: "idle".to_string(),
            current_version: env!("CARGO_PKG_VERSION").to_string(),
            available_version: None,
            progress: 0.0,
            error: None,
            manual: false,
        }
    }
}

const UPDATE_CHANNEL: &str = "app-update:state";

fn publish(app: &AppHandle, state: &AppUpdateState) {
    let _ = app.emit(UPDATE_CHANNEL, state);
}

#[tauri::command(rename = "app-update:get-state")]
pub fn app_update_get_state(app: AppHandle) -> AppUpdateState {
    let state = AppUpdateState::default();
    publish(&app, &state);
    state
}

#[tauri::command(rename = "app-update:check")]
pub fn app_update_check(app: AppHandle, manual: bool) -> AppUpdateState {
    let mut state = AppUpdateState::default();
    state.manual = manual;
    state.status = "idle".to_string();
    publish(&app, &state);
    state
}

#[tauri::command(rename = "app-update:download")]
pub fn app_update_download(app: AppHandle) -> AppUpdateState {
    let mut state = AppUpdateState::default();
    state.status = "unavailable".to_string();
    state.error = Some("in-app updates are not wired up in the Tauri build".to_string());
    publish(&app, &state);
    state
}

#[tauri::command(rename = "app-update:quit-and-install")]
pub fn app_update_quit_and_install() -> Result<bool, String> {
    Ok(false)
}

#[tauri::command(rename = "app-update:open-release-page")]
pub fn app_update_open_release_page(app: AppHandle) -> Result<bool, String> {
    use tauri_plugin_opener::OpenerExt;

    let url = format!(
        "https://github.com/ChorusDeck/Chorus-Deck/releases/latest?app={}",
        app.package_info().name
    );
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())?;
    Ok(true)
}

use hmac::{Hmac, Mac};
use reqwest::header::{
    HeaderMap, HeaderValue, ACCEPT_LANGUAGE, AUTHORIZATION, CONTENT_TYPE, COOKIE, ORIGIN, REFERER,
    USER_AGENT,
};
use sha1::{Digest, Sha1};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha1 = Hmac<Sha1>;

const BOOTSTRAP_USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

static VISITOR_DATA: OnceLock<Mutex<Option<(String, SystemTime)>>> = OnceLock::new();

const VISITOR_DATA_MAX_AGE: std::time::Duration =
    std::time::Duration::from_secs(60 * 60 * 12);

fn visitor_cache() -> &'static Mutex<Option<(String, SystemTime)>> {
    VISITOR_DATA.get_or_init(|| Mutex::new(None))
}

async fn get_visitor_data(client: &reqwest::Client) -> Option<String> {
    if let Ok(guard) = visitor_cache().lock() {
        if let Some((value, fetched_at)) = guard.as_ref() {
            let fresh = SystemTime::now()
                .duration_since(*fetched_at)
                .map(|age| age < VISITOR_DATA_MAX_AGE)
                .unwrap_or(false);
            if fresh {
                return Some(value.clone());
            }
        }
    }

    let html = client
        .get("https://www.youtube.com/")
        .header(USER_AGENT, BOOTSTRAP_USER_AGENT)
        .header(ACCEPT_LANGUAGE, "en-US,en;q=0.9")
        .send()
        .await
        .ok()?
        .text()
        .await
        .ok()?;

    let value = html
        .split("\"visitorData\":\"")
        .nth(1)
        .and_then(|rest| rest.split('"').next())
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string())?;

    if let Ok(mut guard) = visitor_cache().lock() {
        *guard = Some((value.clone(), SystemTime::now()));
    }

    Some(value)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YtmRequestArgs {
    pub endpoint: String,
    pub body: Value,
    pub cookie: Option<String>,
    pub client_name_id: Option<u32>,
    pub client_version: Option<String>,
    pub user_agent: Option<String>,
    pub host: Option<String>,
}

#[tauri::command(rename = "ytm:request")]
pub async fn ytm_request(args: YtmRequestArgs) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let visitor = get_visitor_data(&client).await;
    let is_music = args.host.as_deref() != Some("youtube");
    let origin = if is_music {
        "https://music.youtube.com"
    } else {
        "https://www.youtube.com"
    };
    let url = format!(
        "{}/youtubei/v1/{}?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-KZBW_4qT8&prettyPrint=false",
        origin, args.endpoint
    );

    let desktop_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    let user_agent = args.user_agent.as_deref().unwrap_or(desktop_ua);
    headers.insert(
        USER_AGENT,
        HeaderValue::from_str(user_agent).map_err(|e| e.to_string())?,
    );
    headers.insert(
        ORIGIN,
        HeaderValue::from_str(origin).map_err(|e| e.to_string())?,
    );
    headers.insert(
        REFERER,
        HeaderValue::from_str(&format!("{}/", origin)).map_err(|e| e.to_string())?,
    );

    let client_name_id = args.client_name_id.unwrap_or(67).to_string();
    headers.insert(
        "X-YouTube-Client-Name",
        HeaderValue::from_str(&client_name_id).unwrap(),
    );

    let client_version = args
        .client_version
        .unwrap_or_else(|| "1.20241121.01.00".to_string());
    headers.insert(
        "X-YouTube-Client-Version",
        HeaderValue::from_str(&client_version).unwrap(),
    );

    match visitor.as_deref().and_then(|v| HeaderValue::from_str(v).ok()) {
        Some(v_val) => {
            headers.insert("X-Goog-Visitor-Id", v_val);
        }
        None => {
            headers.insert("X-Goog-Visitor-Id", HeaderValue::from_static(""));
        }
    }
    headers.insert(ACCEPT_LANGUAGE, HeaderValue::from_static("en-US,en;q=0.9"));

    if let Some(c) = args.cookie {
        if let Ok(c_val) = HeaderValue::from_str(&c) {
            headers.insert(COOKIE, c_val);
        }

        if let Some(sapisid) = c.split(';').find(|s| s.trim().starts_with("SAPISID=")) {
            let sapisid = sapisid.trim().trim_start_matches("SAPISID=");
            let ts = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            let input = format!("{} {} {}", ts, sapisid, origin);
            let hash = hex::encode(Sha1::digest(input.as_bytes()));
            if let Ok(auth_val) = HeaderValue::from_str(&format!("SAPISIDHASH {}_{}", ts, hash)) {
                headers.insert(AUTHORIZATION, auth_val);
            }
        }
    }

    let mut payload = args.body.clone();
    if let Value::Object(ref mut map) = payload {
        if !map.contains_key("context") {
            map.insert(
                "context".to_string(),
                json!({
                    "client": {
                        "clientName": "WEB_REMIX",
                        "clientVersion": "1.20241121.01.00",
                        "hl": "en",
                        "gl": "US",
                        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                        "timeZone": "UTC",
                        "utcOffsetMinutes": 0
                    }
                }),
            );
        }
        if let Some(context) = map.get_mut("context").and_then(|c| c.as_object_mut()) {
            if let Some(client) = context.get_mut("client").and_then(|c| c.as_object_mut()) {
                if let Some(v) = &visitor {
                    client.insert("visitorData".to_string(), json!(v));
                }
            }
        }
    } else {
        payload = json!({
            "context": {
                "client": {
                    "clientName": "WEB_REMIX",
                    "clientVersion": "1.20241121.01.00",
                    "hl": "en",
                    "gl": "US",
                    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                    "timeZone": "UTC",
                    "utcOffsetMinutes": 0,
                    "visitorData": visitor.unwrap_or_default()
                }
            }
        });
    }

    let res = client
        .post(&url)
        .headers(headers)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("YTM API error: {}", res.status()));
    }

    res.json::<Value>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

#[derive(serde::Deserialize)]
pub struct YtmValidateStreamArgs {
    pub url: String,
    pub user_agent: Option<String>,
}

#[derive(serde::Serialize)]
pub struct YtmStreamProbe {
    pub playable: bool,
    pub status: u16,
    pub reason: Option<String>,
}

#[tauri::command(rename = "ytm:validate-stream")]
pub async fn ytm_validate_stream(args: YtmValidateStreamArgs) -> Result<YtmStreamProbe, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let ua = args.user_agent.clone();
    let with_ua = |req: reqwest::RequestBuilder| match ua.as_deref() {
        Some(ua) if !ua.is_empty() => req.header(reqwest::header::USER_AGENT, ua),
        _ => req,
    };

    let head = match with_ua(client.get(&args.url).header("Range", "bytes=0-1"))
        .send()
        .await
    {
        Ok(res) => res,
        Err(e) => {
            return Ok(YtmStreamProbe {
                playable: false,
                status: 0,
                reason: Some(format!("probe request failed: {e}")),
            })
        }
    };

    let status = head.status();
    if !status.is_success() {
        return Ok(YtmStreamProbe {
            playable: false,
            status: status.as_u16(),
            reason: Some(format!("media CDN returned {status}")),
        });
    }

    let total = head
        .headers()
        .get(reqwest::header::CONTENT_RANGE)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.rsplit('/').next())
        .and_then(|v| v.trim().parse::<u64>().ok());

    if let Some(total) = total.filter(|total| *total > 1) {
        let tail = total - 1;
        let tail_request = with_ua(
            client
                .get(&args.url)
                .header(reqwest::header::RANGE, format!("bytes={tail}-{tail}")),
        )
        .send()
        .await;

        match tail_request {
            Ok(res) if res.status().is_success() => {}
            Ok(res) => {
                let status = res.status();
                return Ok(YtmStreamProbe {
                    playable: false,
                    status: status.as_u16(),
                    reason: Some(format!(
                        "media CDN served the head but refused byte {tail} of {total} with {status}; \
                         the URL stops before the end of the file"
                    )),
                });
            }
            Err(e) => {
                return Ok(YtmStreamProbe {
                    playable: false,
                    status: 0,
                    reason: Some(format!("tail probe request failed: {e}")),
                });
            }
        }
    }

    Ok(YtmStreamProbe {
        playable: true,
        status: status.as_u16(),
        reason: None,
    })
}

use tokio::io::{AsyncReadExt, AsyncWriteExt};

use tokio::net::TcpListener;

#[tauri::command(rename = "integrations:spotify-login")]
pub async fn spotify_login(app: AppHandle, client_id: String) -> Result<String, String> {
    use tauri_plugin_opener::OpenerExt;

    let listener = TcpListener::bind("127.0.0.1:8888")
        .await
        .map_err(|e| format!("Failed to bind local server: {}", e))?;

    let redirect_uri = "http://localhost:8888/callback";
    let scope = "user-library-read playlist-read-private playlist-read-collaborative";

    let auth_url = format!(
        "https://accounts.spotify.com/authorize?client_id={}&response_type=code&redirect_uri={}&scope={}",
        client_id,
        urlencoding::encode(redirect_uri),
        urlencoding::encode(scope)
    );

    app.opener()
        .open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    let (mut socket, _) = listener
        .accept()
        .await
        .map_err(|e| format!("Failed to accept connection: {}", e))?;

    let mut buffer = [0; 1024];
    socket.read(&mut buffer).await.map_err(|e| e.to_string())?;

    let request = String::from_utf8_lossy(&buffer[..]);

    let first_line = request.lines().next().unwrap_or("");
    let mut code = String::new();

    if first_line.starts_with("GET ") {
        let parts: Vec<&str> = first_line.split_whitespace().collect();
        if parts.len() >= 2 {
            let path = parts[1];
            if let Some(query_str) = path.split('?').nth(1) {
                for param in query_str.split('&') {
                    let mut kv = param.split('=');
                    if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
                        if k == "code" {
                            code = v.to_string();
                            break;
                        }
                    }
                }
            }
        }
    }

    let response = "HTTP/1.1 200 OK\r\nContent-Length: 54\r\n\r\n<html><body>You can close this window now.</body></html>";
    let _ = socket.write_all(response.as_bytes()).await;

    if code.is_empty() {
        return Err("Failed to extract authorization code from callback".to_string());
    }

    Ok(code)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpotifyTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub scope: String,
    pub expires_in: i32,
    pub refresh_token: Option<String>,
}

#[tauri::command(rename = "integrations:spotify-exchange-token")]
pub async fn spotify_exchange_token(
    code: String,
    client_id: String,
    client_secret: String,
) -> Result<SpotifyTokenResponse, String> {
    let client = reqwest::Client::new();
    let redirect_uri = "http://localhost:8888/callback";

    let params = [
        ("grant_type", "authorization_code"),
        ("code", &code),
        ("redirect_uri", redirect_uri),
    ];

    let res = client
        .post("https://accounts.spotify.com/api/token")
        .basic_auth(client_id, Some(client_secret))
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Spotify API error: {}", err_text));
    }

    res.json::<SpotifyTokenResponse>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

#[tauri::command(rename = "integrations:spotify-fetch-playlists")]
pub async fn spotify_fetch_playlists(access_token: String) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://api.spotify.com/v1/me/playlists")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Spotify API error: {}", err_text));
    }

    res.json::<Value>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

#[tauri::command(rename = "integrations:spotify-fetch-playlist-tracks")]
pub async fn spotify_fetch_playlist_tracks(
    access_token: String,
    playlist_id: String,
    offset: u32,
    limit: u32,
) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://api.spotify.com/v1/playlists/{}/tracks?offset={}&limit={}",
        playlist_id, offset, limit
    );

    let res = client
        .get(&url)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Spotify API error: {}", err_text));
    }

    res.json::<Value>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

async fn get_spotify_anonymous_token() -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let nuance_url =
        "https://gist.githubusercontent.com/sonic-liberation/22ed9c6ba463899e933427f7de1f0eef/raw/";
    let nuances: Vec<Value> = client
        .get(nuance_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let best_nuance = nuances
        .into_iter()
        .max_by_key(|n| n.get("v").and_then(|v| v.as_i64()).unwrap_or(0))
        .ok_or_else(|| "No nuance found".to_string())?;

    let secret_str = best_nuance.get("s").and_then(|s| s.as_str()).unwrap_or("");
    let v_val = best_nuance.get("v").and_then(|v| v.as_i64()).unwrap_or(0);

    let server_time_res: Value = client
        .get("https://open.spotify.com/api/server-time")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    let server_time_sec = server_time_res
        .get("serverTime")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    let decoded_secret = data_encoding::BASE32_NOPAD
        .decode(secret_str.to_uppercase().as_bytes())
        .map_err(|e| e.to_string())?;

    let interval = 30;
    let time_step = (server_time_sec as f64 / interval as f64).floor() as u64;
    let time_bytes = time_step.to_be_bytes();

    let mut mac = HmacSha1::new_from_slice(&decoded_secret).map_err(|e| e.to_string())?;
    mac.update(&time_bytes);
    let hash = mac.finalize().into_bytes();

    let offset = (hash[hash.len() - 1] & 0x0F) as usize;
    let code = (((hash[offset] & 0x7F) as u32) << 24)
        | (((hash[offset + 1] & 0xFF) as u32) << 16)
        | (((hash[offset + 2] & 0xFF) as u32) << 8)
        | ((hash[offset + 3] & 0xFF) as u32);

    let otp = code % 1_000_000;
    let totp = format!("{:06}", otp);

    let token_url = format!(
        "https://open.spotify.com/api/token?reason=transport&productType=web-player&totp={}&totpServer={}&totpVer={}",
        totp, totp, v_val
    );

    let token_res: Value = client
        .get(&token_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let access_token = token_res
        .get("accessToken")
        .and_then(|t| t.as_str())
        .ok_or_else(|| "No access token".to_string())?;
    Ok(access_token.to_string())
}

async fn fetch_spotify_playlist_parsed(url: &str) -> Result<Value, String> {
    let playlist_id = if url.contains("/playlist/") {
        url.split("/playlist/")
            .nth(1)
            .unwrap_or("")
            .split('?')
            .next()
            .unwrap_or("")
    } else if url.starts_with("spotify:playlist:") {
        url.split("spotify:playlist:").nth(1).unwrap_or("")
    } else {
        url
    };

    if playlist_id.is_empty() {
        return Err("Invalid Spotify playlist URL".to_string());
    }

    let token = get_spotify_anonymous_token().await?;
    let client = reqwest::Client::new();

    let playlist_data: Value = client
        .get(&format!(
            "https://api.spotify.com/v1/playlists/{}",
            playlist_id
        ))
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let playlist_name = playlist_data
        .get("name")
        .and_then(|n| n.as_str())
        .unwrap_or("Unknown Playlist")
        .to_string();

    let mut tracks = Vec::new();
    let mut offset = 0;
    let limit = 100;

    loop {
        let page: Value = client
            .get(&format!(
                "https://api.spotify.com/v1/playlists/{}/tracks?offset={}&limit={}",
                playlist_id, offset, limit
            ))
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;

        let items = page.get("items").and_then(|i| i.as_array());
        if let Some(items_arr) = items {
            for item in items_arr {
                if let Some(track) = item.get("track") {
                    if track.is_null() {
                        continue;
                    }
                    let title = track
                        .get("name")
                        .and_then(|n| n.as_str())
                        .unwrap_or("")
                        .to_string();
                    let artists_arr = track.get("artists").and_then(|a| a.as_array());
                    let mut artists = Vec::new();
                    if let Some(arr) = artists_arr {
                        for a in arr {
                            if let Some(name) = a.get("name").and_then(|n| n.as_str()) {
                                artists.push(name.to_string());
                            }
                        }
                    }
                    let duration_ms = track
                        .get("duration_ms")
                        .and_then(|d| d.as_u64())
                        .unwrap_or(0);
                    let artist_str = artists.join(", ");
                    tracks.push(json!({
                        "title": title,
                        "artist": artist_str,
                        "durationMs": duration_ms
                    }));
                }
            }
            if items_arr.len() < limit {
                break;
            }
            offset += limit;
        } else {
            break;
        }
    }

    Ok(json!({
        "status": "success",
        "provider": "Spotify",
        "url": url,
        "playlist": {
            "title": playlist_name,
            "tracks": tracks
        }
    }))
}

async fn fetch_youtube_playlist_parsed(url: &str) -> Result<Value, String> {
    let playlist_id = if url.contains("list=") {
        url.split("list=")
            .nth(1)
            .unwrap_or("")
            .split('&')
            .next()
            .unwrap_or("")
    } else {
        url
    };
    if playlist_id.is_empty() {
        return Err("Invalid YouTube playlist URL".to_string());
    }

    let client = reqwest::Client::new();
    let body = json!({
        "browseId": format!("VL{}", playlist_id),
        "context": {
            "client": {
                "clientName": "WEB_REMIX",
                "clientVersion": "1.20241121.01.00"
            }
        }
    });
    let res: Value = client.post("https://music.youtube.com/youtubei/v1/browse?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-KZBW_4qT8")
        .json(&body)
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let mut tracks = Vec::new();
    let mut title = "YouTube Playlist".to_string();

    if let Some(header) = res.pointer("/header/musicDetailHeaderRenderer") {
        if let Some(t) = header
            .pointer("/title/runs/0/text")
            .and_then(|v| v.as_str())
        {
            title = t.to_string();
        }
    }

    if let Some(contents) = res.pointer("/contents/singleColumnBrowseResultsRenderer/tabs/0/tabRenderer/content/sectionListRenderer/contents/0/musicPlaylistShelfRenderer/contents") {
        if let Some(arr) = contents.as_array() {
            for item in arr {
                if let Some(renderer) = item.pointer("/musicResponsiveListItemRenderer") {
                    let mut track_title = "".to_string();
                    let mut artist = "".to_string();

                    if let Some(runs) = renderer.pointer("/flexColumns/0/musicResponsiveListItemFlexColumnRenderer/text/runs") {
                        if let Some(run_arr) = runs.as_array() {
                            if let Some(text) = run_arr.get(0).and_then(|r| r.get("text")).and_then(|t| t.as_str()) {
                                track_title = text.to_string();
                            }
                        }
                    }
                    if let Some(runs) = renderer.pointer("/flexColumns/1/musicResponsiveListItemFlexColumnRenderer/text/runs") {
                        if let Some(run_arr) = runs.as_array() {
                            let mut artists = Vec::new();
                            for r in run_arr {
                                if let Some(text) = r.get("text").and_then(|t| t.as_str()) {
                                    if text != " â€¢ " && text != " & " {
                                        artists.push(text);
                                    }
                                }
                            }
                            artist = artists.first().unwrap_or(&"").to_string();
                        }
                    }

                    if !track_title.is_empty() {
                        tracks.push(json!({
                            "title": track_title,
                            "artist": artist,
                            "durationMs": 0
                        }));
                    }
                }
            }
        }
    }

    Ok(json!({
        "status": "success",
        "provider": "YouTube",
        "url": url,
        "playlist": {
            "title": title,
            "tracks": tracks
        }
    }))
}

async fn fetch_apple_music_playlist_parsed(url: &str) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let html = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let mut tracks = Vec::new();
    let title = "Apple Music Playlist".to_string();

    let parts: Vec<&str> = html
        .split(r#"<script type="application/ld+json">"#)
        .collect();
    for i in 1..parts.len() {
        if let Some(end) = parts[i].find("</script>") {
            let script_content = &parts[i][..end];
            if let Ok(json_data) = serde_json::from_str::<Value>(script_content) {
                if let Some(arr) = json_data
                    .pointer("/track")
                    .or_else(|| json_data.pointer("/tracks/itemListElement"))
                    .and_then(|v| v.as_array())
                {
                    for item in arr {
                        let track_obj = item.get("item").unwrap_or(item);
                        if let Some(name) = track_obj.get("name").and_then(|n| n.as_str()) {
                            let mut artist_name = "Unknown Artist";
                            if let Some(by_artist) = track_obj.get("byArtist") {
                                if let Some(n) = by_artist.get("name").and_then(|n| n.as_str()) {
                                    artist_name = n;
                                } else if let Some(arr) = by_artist.as_array() {
                                    if let Some(n) = arr
                                        .get(0)
                                        .and_then(|o| o.get("name"))
                                        .and_then(|n| n.as_str())
                                    {
                                        artist_name = n;
                                    }
                                }
                            }
                            tracks.push(json!({
                                "title": name,
                                "artist": artist_name,
                                "durationMs": 0
                            }));
                        }
                    }
                }
            }
        }
    }

    Ok(json!({
        "status": "success",
        "provider": "Apple Music",
        "url": url,
        "playlist": {
            "title": title,
            "tracks": tracks
        }
    }))
}

async fn fetch_soundcloud_playlist_parsed(url: &str) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")
        .build()
        .map_err(|e| e.to_string())?;

    let html = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let mut tracks = Vec::new();
    let title = "SoundCloud Playlist".to_string();

    if let Some(start) = html.find("window.__sc_hydration = ") {
        let rest = &html[start + "window.__sc_hydration = ".len()..];
        if let Some(end) = rest.find(";</script>") {
            let json_str = &rest[..end];
            if let Ok(json_data) = serde_json::from_str::<Value>(json_str) {
                if let Some(arr) = json_data.as_array() {
                    for item in arr {
                        if let Some(data) = item.get("data") {
                            if let Some(tracks_arr) = data.get("tracks").and_then(|t| t.as_array())
                            {
                                for t in tracks_arr {
                                    if let Some(name) =
                                        t.get("title").and_then(|title| title.as_str())
                                    {
                                        let artist = t
                                            .pointer("/user/username")
                                            .and_then(|u| u.as_str())
                                            .unwrap_or("SoundCloud");
                                        tracks.push(json!({
                                            "title": name,
                                            "artist": artist,
                                            "durationMs": 0
                                        }));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(json!({
        "status": "success",
        "provider": "SoundCloud",
        "url": url,
        "playlist": {
            "title": title,
            "tracks": tracks
        }
    }))
}

async fn fetch_amazon_music_playlist_parsed(url: &str) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let html = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let mut tracks = Vec::new();
    let mut title = "Amazon Music Playlist".to_string();

    if let Some(start) = html.find("<title>") {
        if let Some(end) = html[start..].find("</title>") {
            title = html[start + 7..start + end]
                .replace(" | Amazon Music", "")
                .replace(" on Amazon Music", "")
                .to_string();
        }
    }

    let parts: Vec<&str> = html
        .split(r#"<script type="application/ld+json">"#)
        .collect();
    for i in 1..parts.len() {
        if let Some(end) = parts[i].find("</script>") {
            let script_content = &parts[i][..end];
            if let Ok(json_data) = serde_json::from_str::<Value>(script_content) {
                if let Some(arr) = json_data
                    .pointer("/track")
                    .or_else(|| json_data.pointer("/tracks/itemListElement"))
                    .and_then(|v| v.as_array())
                {
                    for item in arr {
                        let track_obj = item.get("item").unwrap_or(item);
                        if let Some(name) = track_obj.get("name").and_then(|n| n.as_str()) {
                            let mut artist_name = "Unknown Artist";
                            if let Some(by_artist) = track_obj.get("byArtist") {
                                if let Some(n) = by_artist.get("name").and_then(|n| n.as_str()) {
                                    artist_name = n;
                                } else if let Some(arr) = by_artist.as_array() {
                                    if let Some(n) = arr
                                        .get(0)
                                        .and_then(|o| o.get("name"))
                                        .and_then(|n| n.as_str())
                                    {
                                        artist_name = n;
                                    }
                                }
                            }
                            tracks.push(json!({
                                "title": name,
                                "artist": artist_name,
                                "durationMs": 0
                            }));
                        }
                    }
                }
            }
        }
    }

    Ok(json!({
        "status": "success",
        "provider": "Amazon Music",
        "url": url,
        "playlist": {
            "title": title,
            "tracks": tracks
        }
    }))
}

#[tauri::command(rename = "integrations:parse-playlist-url")]
pub async fn parse_playlist_url(url: String) -> Result<Value, String> {
    if url.contains("spotify.com") || url.starts_with("spotify:playlist:") {
        return fetch_spotify_playlist_parsed(&url).await;
    } else if url.contains("youtube.com") || url.contains("youtu.be") {
        return fetch_youtube_playlist_parsed(&url).await;
    } else if url.contains("apple.com") {
        return fetch_apple_music_playlist_parsed(&url).await;
    } else if url.contains("soundcloud.com") {
        return fetch_soundcloud_playlist_parsed(&url).await;
    } else if url.contains("amazon.com") || url.contains("music.amazon") {
        return fetch_amazon_music_playlist_parsed(&url).await;
    }

    Ok(json!({
        "status": "success",
        "provider": "Unknown",
        "url": url,
        "playlist": {
            "title": "Parsed Unknown Playlist",
            "tracks": []
        }
    }))
}
