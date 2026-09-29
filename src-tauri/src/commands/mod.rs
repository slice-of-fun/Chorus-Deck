pub mod integrations;
pub mod media;
pub mod store;
pub mod system;
pub mod window;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use crate::cache::lru_cache::LRUCache;
use crate::db::music_db;
use crate::downloads::supervisor::DownloadSupervisor;

/// Settings tracked by the disk cache, persisted in the store.
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

/// Application state shared by every command.
pub struct AppState {
    /// Metadata database. `rusqlite::Connection` is not `Sync`, so it always
    /// sits behind a mutex.
    pub db: Mutex<rusqlite::Connection>,
    /// Settings/UI store, replacing `electron-store`.
    pub store: store::JsonStore,
    /// Download queue and in-flight transfers.
    pub downloads: DownloadSupervisor,
    /// Response/lyric cache backed by SQLite.
    pub cache: Mutex<LRUCache>,
    /// Persisted disk-cache configuration.
    pub disk_cache: Mutex<DiskCacheConfig>,
    /// Last content zoom applied to the webview, so it can be read back.
    pub zoom: Mutex<f64>,
}

impl AppState {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let app_data_dir: PathBuf = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("cannot resolve app data dir: {e}"))?;
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("cannot create app data dir: {e}"))?;

        let conn = music_db::init_db(&app_data_dir)
            .map_err(|e| format!("cannot open database: {e}"))?;
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

        Ok(AppState {
            db: Mutex::new(conn),
            store,
            downloads,
            cache: Mutex::new(cache),
            disk_cache: Mutex::new(DiskCacheConfig::default()),
            zoom: Mutex::new(1.0),
        })
    }
}
