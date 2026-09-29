use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
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

    // `PackageInfo` has no repository field, so the release page is derived
    // from the product name until the real repository is configured.
    let url = format!(
        "https://github.com/ChorusDeck/Chorus-Deck/releases/latest?app={}",
        app.package_info().name
    );
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())?;
    Ok(true)
}

use reqwest::header::{HeaderMap, HeaderValue, ACCEPT_LANGUAGE, AUTHORIZATION, COOKIE, CONTENT_TYPE, ORIGIN, REFERER, USER_AGENT};
use sha1::{Digest, Sha1};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YtmRequestArgs {
    pub endpoint: String,
    pub body: Value,
    pub cookie: Option<String>,
    pub client_name_id: Option<u32>,
    pub client_version: Option<String>,
}

#[tauri::command(rename = "ytm:request")]
pub async fn ytm_request(args: YtmRequestArgs) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://music.youtube.com/youtubei/v1/{}?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-KZBW_4qT8&prettyPrint=false",
        args.endpoint
    );

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        ),
    );
    headers.insert(ORIGIN, HeaderValue::from_static("https://music.youtube.com"));
    headers.insert(REFERER, HeaderValue::from_static("https://music.youtube.com/"));
    
    let client_name_id = args.client_name_id.unwrap_or(67).to_string();
    headers.insert("X-YouTube-Client-Name", HeaderValue::from_str(&client_name_id).unwrap());
    
    let client_version = args.client_version.unwrap_or_else(|| "1.20241121.01.00".to_string());
    headers.insert("X-YouTube-Client-Version", HeaderValue::from_str(&client_version).unwrap());

    headers.insert("X-Goog-Visitor-Id", HeaderValue::from_static(""));
    headers.insert(ACCEPT_LANGUAGE, HeaderValue::from_static("en-US,en;q=0.9"));

    if let Some(c) = args.cookie {
        if let Ok(c_val) = HeaderValue::from_str(&c) {
            headers.insert(COOKIE, c_val);
        }
        
        if let Some(sapisid) = c.split(';').find(|s| s.trim().starts_with("SAPISID=")) {
            let sapisid = sapisid.trim().trim_start_matches("SAPISID=");
            let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
            let input = format!("{} {} https://music.youtube.com", ts, sapisid);
            let hash = hex::encode(Sha1::digest(input.as_bytes()));
            if let Ok(auth_val) = HeaderValue::from_str(&format!("SAPISIDHASH {}_{}", ts, hash)) {
                headers.insert(AUTHORIZATION, auth_val);
            }
        }
    }

    let mut payload = args.body.clone();
    if !payload.as_object().map(|o| o.contains_key("context")).unwrap_or(false) {
        let context = json!({
            "client": {
                "clientName": "WEB_REMIX",
                "clientVersion": "1.20241121.01.00",
                "hl": "en",
                "gl": "US",
                "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                "timeZone": "UTC",
                "utcOffsetMinutes": 0
            }
        });
        if let Value::Object(ref mut map) = payload {
            map.insert("context".to_string(), context);
        }
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

    res.json::<Value>().await.map_err(|e| format!("Parse error: {}", e))
}
