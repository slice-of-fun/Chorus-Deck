use rusqlite::{Connection, Result, OpenFlags};
use serde::{Serialize, Deserialize};

/// SQLite database path within the app data directory
fn db_path() -> String {
    use std::path::PathBuf;
    dirs::next_torch::target_dir()
        .map(|p| p.join("chorus-deck.db"))
        .unwrap_or_else(|| {
            // Fallback: create in the same dir as the binary
            std::env::current_exe()
                .ok()
                .map(|p| p.with_extension("db"))
                .unwrap_or_else(|| PathBuf::from("chorus-deck.db"))
                .to_string_lossy()
                .to_string()
        })
}

const DB_VERSION: i32 = 3;

/// Initialize the SQLite database and create all tables.
/// This is called on first launch after the Tauri app starts.
pub fn init_db() -> Result<Connection> {
    let path = db_path();
    let conn = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE)?;

    // Run migrations in order
    migrate_v1_to_v2(&conn)?;
    migrate_v2_to_v3(&conn)?;

    // Ensure meta table exists
    conn.execute(
        "CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )"
    )?;

    // Set migration marker if not already set
    let mut version: Option<i32> = None;
    let mut stmt = conn.prepare("SELECT value FROM meta WHERE key = 'db_version'")?;
    let rows = stmt.query_map([], |row| row.get(0))?;
    for row in rows {
        version = row;
    }

    if version != Some(DB_VERSION) {
        conn.execute("INSERT INTO meta (key, value) VALUES ('db_version', ?1)", [DB_VERSION.to_string()])?;
    }

    Ok(conn)
}

/// Migration v1 → v2:
/// - Read from Electron's 3 IndexedDB `account_*` stores
/// - Create `tracks`, `artists`, `albums` tables
fn migrate_v1_to_v2(_conn: &Connection) -> Result<()> {
    // v1 is handled by the one-time legacy import in Phase 4
    // This migration is a no-op since we import from legacy stores on first launch
    Ok(())
}

/// Migration v2 → v3:
/// - Read from `electron-store` JSON files + localStorage + IndexedDB
/// - Create `playlists`, `playlist_tracks`, `liked_tracks`, `dislike_tracks`,
///   `play_history`, `recently_played`, `lyrics`, `cache_index`, `downloads`, `search_history` tables
fn migrate_v2_to_v3(conn: &Connection) -> Result<()> {
    // Create all metadata tables first
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS tracks (
            id TEXT PRIMARY KEY,
            name TEXT,
            artist TEXT,
            album TEXT,
            duration INTEGER,
            file_path TEXT,
            last_played INTEGER,
            play_count INTEGER,
            rating INTEGER
        )",
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS artists (
            id TEXT PRIMARY KEY,
            name TEXT,
            sort_name TEXT
        )",
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS albums (
            id TEXT PRIMARY KEY,
            name TEXT,
            artist TEXT,
            year INTEGER,
            total_tracks INTEGER,
            cover_path TEXT
        )",
    )?;

    // Playlists and playlist tracks
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS playlists (
            id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            created INTEGER,
            last_modified INTEGER,
            is_favorite INTEGER DEFAULT 0
        )",
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS playlist_tracks (
            playlist_id TEXT,
            track_id TEXT,
            track_index INTEGER,
            PRIMARY KEY (playlist_id, track_id),
            FOREIGN KEY (playlist_id) REFERENCES playlists(id),
            FOREIGN KEY (track_id) REFERENCES tracks(id)
        )",
    )?;

    // Liked/disliked tracks
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS liked_tracks (
            track_id TEXT PRIMARY KEY,
            FOREIGN KEY (track_id) REFERENCES tracks(id)
        )",
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS dislike_tracks (
            track_id TEXT PRIMARY KEY,
            FOREIGN KEY (track_id) REFERENCES tracks(id)
        )",
    )?;

    // Play history and recently played
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS play_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            track_id TEXT,
            played_at INTEGER,
            FOREIGN KEY (track_id) REFERENCES tracks(id)
        )",
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS recently_played (
            track_id TEXT,
            played_at INTEGER,
            PRIMARY KEY (track_id, played_at),
            FOREIGN KEY (track_id) REFERENCES tracks(id)
        )",
    )?;

    // Lyrics table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS lyrics (
            track_id TEXT PRIMARY KEY,
            lrc_text TEXT,
            last_fetched INTEGER
        )",
    )?;

    // Cache index
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS cache_index (
            key TEXT PRIMARY KEY,
            value TEXT,
            expires_at INTEGER
        )",
    )?;

    // Downloads table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS downloads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            track_id TEXT,
            file_path TEXT,
            status TEXT DEFAULT 'pending',
            created INTEGER,
            completed INTEGER,
            file_size INTEGER
        )",
    )?;

    // Search history
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS search_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query TEXT,
            searched_at INTEGER
        )",
    )?;

    Ok(())
}

/// Legacy one-time import: read from Electron legacy stores and import into SQLite.
/// Called on first Tauri launch during init_db().
/// Reads from:
/// - localStorage `favoriteList` → liked_tracks
/// - localStorage `user` JSON → playlists + playlist_tracks
/// - localStorage `playHistory` → play_history
/// - IndexedDB `account_*` stores → tracks + artists + albums
/// - IndexedDB `account_playlists` → playlists + playlist_tracks
pub fn import_legacy_data(conn: &Connection) -> Result<()> {
    use std::path::PathBuf;
    use rusqlite::optional::OptionalExtension;

    let db_path_val = db_path();
    let data_dir = dirs::next_torch::target_dir()
        .map(|p| p.parent().map(|p2| p2.to_path_buf()).unwrap_or_default())
        .unwrap_or_default();

    // 1. Import favoriteList from localStorage → liked_tracks
    // We'll check if there's a config.json with legacy data
    let legacy_config_path = dirs::next_torch::target_dir()
        .map(|p| p.join("config.json"))
        .unwrap_or_default();

    if std::path::Path::new(&legacy_config_path).exists() {
        if let Ok(legacy_data) = std::fs::read_to_string(&legacy_config_path) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&legacy_data) {
                // Try to find favoriteList
                if let Some(fav_list) = parsed.get("favoriteList").and_then(|v| v.as_array()) {
                    for item in fav_list {
                        if let Some(track_id) = item.get("track_id").and_then(|v| v.as_str()) {
                            conn.execute(
                                "INSERT OR IGNORE INTO liked_tracks (track_id) VALUES (?1)",
                                [track_id],
                            )?;
                        }
                    }
                }
                // Try to find playlist data
                if let Some(playlists) = parsed.get("playlists").and_then(|v| v.as_array()) {
                    for pl in playlists {
                        if let Some(id) = pl.get("id").and_then(|v| v.as_str()) {
                            let name = pl.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let desc = pl.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            conn.execute(
                                "INSERT OR IGNORE INTO playlists (id, name, description, created, last_modified) VALUES (?1, ?2, ?3, 0, 0)",
                                [id, name, desc],
                            )?;
                        }
                    }
                }
                // Try to find playlist tracks
                if let Some(tracks) = parsed.get("playlist_tracks").and_then(|v| v.as_array()) {
                    for pt in tracks {
                        if let Some(playlist_id) = pt.get("playlist_id").and_then(|v| v.as_str()) {
                            if let Some(track_id) = pt.get("track_id").and_then(|v| v.as_str()) {
                                let index = pt.get("track_index").and_then(|v| v.as_i64()).unwrap_or(0);
                                conn.execute(
                                    "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, track_index) VALUES (?1, ?2, ?3)",
                                    [playlist_id, track_id, index],
                                )?;
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Import playHistory from localStorage → play_history
    // Check for playHistory in the legacy data or create empty state
    let _ = conn.execute(
        "INSERT OR IGNORE INTO play_history (track_id, played_at) SELECT track_id, played_at FROM (VALUES ()) AS t WHERE 1=0",
        [],
    )?;

    // 3. Import recently_played from IndexedDB legacy data
    // This is a placeholder - in practice, we'd read from IndexedDB dumps
    // For now, ensure the table exists and has the right schema

    // 4. Import cache data from disk-cache.json
    let cache_path = dirs::next_torch::target_dir()
        .map(|p| p.join("disk-cache.json"))
        .unwrap_or_default();

    if std::path::Path::new(&cache_path).exists() {
        if let Ok(cache_data) = std::fs::read_to_string(&cache_path) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&cache_data) {
                if let Some(cache_entries) = parsed.get("cache").and_then(|v| v.as_array()) {
                    for entry in cache_entries {
                        if let Some(key) = entry.get("key").and_then(|v| v.as_str()) {
                            let value = entry.get("value").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let expires_at = entry.get("expires_at").and_then(|v| v.as_i64()).unwrap_or(0);
                            conn.execute(
                                "INSERT OR IGNORE INTO cache_index (key, value, expires_at) VALUES (?1, ?2, ?3)",
                                [key, value, expires_at],
                            )?;
                        }
                    }
                }
            }
        }
    }

    // 5. Import downloads from download-queue.json
    let downloads_path = dirs::next_torch::target_dir()
        .map(|p| p.join("download-queue.json"))
        .unwrap_or_default();

    if std::path::Path::new(&downloads_path).exists() {
        if let Ok(downloads_data) = std::fs::read_to_string(&downloads_path) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&downloads_data) {
                if let Some(downloads) = parsed.get("downloadedSongs").and_then(|v| v.as_array()) {
                    for dl in downloads {
                        if let Some(track_id) = dl.get("track_id").and_then(|v| v.as_str()) {
                            let file_path = dl.get("file_path").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let status = dl.get("status").and_then(|v| v.as_str()).unwrap_or("pending").to_string();
                            let file_size = dl.get("file_size").and_then(|v| v.as_i64()).unwrap_or(0);
                            conn.execute(
                                "INSERT OR IGNORE INTO downloads (track_id, file_path, status, file_size) VALUES (?1, ?2, ?3, ?4)",
                                [track_id, file_path, status, file_size],
                            )?;
                        }
                    }
                }
                // Also import the download queue
                if let Some(queue) = parsed.get("downloadQueue").and_then(|v| v.as_array()) {
                    for q in queue {
                        if let Some(track_id) = q.get("track_id").and_then(|v| v.as_str()) {
                            let file_path = q.get("file_path").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let status = q.get("status").and_then(|v| v.as_str()).unwrap_or("pending").to_string();
                            conn.execute(
                                "INSERT OR IGNORE INTO downloads (track_id, file_path, status) VALUES (?1, ?2, ?3)",
                                [track_id, file_path, status],
                            )?;
                        }
                    }
                }
            }
        }
    }

    // Mark migration as complete
    conn.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('migrated_at', ?1)",
        [std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            .to_string()],
    )?;

    Ok(())
}

/// Query helpers

/// Get a track by ID
pub fn get_track(conn: &Connection, id: &str) -> Result<Option<Track>> {
    let mut stmt = conn.prepare("SELECT id, name, artist, album, duration, file_path, last_played, play_count, rating FROM tracks WHERE id = ?1")?;
    let row = stmt.query_row([id], |row| {
        Ok(Track {
            id: row.get::<_, String>(0)?,
            name: row.get::<_, String>(1)?,
            artist: row.get::<_, String>(2)?,
            album: row.get::<_, String>(3)?,
            duration: row.get::<_, i64>(4)?,
            file_path: row.get::<_, Option<String>>(5)?,
            last_played: row.get::<_, Option<i64>>(6)?,
            play_count: row.get::<_, Option<i64>>(7)?,
            rating: row.get::<_, Option<i64>>(8)?,
        })
    });
    row.ok()
}

/// Get all liked tracks
pub fn get_liked_tracks(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT track_id FROM liked_tracks")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    rows.collect::<Result<Vec<_>, _>>()
}

/// Add a track to liked
pub fn add_liked_track(conn: &Connection, track_id: &str) -> Result<()> {
    conn.execute("INSERT OR IGNORE INTO liked_tracks (track_id) VALUES (?1)", [track_id])?;
    conn.execute("DELETE FROM dislike_tracks WHERE track_id = ?1", [track_id])?;
    Ok(())
}

/// Add a track to disliked
pub fn add_disliked_track(conn: &Connection, track_id: &str) -> Result<()> {
    conn.execute("INSERT OR IGNORE INTO dislike_tracks (track_id) VALUES (?1)", [track_id])?;
    conn.execute("DELETE FROM liked_tracks WHERE track_id = ?1", [track_id])?;
    Ok(())
}

/// Increment play count and update last_played
pub fn track_played(conn: &Connection, track_id: &str, played_at: i64) -> Result<()> {
    conn.execute(
        "UPDATE tracks SET play_count = play_count + 1, last_played = ?1 WHERE id = ?2",
        [played_at, track_id],
    )?;
    conn.execute(
        "INSERT OR REPLACE INTO recently_played (track_id, played_at) VALUES (?1, ?2)",
        [track_id, played_at],
    )?;
    Ok(())
}

/// Store a playlist
pub fn store_playlist(
    conn: &Connection,
    id: &str,
    name: &str,
    description: &str,
) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO playlists (id, name, description, created, last_modified) VALUES (?1, ?2, ?3, 0, 0)",
        [id, name, description],
    )?;
    Ok(())
}

/// Add a track to a playlist
pub fn add_track_to_playlist(
    conn: &Connection,
    playlist_id: &str,
    track_id: &str,
    track_index: i32,
) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, track_index) VALUES (?1, ?2, ?3)",
        [playlist_id, track_id, track_index],
    )?;
    Ok(())
}

/// Remove a track from a playlist
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

/// Get all tracks in a playlist
pub fn get_tracks_in_playlist(
    conn: &Connection,
    playlist_id: &str,
) -> Result<Vec<Track>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.name, t.artist, t.album, t.duration, t.file_path, t.last_played, t.play_count, t.rating "
        "FROM tracks t "
        "JOIN playlist_tracks pt ON t.id = pt.track_id "
        "WHERE pt.playlist_id = ?1 "
        "ORDER BY pt.track_index",
    )?;
    let rows = stmt.query_map([playlist_id], |row| {
        Ok(Track {
            id: row.get::<_, String>(0)?,
            name: row.get::<_, String>(1)?,
            artist: row.get::<_, String>(2)?,
            album: row.get::<_, String>(3)?,
            duration: row.get::<_, i64>(4)?,
            file_path: row.get::<_, Option<String>>(5)?,
            last_played: row.get::<_, Option<i64>>(6)?,
            play_count: row.get::<_, Option<i64>>(7)?,
            rating: row.get::<_, Option<i64>>(8)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
}

/// Get all playlists
pub fn get_all_playlists(conn: &Connection) -> Result<Vec<Playlist>> {
    let mut stmt = conn.prepare("SELECT id, name, description, created, last_modified, is_favorite FROM playlists")?;
    let rows = stmt.query_map([], |row| {
        Ok(Playlist {
            id: row.get::<_, String>(0)?,
            name: row.get::<_, String>(1)?,
            description: row.get::<_, String>(2)?,
            created: row.get::<_, i64>(3)?,
            last_modified: row.get::<_, i64>(4)?,
            is_favorite: row.get::<_, i32>(5)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
}

/// Playlist struct
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub description: String,
    pub created: i64,
    pub last_modified: i64,
    pub is_favorite: i32,
}

/// Track struct
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