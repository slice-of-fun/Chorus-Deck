use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

const EV_PROGRESS: &str = "download:progress";
const EV_STATE: &str = "download:state-change";
const EV_BATCH: &str = "download:batch-complete";
const EV_REQUEST_URL: &str = "download:request-url";

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TaskState {
    Queued,
    Downloading,
    Paused,
    Completed,
    Error,
    Cancelled,
}

impl TaskState {
    fn is_terminal(&self) -> bool {
        matches!(
            self,
            TaskState::Completed | TaskState::Error | TaskState::Cancelled
        )
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SongArtist {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SongAlbum {
    pub name: String,
    #[serde(rename = "picUrl", default)]
    pub pic_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SongInfo {
    pub id: String,
    pub name: String,
    #[serde(rename = "picUrl", default)]
    pub pic_url: String,
    #[serde(default)]
    pub ar: Vec<SongArtist>,
    #[serde(default)]
    pub al: SongAlbum,
    #[serde(rename = "mimeType", default, skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
}

impl SongInfo {
    fn artist_name(&self) -> String {
        self.ar
            .iter()
            .map(|a| a.name.clone())
            .collect::<Vec<_>>()
            .join(", ")
    }
}

/// Mirrors `DownloadTask` in `src/shared/download.ts`.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTask {
    pub task_id: String,
    pub url: String,
    pub filename: String,
    pub song_info: SongInfo,
    #[serde(rename = "type", default)]
    pub kind: String,
    pub state: TaskState,
    pub progress: f64,
    pub loaded: u64,
    pub total: u64,
    pub temp_file_path: String,
    pub final_file_path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub created_at: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub batch_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompletedDownload {
    pub file_path: String,
    pub filename: String,
    pub size: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pic_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub song_id: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub ar: Vec<SongArtist>,
    pub created_at: i64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub task_id: String,
    pub progress: f64,
    pub loaded: u64,
    pub total: u64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StateChangeEvent {
    pub task_id: String,
    pub state: TaskState,
    pub task: DownloadTask,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BatchCompleteEvent {
    pub batch_id: String,
    pub total: usize,
    pub success: usize,
    pub failed: usize,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RequestUrlEvent {
    pub task_id: String,
    pub song_info: SongInfo,
}

/// Runtime control flags for an in-flight transfer.
#[derive(Default)]
struct Flags {
    cancel: Arc<AtomicBool>,
    pause: Arc<AtomicBool>,
}

struct Entry {
    task: DownloadTask,
    flags: Flags,
}

pub struct DownloadSupervisor {
    app: AppHandle,
    queue_path: PathBuf,
    completed_path: PathBuf,
    entries: Arc<Mutex<HashMap<String, Entry>>>,
    completed: Arc<Mutex<Vec<CompletedDownload>>>,
    resolved: Arc<Mutex<HashMap<String, String>>>,
    max_concurrent: Arc<Mutex<usize>>,
    active: Arc<Mutex<usize>>,
}

impl DownloadSupervisor {
    pub fn new(app: &AppHandle, base_dir: PathBuf) -> Self {
        let app_data = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| base_dir.clone());
        let _ = std::fs::create_dir_all(&app_data);

        let supervisor = DownloadSupervisor {
            app: app.clone(),
            queue_path: app_data.join("download-queue.json"),
            completed_path: app_data.join("download-completed.json"),
            entries: Arc::new(Mutex::new(HashMap::new())),
            completed: Arc::new(Mutex::new(Vec::new())),
            resolved: Arc::new(Mutex::new(HashMap::new())),
            max_concurrent: Arc::new(Mutex::new(3)),
            active: Arc::new(Mutex::new(0)),
        };
        supervisor.load();
        supervisor
    }

    pub fn downloads_dir(&self) -> PathBuf {
        self.app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join("downloads")
    }

    fn load(&self) {
        if let Ok(raw) = std::fs::read_to_string(&self.queue_path) {
            if let Ok(tasks) = serde_json::from_str::<Vec<DownloadTask>>(&raw) {
                let mut entries = self.entries.lock().unwrap();
                for task in tasks {
                    let mut task = task;
                    if task.state == TaskState::Downloading {
                        task.state = TaskState::Queued;
                    }
                    entries.insert(
                        task.task_id.clone(),
                        Entry {
                            task,
                            flags: Flags::default(),
                        },
                    );
                }
            }
        }
        if let Ok(raw) = std::fs::read_to_string(&self.completed_path) {
            if let Ok(list) = serde_json::from_str::<Vec<CompletedDownload>>(&raw) {
                *self.completed.lock().unwrap() = list;
            }
        }
    }

    fn persist(&self) {
        let entries = self.entries.lock().unwrap();
        let tasks: Vec<DownloadTask> = entries.values().map(|e| e.task.clone()).collect();
        drop(entries);
        if let Ok(json) = serde_json::to_string_pretty(&tasks) {
            let _ = std::fs::write(&self.queue_path, json);
        }
    }

    fn persist_completed(&self) {
        let list = self.completed.lock().unwrap().clone();
        if let Ok(json) = serde_json::to_string_pretty(&list) {
            let _ = std::fs::write(&self.completed_path, json);
        }
    }

    fn emit_state(&self, task_id: &str) {
        let task = {
            let entries = self.entries.lock().unwrap();
            match entries.get(task_id) {
                Some(e) => e.task.clone(),
                None => return,
            }
        };
        let _ = self.app.emit(
            EV_STATE,
            StateChangeEvent {
                task_id: task_id.to_string(),
                state: task.state.clone(),
                task,
            },
        );
    }

    fn set_state(&self, task_id: &str, state: TaskState, error: Option<String>) {
        {
            let mut entries = self.entries.lock().unwrap();
            if let Some(entry) = entries.get_mut(task_id) {
                entry.task.state = state;
                entry.task.error = error;
            }
        }
        self.persist();
        self.emit_state(task_id);
    }

    pub fn add(&self, mut task: DownloadTask) {
        if task.task_id.is_empty() {
            task.task_id = format!("dl-{}", now_ms());
        }
        task.state = TaskState::Queued;
        task.progress = 0.0;
        task.loaded = 0;
        task.created_at = now_ms();

        let temp = task.temp_file_path.clone();
        if temp.is_empty() {
            task.temp_file_path =
                format!("{temp}", temp = format!("{}.part", task.final_file_path));
        }
        if let Some(parent) = PathBuf::from(&task.temp_file_path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let task_id = task.task_id.clone();
        let song_info = task.song_info.clone();
        {
            let mut entries = self.entries.lock().unwrap();
            entries.insert(
                task_id.clone(),
                Entry {
                    task,
                    flags: Flags::default(),
                },
            );
        }
        self.persist();
        self.emit_state(&task_id);
        let _ = self
            .app
            .emit(EV_REQUEST_URL, RequestUrlEvent { task_id, song_info });
    }

    pub fn add_batch(&self, mut tasks: Vec<DownloadTask>) {
        let batch_id = format!("batch-{}", now_ms());
        let total = tasks.len();
        for task in tasks.iter_mut() {
            task.batch_id = Some(batch_id.clone());
        }
        for task in tasks {
            self.add(task);
        }

        // Completion is reported when every task in the batch settles.
        let app = self.app.clone();
        let supervisor_entries = self.entries.clone();
        let bid = batch_id.clone();
        // Poll briefly rather than holding a per-batch watcher.
        std::thread::spawn(move || loop {
            std::thread::sleep(std::time::Duration::from_millis(400));
            let entries = supervisor_entries.lock().unwrap();
            let batch: Vec<&Entry> = entries
                .values()
                .filter(|e| e.task.batch_id.as_deref() == Some(bid.as_str()))
                .collect();
            if batch.is_empty() {
                break;
            }
            if batch.iter().all(|e| e.task.state.is_terminal()) {
                let success = batch
                    .iter()
                    .filter(|e| e.task.state == TaskState::Completed)
                    .count();
                let failed = batch.len() - success;
                drop(entries);
                let _ = app.emit(
                    EV_BATCH,
                    BatchCompleteEvent {
                        batch_id: bid.clone(),
                        total,
                        success,
                        failed,
                    },
                );
                break;
            }
        });
    }

    pub fn get_queue(&self) -> Vec<DownloadTask> {
        self.entries
            .lock()
            .unwrap()
            .values()
            .map(|e| e.task.clone())
            .collect()
    }

    pub fn get_completed(&self) -> Vec<CompletedDownload> {
        self.completed.lock().unwrap().clone()
    }

    pub fn set_concurrency(&self, n: usize) {
        *self.max_concurrent.lock().unwrap() = n.clamp(1, 16);
    }

    pub fn provide_url(&self, task_id: &str, url: String) {
        {
            let mut resolved = self.resolved.lock().unwrap();
            resolved.insert(task_id.to_string(), url.clone());
        }
        {
            let mut entries = self.entries.lock().unwrap();
            if let Some(entry) = entries.get_mut(task_id) {
                entry.task.url = url;
            }
        }
        self.spawn_transfer(task_id.to_string());
    }

    pub fn pause(&self, task_id: &str) {
        let flag = {
            let entries = self.entries.lock().unwrap();
            match entries.get(task_id) {
                Some(e) => {
                    if e.task.state == TaskState::Downloading {
                        e.flags.pause.store(true, Ordering::Relaxed);
                    }
                    true
                }
                None => false,
            }
        };
        if flag {
            self.set_state(task_id, TaskState::Paused, None);
        }
    }

    pub fn resume(&self, task_id: &str) {
        {
            let mut entries = self.entries.lock().unwrap();
            match entries.get_mut(task_id) {
                Some(e) => {
                    e.flags.pause.store(false, Ordering::Relaxed);
                    e.flags.cancel.store(false, Ordering::Relaxed);
                }
                None => return,
            }
        }
        self.set_state(task_id, TaskState::Queued, None);
        let _ = self.app.emit(
            EV_REQUEST_URL,
            RequestUrlEvent {
                task_id: task_id.to_string(),
                song_info: self
                    .entries
                    .lock()
                    .unwrap()
                    .get(task_id)
                    .map(|e| e.task.song_info.clone())
                    .unwrap_or_default(),
            },
        );
    }

    pub fn cancel(&self, task_id: &str) {
        let temp = {
            let mut entries = self.entries.lock().unwrap();
            match entries.get_mut(task_id) {
                Some(e) => {
                    e.flags.cancel.store(true, Ordering::Relaxed);
                    e.task.temp_file_path.clone()
                }
                None => return,
            }
        };
        if !temp.is_empty() {
            let _ = std::fs::remove_file(&temp);
        }
        self.set_state(task_id, TaskState::Cancelled, None);
    }

    pub fn cancel_all(&self) {
        let ids: Vec<String> = self
            .entries
            .lock()
            .unwrap()
            .values()
            .filter(|e| !e.task.state.is_terminal())
            .map(|e| e.task.task_id.clone())
            .collect();
        for id in ids {
            self.cancel(&id);
        }
    }

    pub fn clear_completed(&self) {
        {
            let mut entries = self.entries.lock().unwrap();
            entries.retain(|_, e| e.task.state != TaskState::Completed);
        }
        self.persist();
    }

    pub fn delete_completed(&self, file_path: &str) -> Result<(), String> {
        let _ = std::fs::remove_file(file_path);
        {
            let mut list = self.completed.lock().unwrap();
            let before = list.len();
            list.retain(|c| c.file_path != file_path);
            if list.len() == before {
                return Err(format!("not found: {file_path}"));
            }
        }
        self.persist_completed();
        {
            let mut entries = self.entries.lock().unwrap();
            entries.retain(|_, e| e.task.final_file_path != file_path);
        }
        self.persist();
        Ok(())
    }

    fn spawn_transfer(&self, task_id: String) {
        {
            let active = self.active.lock().unwrap();
            let cap = *self.max_concurrent.lock().unwrap();
            if *active >= cap {
                return;
            }
        }
        *self.active.lock().unwrap() += 1;

        let ctx = TransferCtx {
            app: self.app.clone(),
            entries: Arc::clone(&self.entries),
            completed: Arc::clone(&self.completed),
            resolved: Arc::clone(&self.resolved),
            max_concurrent: Arc::clone(&self.max_concurrent),
            active: Arc::clone(&self.active),
        };

        tauri::async_runtime::spawn(async move {
            run_transfer(ctx, task_id).await;
        });
    }
}

struct TransferCtx {
    app: AppHandle,
    entries: Arc<Mutex<HashMap<String, Entry>>>,
    completed: Arc<Mutex<Vec<CompletedDownload>>>,
    resolved: Arc<Mutex<HashMap<String, String>>>,
    max_concurrent: Arc<Mutex<usize>>,
    active: Arc<Mutex<usize>>,
}

async fn run_transfer(ctx: TransferCtx, task_id: String) {
    let app = ctx.app.clone();
    let entries = ctx.entries.clone();

    let (url, temp_path, final_path, cancel, pause, song_info) = {
        let mut map = ctx.entries.lock().unwrap();
        let Some(entry) = map.get_mut(&task_id) else {
            return;
        };
        if entry.task.state.is_terminal() {
            return;
        }
        entry.task.state = TaskState::Downloading;
        entry.task.error = None;
        let url = ctx
            .resolved
            .lock()
            .unwrap()
            .get(&task_id)
            .cloned()
            .unwrap_or_else(|| entry.task.url.clone());
        (
            url,
            PathBuf::from(&entry.task.temp_file_path),
            PathBuf::from(&entry.task.final_file_path),
            Arc::clone(&entry.flags.cancel),
            Arc::clone(&entry.flags.pause),
            entry.task.song_info.clone(),
        )
    };

    if url.is_empty() {
        set_error(&ctx, &task_id, "no resolved url".into());
        return;
    }

    let already = std::fs::metadata(&temp_path).map(|m| m.len()).unwrap_or(0);

    let client = reqwest::Client::new();
    let mut request = client.get(&url);
    if already > 0 {
        request = request.header(reqwest::header::RANGE, format!("bytes={already}-"));
    }

    let response = match request.send().await {
        Ok(r) => r,
        Err(e) => {
            set_error(&ctx, &task_id, format!("request failed: {e}"));
            return;
        }
    };

    if response.status() == reqwest::StatusCode::RANGE_NOT_SATISFIABLE {
        let _ = std::fs::remove_file(&temp_path);
        set_error(&ctx, &task_id, "range not satisfiable".into());
        return;
    }

    if !response.status().is_success() {
        set_error(&ctx, &task_id, format!("http status {}", response.status()));
        return;
    }

    let total = response.content_length().map(|c| c + already).unwrap_or(0);
    if let Some(entry) = ctx.entries.lock().unwrap().get_mut(&task_id) {
        entry.task.total = total;
    }

    if let Some(parent) = final_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let file = std::fs::OpenOptions::new()
        .create(true)
        .append(already > 0)
        .write(true)
        .open(&temp_path);

    let mut file = match file {
        Ok(f) => f,
        Err(e) => {
            set_error(&ctx, &task_id, format!("cannot open temp file: {e}"));
            return;
        }
    };

    use std::io::Write;
    let mut stream = response.bytes_stream();
    let mut loaded = already;
    let mut last_emit = std::time::Instant::now();

    while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::Relaxed) || pause.load(Ordering::Relaxed) {
            // Leave the temp file in place so resume can continue from here.
            drop(file);
            emit_state_from(&app, &entries, &task_id);
            return;
        }
        let bytes = match chunk {
            Ok(b) => b,
            Err(e) => {
                set_error(&ctx, &task_id, format!("download error: {e}"));
                return;
            }
        };
        if let Err(e) = file.write_all(&bytes) {
            set_error(&ctx, &task_id, format!("write failed: {e}"));
            return;
        }
        loaded += bytes.len() as u64;

        let progress = if total > 0 {
            (loaded as f64 / total as f64).clamp(0.0, 1.0)
        } else {
            0.0
        };
        if let Some(entry) = ctx.entries.lock().unwrap().get_mut(&task_id) {
            entry.task.loaded = loaded;
            entry.task.total = total;
            entry.task.progress = progress;
        }

        if last_emit.elapsed() >= std::time::Duration::from_millis(200) {
            last_emit = std::time::Instant::now();
            let _ = app.emit(
                EV_PROGRESS,
                ProgressEvent {
                    task_id: task_id.clone(),
                    progress,
                    loaded,
                    total,
                },
            );
        }
    }

    if let Err(e) = file.flush() {
        set_error(&ctx, &task_id, format!("flush failed: {e}"));
        return;
    }
    drop(file);

    if let Err(e) = std::fs::rename(&temp_path, &final_path) {
        set_error(&ctx, &task_id, format!("rename failed: {e}"));
        return;
    }

    let size = std::fs::metadata(&final_path).map(|m| m.len()).unwrap_or(0);
    {
        let mut map = ctx.entries.lock().unwrap();
        if let Some(entry) = map.get_mut(&task_id) {
            entry.task.state = TaskState::Completed;
            entry.task.progress = 1.0;
            entry.task.loaded = size;
            entry.task.total = size;
        }
    }
    {
        let mut list = ctx.completed.lock().unwrap();
        if !list
            .iter()
            .any(|c| c.file_path == final_path.to_string_lossy())
        {
            list.push(CompletedDownload {
                file_path: final_path.to_string_lossy().to_string(),
                filename: final_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default(),
                size,
                pic_url: Some(song_info.pic_url.clone()).filter(|s| !s.is_empty()),
                song_id: Some(song_info.id.clone()).filter(|s| !s.is_empty()),
                ar: song_info.ar.clone(),
                created_at: now_ms(),
            });
        }
    }
    ctx.resolved.lock().unwrap().remove(&task_id);

    emit_state_from(&app, &entries, &task_id);
    spawn_next(&ctx);
}

fn set_error(ctx: &TransferCtx, task_id: &str, message: String) {
    if let Some(entry) = ctx.entries.lock().unwrap().get_mut(task_id) {
        entry.task.state = TaskState::Error;
        entry.task.error = Some(message);
    }
    ctx.resolved.lock().unwrap().remove(task_id);
    emit_state_from(&ctx.app, &ctx.entries, task_id);
    spawn_next(ctx);
}

fn emit_state_from(app: &AppHandle, entries: &Arc<Mutex<HashMap<String, Entry>>>, task_id: &str) {
    let task = {
        let map = entries.lock().unwrap();
        match map.get(task_id) {
            Some(e) => e.task.clone(),
            None => return,
        }
    };
    let _ = app.emit(
        EV_STATE,
        StateChangeEvent {
            task_id: task_id.to_string(),
            state: task.state.clone(),
            task,
        },
    );
}

fn spawn_next(ctx: &TransferCtx) {
    let next = {
        let active = ctx.active.lock().unwrap();
        let cap = *ctx.max_concurrent.lock().unwrap();
        if *active >= cap {
            return;
        }
        let map = ctx.entries.lock().unwrap();
        map.values()
            .find(|e| e.task.state == TaskState::Queued)
            .map(|e| (e.task.task_id.clone(), e.task.song_info.clone()))
    };
    if let Some((task_id, song_info)) = next {
        let _ = ctx
            .app
            .emit(EV_REQUEST_URL, RequestUrlEvent { task_id, song_info });
    }
}

pub fn build_filename(format: &str, separator: &str, song: &SongInfo) -> String {
    let mut out = format.to_string();
    out = out.replace("{songName}", &song.name);
    out = out.replace("{artistName}", &song.artist_name());
    out = out.replace("{albumName}", &song.al.name);
    let illegal: &[char] = &['\\', '/', ':', '*', '?', '"', '<', '>', '|'];
    out = out
        .chars()
        .map(|c| if illegal.contains(&c) { '_' } else { c })
        .collect::<String>()
        .trim()
        .to_string();
    if out.is_empty() {
        out = format!("{}{}{}", song.name, separator, song.artist_name());
    }
    out
}
