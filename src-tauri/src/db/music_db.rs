use rusqlite::{Connection, OpenFlags, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

const DB_VERSION: i32 = 3;

pub fn legacy_user_data_dir() -> Option<std::path::PathBuf> {
    dirs::data_dir().map(|d| d.join("Chorus Deck"))
}
pub fn init_db(app_data_dir: &Path) -> Result<Connection> {
    std::fs::create_dir_all(app_data_dir).map_err(|e| {
        rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::other(e.to_string())))
    })?;

    let path = app_data_dir.join("chorus-deck.db");
    let conn = Connection::open_with_flags(
        &path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE,
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS meta (
           key TEXT PRIMARY KEY,
           value TEXT
         );
         CREATE TABLE IF NOT EXISTS tracks (
           id TEXT PRIMARY KEY,
           name TEXT,
           artist TEXT,
           album TEXT,
           duration INTEGER,
           file_path TEXT,
           last_played INTEGER,
           play_count INTEGER,
           rating INTEGER
         );
         CREATE TABLE IF NOT EXISTS artists (
           id TEXT PRIMARY KEY,
           name TEXT,
           sort_name TEXT
         );
         CREATE TABLE IF NOT EXISTS albums (
           id TEXT PRIMARY KEY,
           name TEXT,
           artist TEXT,
           year INTEGER,
           total_tracks INTEGER,
           cover_path TEXT
         );
         CREATE TABLE IF NOT EXISTS playlists (
           id TEXT PRIMARY KEY,
           name TEXT,
           description TEXT,
           created INTEGER,
           last_modified INTEGER,
           is_favorite INTEGER DEFAULT 0
         );
         CREATE TABLE IF NOT EXISTS playlist_tracks (
           playlist_id TEXT,
           track_id TEXT,
           track_index INTEGER,
           PRIMARY KEY (playlist_id, track_id)
         );
         CREATE TABLE IF NOT EXISTS liked_tracks (
           track_id TEXT PRIMARY KEY
         );
         CREATE TABLE IF NOT EXISTS dislike_tracks (
           track_id TEXT PRIMARY KEY
         );
         CREATE TABLE IF NOT EXISTS play_history (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           track_id TEXT,
           played_at INTEGER
         );
         CREATE TABLE IF NOT EXISTS recently_played (
           track_id TEXT,
           played_at INTEGER,
           PRIMARY KEY (track_id, played_at)
         );
         CREATE TABLE IF NOT EXISTS lyrics (
           track_id TEXT PRIMARY KEY,
           lrc_text TEXT,
           last_fetched INTEGER
         );
         CREATE TABLE IF NOT EXISTS cache_index (
           key TEXT PRIMARY KEY,
           value TEXT,
           expires_at INTEGER
         );
         CREATE TABLE IF NOT EXISTS downloads (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           track_id TEXT,
           file_path TEXT,
           status TEXT DEFAULT 'pending',
           created INTEGER,
           completed INTEGER,
           file_size INTEGER
         );
         CREATE TABLE IF NOT EXISTS search_history (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           query TEXT,
           searched_at INTEGER
         );",
    )?;

    conn.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('db_version', ?1)",
        [DB_VERSION.to_string()],
    )?;

    Ok(conn)
}

pub fn import_legacy_data(conn: &Connection) -> Result<()> {
    let already_done = conn
        .query_row(
            "SELECT value FROM meta WHERE key = 'migrated_at'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()?
        .is_some();
    if already_done {
        return Ok(());
    }

    let Some(legacy_dir) = legacy_user_data_dir() else {
        return Ok(());
    };

    if let Some(value) = read_json(&legacy_dir.join("config.json")) {
        if let Some(fav_list) = value.get("favoriteList").and_then(|v| v.as_array()) {
            for item in fav_list {
                if let Some(track_id) = item.get("track_id").and_then(|v| v.as_str()) {
                    conn.execute(
                        "INSERT OR IGNORE INTO liked_tracks (track_id) VALUES (?1)",
                        [track_id],
                    )?;
                }
            }
        }

        if let Some(playlists) = value.get("playlists").and_then(|v| v.as_array()) {
            for pl in playlists {
                if let Some(id) = pl.get("id").and_then(|v| v.as_str()) {
                    let name = pl.get("name").and_then(|v| v.as_str()).unwrap_or("");
                    let desc = pl.get("description").and_then(|v| v.as_str()).unwrap_or("");
                    conn.execute(
                        "INSERT OR IGNORE INTO playlists (id, name, description, created, last_modified) VALUES (?1, ?2, ?3, 0, 0)",
                        [id, name, desc],
                    )?;
                }
            }
        }

        if let Some(tracks) = value.get("playlist_tracks").and_then(|v| v.as_array()) {
            for pt in tracks {
                if let (Some(playlist_id), Some(track_id)) = (
                    pt.get("playlist_id").and_then(|v| v.as_str()),
                    pt.get("track_id").and_then(|v| v.as_str()),
                ) {
                    let index = pt.get("track_index").and_then(|v| v.as_i64()).unwrap_or(0);
                    conn.execute(
                        "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, track_index) VALUES (?1, ?2, ?3)",
                        rusqlite::params![playlist_id, track_id, index],
                    )?;
                }
            }
        }
    }

    if let Some(cache) = read_json(&legacy_dir.join("disk-cache.json")) {
        if let Some(entries) = cache.get("cache").and_then(|v| v.as_array()) {
            for entry in entries {
                if let Some(key) = entry.get("key").and_then(|v| v.as_str()) {
                    let value = entry.get("value").and_then(|v| v.as_str()).unwrap_or("");
                    let expires_at = entry
                        .get("expires_at")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    conn.execute(
                        "INSERT OR IGNORE INTO cache_index (key, value, expires_at) VALUES (?1, ?2, ?3)",
                        rusqlite::params![key, value, expires_at],
                    )?;
                }
            }
        }
    }

    if let Some(queue) = read_json(&legacy_dir.join("download-queue.json")) {
        for key in ["downloadedSongs", "downloadQueue"] {
            let Some(items) = queue.get(key).and_then(|v| v.as_array()) else {
                continue;
            };
            for dl in items {
                let Some(track_id) = dl.get("track_id").and_then(|v| v.as_str()) else {
                    continue;
                };
                let file_path = dl.get("file_path").and_then(|v| v.as_str()).unwrap_or("");
                let status = dl
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("pending");
                let file_size = dl.get("file_size").and_then(|v| v.as_i64()).unwrap_or(0);
                conn.execute(
                    "INSERT INTO downloads (track_id, file_path, status, file_size) VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![track_id, file_path, status, file_size],
                )?;
            }
        }
    }

    let migrated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
        .to_string();
    conn.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('migrated_at', ?1)",
        [migrated_at],
    )?;

    Ok(())
}

fn read_json(path: &Path) -> Option<serde_json::Value> {
    let raw = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn track_from_row(row: &rusqlite::Row<'_>) -> Result<Track> {
    Ok(Track {
        id: row.get(0)?,
        name: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
        artist: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
        album: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
        duration: row.get::<_, Option<i64>>(4)?.unwrap_or_default(),
        file_path: row.get(5)?,
        last_played: row.get(6)?,
        play_count: row.get(7)?,
        rating: row.get(8)?,
    })
}

const TRACK_COLUMNS: &str =
    "id, name, artist, album, duration, file_path, last_played, play_count, rating";

pub fn get_track(conn: &Connection, id: &str) -> Result<Option<Track>> {
    let mut stmt = conn.prepare(&format!("SELECT {TRACK_COLUMNS} FROM tracks WHERE id = ?1"))?;
    stmt.query_row([id], track_from_row).optional()
}

pub fn get_liked_tracks(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT track_id FROM liked_tracks")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    rows.collect()
}

pub fn add_liked_track(conn: &Connection, track_id: &str) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO liked_tracks (track_id) VALUES (?1)",
        [track_id],
    )?;
    conn.execute("DELETE FROM dislike_tracks WHERE track_id = ?1", [track_id])?;
    Ok(())
}

pub fn add_disliked_track(conn: &Connection, track_id: &str) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO dislike_tracks (track_id) VALUES (?1)",
        [track_id],
    )?;
    conn.execute("DELETE FROM liked_tracks WHERE track_id = ?1", [track_id])?;
    Ok(())
}

pub fn track_played(conn: &Connection, track_id: &str, played_at: i64) -> Result<()> {
    conn.execute(
        "UPDATE tracks SET play_count = COALESCE(play_count, 0) + 1, last_played = ?1 WHERE id = ?2",
        rusqlite::params![played_at, track_id],
    )?;
    conn.execute(
        "INSERT OR REPLACE INTO recently_played (track_id, played_at) VALUES (?1, ?2)",
        rusqlite::params![track_id, played_at],
    )?;
    Ok(())
}

pub fn store_playlist(conn: &Connection, id: &str, name: &str, description: &str) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO playlists (id, name, description, created, last_modified) VALUES (?1, ?2, ?3, 0, 0)",
        [id, name, description],
    )?;
    Ok(())
}

pub fn add_track_to_playlist(
    conn: &Connection,
    playlist_id: &str,
    track_id: &str,
    track_index: i32,
) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO playlist_tracks (playlist_id, track_id, track_index) VALUES (?1, ?2, ?3)",
        rusqlite::params![playlist_id, track_id, track_index],
    )?;
    Ok(())
}

pub fn remove_track_from_playlist(
    conn: &Connection,
    playlist_id: &str,
    track_id: &str,
) -> Result<()> {
    conn.execute(
        "DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2",
        [playlist_id, track_id],
    )?;
    Ok(())
}

pub fn get_tracks_in_playlist(conn: &Connection, playlist_id: &str) -> Result<Vec<Track>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT t.id, t.name, t.artist, t.album, t.duration, t.file_path, t.last_played, t.play_count, t.rating
         FROM tracks t
         JOIN playlist_tracks pt ON t.id = pt.track_id
         WHERE pt.playlist_id = ?1
         ORDER BY pt.track_index"
    ))?;
    let rows = stmt.query_map([playlist_id], track_from_row)?;
    rows.collect()
}

pub fn get_all_playlists(conn: &Connection) -> Result<Vec<Playlist>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, created, last_modified, is_favorite FROM playlists",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Playlist {
            id: row.get(0)?,
            name: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
            description: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            created: row.get::<_, Option<i64>>(3)?.unwrap_or_default(),
            last_modified: row.get::<_, Option<i64>>(4)?.unwrap_or_default(),
            is_favorite: row.get::<_, Option<i32>>(5)?.unwrap_or_default(),
        })
    })?;
    rows.collect()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub description: String,
    pub created: i64,
    pub last_modified: i64,
    pub is_favorite: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Track {
    pub id: String,
    pub name: String,
    pub artist: String,
    pub album: String,
    pub duration: i64,
    pub file_path: Option<String>,
    pub last_played: Option<i64>,
    pub play_count: Option<i64>,
    pub rating: Option<i64>,
}
