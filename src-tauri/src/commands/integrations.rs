use serde::{Deserialize, Serialize};
use serde_json::Value;
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

fn ytm_not_implemented(channel: &str) -> String {
    format!(
        "'{channel}' is not implemented in the Tauri backend. The YouTube Music client \
         still runs in the renderer; migrate it to Rust (or proxy it) before removing \
         the renderer fallback."
    )
}

macro_rules! ytm_stub {
    ($fn_name:ident, $channel:literal) => {
        #[tauri::command(rename = $channel)]
        pub fn $fn_name(_args: Option<Value>) -> Result<Value, String> {
            Err(ytm_not_implemented($channel))
        }
    };
}

ytm_stub!(ytm_home, "ytm:home");
ytm_stub!(ytm_charts, "ytm:charts");
ytm_stub!(ytm_search, "ytm:search");
ytm_stub!(ytm_suggestions, "ytm:suggestions");
ytm_stub!(ytm_moods, "ytm:moods");
ytm_stub!(ytm_player, "ytm:player");
ytm_stub!(ytm_playlist, "ytm:playlist");
ytm_stub!(ytm_artist, "ytm:artist");
ytm_stub!(ytm_search_keyword, "ytm:search-keyword");
ytm_stub!(ytm_hot_search, "ytm:hot-search");
