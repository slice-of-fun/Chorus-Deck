use tauri::State;
use crate::commands::AppState;
use crate::db::music_db::{self, Playlist, Track};

#[tauri::command(rename = "db_get_track")]
pub fn get_track(state: State<'_, AppState>, id: String) -> Result<Option<Track>, String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::get_track(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_get_liked_tracks")]
pub fn get_liked_tracks(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::get_liked_tracks(&conn).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_add_liked_track")]
pub fn add_liked_track(state: State<'_, AppState>, track_id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::add_liked_track(&conn, &track_id).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_add_disliked_track")]
pub fn add_disliked_track(state: State<'_, AppState>, track_id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::add_disliked_track(&conn, &track_id).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_track_played")]
pub fn track_played(state: State<'_, AppState>, track_id: String, played_at: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::track_played(&conn, &track_id, played_at).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_store_playlist")]
pub fn store_playlist(state: State<'_, AppState>, id: String, name: String, description: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::store_playlist(&conn, &id, &name, &description).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_add_track_to_playlist")]
pub fn add_track_to_playlist(state: State<'_, AppState>, playlist_id: String, track_id: String, track_index: i32) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::add_track_to_playlist(&conn, &playlist_id, &track_id, track_index).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_remove_track_from_playlist")]
pub fn remove_track_from_playlist(state: State<'_, AppState>, playlist_id: String, track_id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::remove_track_from_playlist(&conn, &playlist_id, &track_id).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_get_tracks_in_playlist")]
pub fn get_tracks_in_playlist(state: State<'_, AppState>, playlist_id: String) -> Result<Vec<Track>, String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::get_tracks_in_playlist(&conn, &playlist_id).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_get_all_playlists")]
pub fn get_all_playlists(state: State<'_, AppState>) -> Result<Vec<Playlist>, String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::get_all_playlists(&conn).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_save_local_music")]
pub fn save_local_music(state: State<'_, AppState>, entry: music_db::LocalMusicEntry) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::save_local_music(&conn, &entry).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_get_all_local_music")]
pub fn get_all_local_music(state: State<'_, AppState>) -> Result<Vec<music_db::LocalMusicEntry>, String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::get_all_local_music(&conn).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_delete_local_music")]
pub fn delete_local_music(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::delete_local_music(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_clear_local_music")]
pub fn clear_local_music(state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::clear_local_music(&conn).map_err(|e| e.to_string())
}
