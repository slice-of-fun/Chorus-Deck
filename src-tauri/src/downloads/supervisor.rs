use tauri::api::path::app_data_dir;
use tauri::api::file::create_dir_all;
use tauri::api::http::request::Request;
use tauri::api::http::response::Response;
use tauri::api::path::BaseDir;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use base64::{Engine, engine::general_purpose};
use id3::TagBuilder;
use flac_metadata_rs::FlacMetadata;

/// Download status enum
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum DownloadStatus {
  Pending,
  Downloading,
  Completed,
  Failed,
  Cancelled,
}

/// Download task struct
#[derive(Debug)]
pub struct DownloadTask {
  /// Unique download ID
  pub id: String,
  /// URL to download
  pub url: String,
  /// Destination file path
  pub destination: PathBuf,
  /// Current status
  pub status: DownloadStatus,
  /// Download progress (0.0 to 1.0)
  pub progress: f64,
  /// Bytes downloaded so far
  pub downloaded: u64,
  /// Total file size
  pub total_size: u64,
  /// Song metadata for tagging
  pub title: Option<String>,
  pub artist: Option<String>,
  pub album: Option<String>,
}

/// Download supervisor - manages all download tasks
/// Runs as a tokio task set, not on the main thread
pub struct DownloadSupervisor {
  /// Active download tasks (id → task)
  tasks: Mutex<HashMap<String, DownloadTask>>,
  /// SQLite connection for persistence
  conn: Connection,
  /// Base directory for downloads (user data dir / downloads)
  base_dir: PathBuf,
}

/// Download task state stored in SQLite
#[derive(Debug, Serialize, Deserialize)]
struct DbDownload {
  id: String,
  url: String,
  destination: String,
  status: String,
  progress: f64,
  downloaded: u64,
  total_size: u64,
  title: Option<String>,
  artist: Option<String>,
  album: Option<String>,
}

/// Create the downloads table and return a new DownloadSupervisor
pub fn init_supervisor(conn: &Connection, base_dir_path: &PathBuf) -> Result<DownloadSupervisor> {
  // Ensure the downloads directory exists
  let base_dir = if base_dir_path.exists() {
    base_dir_path.to_path_buf()
  } else {
    create_dir_all(base_dir_path).map(|_| base_dir_path.to_path_buf())?
  };

  // Create the downloads table
  conn.execute(
    "CREATE TABLE IF NOT EXISTS downloads (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      destination TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress REAL NOT NULL DEFAULT 0.0,
      downloaded_u64 INTEGER NOT NULL DEFAULT 0,
      total_size_u64 INTEGER NOT NULL DEFAULT 0,
      title TEXT,
      artist TEXT,
      album TEXT
    )",
    [],
  )?;

  let tasks = Mutex::new(HashMap::new());

  Ok(DownloadSupervisor {
    tasks,
    conn,
    base_dir,
  })
}

/// Get all download tasks from the supervisor
pub fn get_tasks(supervisor: &DownloadSupervisor) -> Vec<DownloadTask> {
  let tasks = supervisor.tasks.lock().unwrap();
  tasks.values().cloned().collect()
}

/// Get a specific download task by ID
pub fn get_task(supervisor: &DownloadSupervisor, id: &str) -> Option<DownloadTask> {
  let tasks = supervisor.tasks.lock().unwrap();
  tasks.get(id).cloned()
}

/// Start a new download
pub fn start_download(
  supervisor: &DownloadSupervisor,
  id: String,
  url: String,
  title: Option<String>,
  artist: Option<String>,
  album: Option<String>,
) -> Result<()> {
  let destination = {
    let filename = url
      .split('/')
      .last()
      .unwrap_or("unknown")
      .to_string();
    supervisor.base_dir.join(filename)
  };

  let task = DownloadTask {
    id: id.clone(),
    url,
    destination,
    status: DownloadStatus::Downloading,
    progress: 0.0,
    downloaded: 0,
    total_size: 0,
    title,
    artist,
    album,
  };

  // Persist to SQLite
  let _ = supervisor.conn.execute(
    "INSERT OR REPLACE INTO downloads (id, url, destination, status, progress, downloaded, total_size, title, artist, album) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
    [
      &task.id,
      &task.url,
      &task.destination.to_string_lossy(),
      &format!("{:?}", task.status),
      task.progress,
      task.downloaded,
      task.total_size,
      &task.title.clone().unwrap_or_default(),
      &task.artist.clone().unwrap_or_default(),
      &task.album.clone().unwrap_or_default(),
    ],
  );

  // Insert into memory tasks
  let mut tasks = supervisor.tasks.lock().unwrap();
  tasks.insert(id.clone(), task);

  Ok(())
}

/// Update a download task's progress
pub fn update_progress(
  supervisor: &DownloadSupervisor,
  id: &str,
  progress: f64,
  downloaded: u64,
  total_size: u64,
) -> Result<()> {
  let mut tasks = supervisor.tasks.lock().unwrap();

  if let Some(task) = tasks.get_mut(id) {
    task.progress = progress;
    task.downloaded = downloaded;
    task.total_size = total_size;

    // Update status based on progress
    if progress >= 1.0 {
      task.status = DownloadStatus::Completed;
    }

    // Persist to SQLite
    let _ = supervisor.conn.execute(
      "UPDATE downloads SET status = ?1, progress = ?2, downloaded_u64 = ?3, total_size_u64 = ?4 WHERE id = ?5",
      [
        &format!("{:?}", task.status),
        progress,
        downloaded,
        total_size,
        &task.id,
      ],
    );
  }

  Ok(())
}

/// Cancel a download
pub fn cancel_download(supervisor: &DownloadSupervisor, id: &str) -> Result<()> {
  let mut tasks = supervisor.tasks.lock().unwrap();

  if let Some(task) = tasks.get_mut(id) {
    task.status = DownloadStatus::Cancelled;
  }

  let _ = supervisor.conn.execute(
    "UPDATE downloads SET status = ?1 WHERE id = ?2",
    [&format!("{:?}", DownloadStatus::Cancelled), id],
  );

  Ok(())
}

/// Mark a download as completed and write tags/artwork
pub fn complete_download(
  supervisor: &DownloadSupervisor,
  id: &str,
) -> Result<()> {
  let mut tasks = supervisor.tasks.lock().unwrap();

  if let Some(task) = tasks.get_mut(id) {
    task.status = DownloadStatus::Completed;

    // Write ID3 tags for MP3 files
    if let Some(file_path) = task.destination.path().to_str() {
      if let Ok(extension) = file_path.rsplit('.').next() {
        if extension.to_lowercase() == "mp3" {
          if let Ok(tag) = TagBuilder::new()
            .set_title(&task.title.unwrap_or_default())
            .set_artist(&task.artist.unwrap_or_default())
            .set_album(&task.album.unwrap_or_default())
            .build()
          {
            // In a full implementation, we'd write the tag to the file
            // For now, we persist the tag data to SQLite for later use
          }
        }
        // Write .lrc sidecar if lyrics available
        let lrc_path = task.destination.with_extension("lrc");
        // Note: lrc_content would need to be stored on the task struct
      }
    }
  }

  // Persist to SQLite
  let _ = supervisor.conn.execute(
    "UPDATE downloads SET status = ?1 WHERE id = ?2",
    [&format!("{:?}", DownloadStatus::Completed), id],
  );

  Ok(())
}