pub mod audio;
pub mod db;
pub mod discord;
pub mod eq;
pub mod integrations;
pub mod lyrics;
pub mod media;
pub mod store;
pub mod stream_decoder;
pub mod system;
pub mod window;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use crate::cache::lru_cache::LRUCache;
use crate::db::music_db;
use crate::downloads::supervisor::DownloadSupervisor;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskCacheConfig {
    pub path: String,
    pub max_size: u64,
    pub enabled: bool,
}

impl Default for DiskCacheConfig {
    fn default() -> Self {
        DiskCacheConfig {
            path: String::new(),
            max_size: 512 * 1024 * 1024,
            enabled: true,
        }
    }
}

pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
    pub store: store::JsonStore,
    pub downloads: DownloadSupervisor,
    pub cache: Mutex<LRUCache>,
    pub disk_cache: Mutex<DiskCacheConfig>,
    pub zoom: Mutex<f64>,
    pub ytm: tokio::sync::Mutex<ytmusicapi::YTMusicClient>,
}

impl AppState {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let app_data_dir: PathBuf = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("cannot resolve app data dir: {e}"))?;
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("cannot create app data dir: {e}"))?;

        let conn =
            music_db::init_db(&app_data_dir).map_err(|e| format!("cannot open database: {e}"))?;
        if let Err(e) = music_db::import_legacy_data(&conn) {
            eprintln!("[db] legacy import failed (non-fatal): {e}");
        }

        let store = store::JsonStore::open(&app_data_dir.join("store.json"));
        let downloads = DownloadSupervisor::new(app, app_data_dir.clone());

        // Cache shares the same database file via its own connection.
        let cache_conn = music_db::init_db(&app_data_dir)
            .map_err(|e| format!("cannot open cache database: {e}"))?;
        let cache = LRUCache::new(128 * 1024 * 1024, cache_conn)
            .map_err(|e| format!("cannot open cache: {e}"))?;

        let ytm = ytmusicapi::YTMusicClient::builder()
            .build()
            .map_err(|e| format!("cannot create ytmusic client: {e}"))?;

        Ok(AppState {
            db: Mutex::new(conn),
            store,
            downloads,
            cache: Mutex::new(cache),
            disk_cache: Mutex::new(DiskCacheConfig::default()),
            zoom: Mutex::new(1.0),
            ytm: tokio::sync::Mutex::new(ytm),
        })
    }
}
