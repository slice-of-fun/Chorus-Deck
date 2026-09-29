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

#[tauri::command(rename = "db_get_liked_tracks_full")]
pub fn get_liked_tracks_full(state: State<'_, AppState>) -> Result<Vec<Track>, String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::get_liked_tracks_full(&conn).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_get_recently_played_full")]
pub fn get_recently_played_full(state: State<'_, AppState>) -> Result<Vec<Track>, String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::get_recently_played_full(&conn).map_err(|e| e.to_string())
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

#[tauri::command(rename = "db_follow_artist")]
pub fn follow_artist(state: State<'_, AppState>, artist_id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::follow_artist(&conn, &artist_id).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_unfollow_artist")]
pub fn unfollow_artist(state: State<'_, AppState>, artist_id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::unfollow_artist(&conn, &artist_id).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_get_followed_artists")]
pub fn get_followed_artists(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::get_followed_artists(&conn).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_get_top_50_tracks")]
pub fn get_top_50_tracks(state: State<'_, AppState>) -> Result<Vec<Track>, String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::get_top_50_tracks(&conn).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_get_downloaded_tracks_full")]
pub fn get_downloaded_tracks_full(state: State<'_, AppState>) -> Result<Vec<Track>, String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::get_downloaded_tracks_full(&conn).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_export_user_data")]
pub fn export_user_data(state: State<'_, AppState>, export_path: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::export_user_data(&conn, &export_path).map_err(|e| e.to_string())
}

#[tauri::command(rename = "db_import_playlist")]
pub fn import_playlist(state: State<'_, AppState>, id: String, name: String, description: String, tracks: Vec<music_db::ImportedTrack>) -> Result<(), String> {
    let mut conn = state.db.lock().map_err(|_| "db lock poisoned")?;
    music_db::import_playlist(&mut conn, &id, &name, &description, &tracks).map_err(|e| e.to_string())
}
