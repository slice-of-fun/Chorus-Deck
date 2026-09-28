use tauri::api::path::app_data_dir;
use tauri::api::Manager;
use serde::Serialize;
use rusqlite::{Connection, Result};

/// Batched library state returned by the `library_page` Tauri command.
/// Replaces N+1 IPC calls with a single call.
#[derive(serde::Serialize)]
pub struct LibraryPage {
  /// Tracks (id → name, artist, album, duration, play_count)
  pub tracks: Vec<TrackSummary>,
  /// Playlists (id → name, description, track count)
  pub playlists: Vec<PlaylistSummary>,
  /// Favorite track IDs
  pub favorite_ids: Vec<String>,
  /// Recently played track IDs (most recent first)
  pub recently_played: Vec<String>,
  /// Search history
  pub search_history: Vec<String>,
}

/// Summary of a track for the library page
#[derive(serde::Serialize)]
pub struct TrackSummary {
  pub id: String,
  pub name: String,
  pub artist: String,
  pub album: String,
  pub duration: i64,
  pub play_count: i64,
}

/// Summary of a playlist
#[derive(serde::Serialize)]
pub struct PlaylistSummary {
  pub id: String,
  pub name: String,
  pub description: String,
  pub track_count: usize,
}

/// #[tauri::command]
/// Return the full library page state as a Tauri command result.
/// This replaces N separate IPC calls with a single batched call.
pub fn library_page() -> Result<LibraryPage> {
  use rusqlite::Connection;

  let conn = crate::db::music_db::init_db()?;

  // Read tracks from SQLite
  let tracks: Vec<TrackSummary> = conn.query_map(
    "SELECT id, name, artist, album, duration, play_count FROM tracks",
    |row| {
      Ok(TrackSummary {
        id: row.get::<_, String>(0)?,
        name: row.get::<_, String>(1)?,
        artist: row.get::<_, String>(2)?,
        album: row.get::<_, String>(3)?,
        duration: row.get::<_, i64>(4)?,
        play_count: row.get::<_, i64>(5)?,
      })
    })?
    .filter_map(|r| r.ok());

  // Read playlists from SQLite
  let playlists: Vec<PlaylistSummary> = conn.query_map(
    "SELECT id, name, description FROM playlists",
    |row| {
      let track_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = ?1",
        row.get::<_, String>(0),
        |row| row.get::<_, i64>(0),
      ).ok().unwrap_or(0);
      Ok(PlaylistSummary {
        id: row.get::<_, String>(0)?,
        name: row.get::<_, String>(1)?,
        description: row.get::<_, String>(2)?,
        track_count: track_count as usize,
      })
    })?
    .filter_map(|r| r.ok());

  // Read favorite IDs from the liked_tracks table
  let favorite_ids: Vec<String> = conn.query_map(
    "SELECT track_id FROM liked_tracks",
    |row| row.get::<_, String>(0),
  )?
  .filter_map(|r| r.ok());

  // Read recently played from recently_played table
  let recently_played: Vec<String> = conn.query_map(
    "SELECT track_id FROM recently_played ORDER BY played_at DESC",
    |row| row.get::<_, String>(0),
  )?
  .filter_map(|r| r.ok())
  .into_iter()
  .take(20) // Last 20
  .collect();

  // Read search history from meta
  let search_history: Vec<String> = {
    let mut stmt = conn.prepare("SELECT value FROM meta WHERE key = 'search_history'")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    rows.filter_map(|r| r.ok()).collect()
  };

  Ok(LibraryPage {
    tracks,
    playlists,
    favorite_ids,
    recently_played,
    search_history,
  })
}

/// #[tauri::command]
/// Initialize the library module.
/// Must be called during Tauri setup to ensure SQLite is ready.
pub fn init() -> Result<()> {
  // Ensure the database and tables exist
  let _conn = crate::db::music_db::init_db()?;
  crate::db::music_db::import_legacy_data(&_conn)?;
  Ok(())
}