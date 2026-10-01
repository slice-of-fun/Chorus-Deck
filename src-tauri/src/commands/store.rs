use serde_json::{Map, Value};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

use crate::commands::{AppState, DiskCacheConfig};

/// Flat JSON key/value store, replacing `electron-store`.
pub struct JsonStore {
    path: PathBuf,
    data: Mutex<Map<String, Value>>,
}

impl JsonStore {
    pub fn open(path: &Path) -> Self {
        let data = std::fs::read_to_string(path)
            .ok()
            .and_then(|raw| serde_json::from_str::<Map<String, Value>>(&raw).ok())
            .unwrap_or_default();
        JsonStore {
            path: path.to_path_buf(),
            data: Mutex::new(data),
        }
    }

    fn flush(&self, data: &Map<String, Value>) {
        if let Ok(json) = serde_json::to_string_pretty(data) {
            let _ = std::fs::write(&self.path, json);
        }
    }

    pub fn get(&self, key: &str) -> Value {
        self.data
            .lock()
            .ok()
            .and_then(|d| d.get(key).cloned())
            .unwrap_or(Value::Null)
    }

    pub fn set(&self, key: &str, value: Value) {
        if let Ok(mut data) = self.data.lock() {
            data.insert(key.to_string(), value);
            self.flush(&data);
        }
    }
}

#[tauri::command(rename = "get-store-value")]
pub fn get_store_value(state: State<'_, AppState>, key: String) -> Value {
    state.store.get(&key)
}

#[tauri::command(rename = "set-store-value")]
pub fn set_store_value(state: State<'_, AppState>, key: String, value: Value) {
    state.store.set(&key, value);
}

// ------------------------------------------------------------------ disk cache

#[tauri::command(rename = "get-disk-cache-config")]
pub fn get_disk_cache_config(state: State<'_, AppState>) -> DiskCacheConfig {
    state
        .disk_cache
        .lock()
        .map(|c| c.clone())
        .unwrap_or_default()
}

#[tauri::command(rename = "set-disk-cache-config")]
pub fn set_disk_cache_config(state: State<'_, AppState>, config: DiskCacheConfig) {
    if let Ok(mut current) = state.disk_cache.lock() {
        *current = config;
    }
}

#[tauri::command(rename = "get-disk-cache-stats")]
pub fn get_disk_cache_stats(state: State<'_, AppState>) -> serde_json::Value {
    let cache = state.cache.lock();
    match cache {
        Ok(c) => serde_json::json!({
            "entries": c.len(),
            "size": c.size(),
            "maxSize": c.max_size(),
        }),
        Err(_) => serde_json::json!({ "entries": 0, "size": 0, "maxSize": 0 }),
    }
}

#[tauri::command(rename = "clear-disk-cache")]
pub fn clear_disk_cache(state: State<'_, AppState>) -> Result<(), String> {
    state
        .cache
        .lock()
        .map_err(|_| "cache lock poisoned")?
        .clear();
    Ok(())
}

#[tauri::command(rename = "switch-disk-cache-directory")]
pub fn switch_disk_cache_directory(state: State<'_, AppState>, path: String) -> Result<(), String> {
    if !path.is_empty() && !Path::new(&path).is_dir() {
        return Err(format!("not a directory: {path}"));
    }
    if let Ok(mut config) = state.disk_cache.lock() {
        config.path = path;
    }
    Ok(())
}
