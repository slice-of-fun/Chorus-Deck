use rodio::{Decoder, OutputStream, Sink};
use std::io::{Cursor, Read, Seek, SeekFrom};
use std::fs::{File, OpenOptions};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};
use sha2::{Sha256, Digest};
use futures_util::StreamExt;
use std::io::Write;

use crate::commands::eq::{EqCommand, EqSource};
use std::sync::mpsc::Sender;

pub struct AudioPlayer {
    pub sink: Sink,
    pub duration: Option<f32>,
    pub eq_tx: Option<Sender<EqCommand>>,
}

impl AudioPlayer {
    pub fn new() -> Result<Self, String> {
        let (tx, rx) = std::sync::mpsc::channel();
        thread::spawn(move || {
            match OutputStream::try_default() {
                Ok((_stream, handle)) => {
                    match Sink::try_new(&handle) {
                        Ok(sink) => {
                            let _ = tx.send(Ok(sink));
                            loop {
                                thread::park();
                            }
                        }
                        Err(e) => {
                            let _ = tx.send(Err(format!("Sink error: {}", e)));
                        }
                    }
                }
                Err(e) => {
                    let _ = tx.send(Err(format!("OutputStream error: {}", e)));
                }
            }
        });
        
        let sink = rx.recv().map_err(|e| e.to_string())??;
        Ok(Self { sink, duration: None, eq_tx: None })
    }
}

pub struct AudioState(pub Mutex<Option<AudioPlayer>>);

pub struct StreamingReader {
    file: File,
    downloaded_bytes: Arc<AtomicU64>,
    is_finished: Arc<AtomicBool>,
    pos: u64,
    file_size: Option<u64>,
}

impl Read for StreamingReader {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        loop {
            let available = self.downloaded_bytes.load(Ordering::Acquire);
            let finished = self.is_finished.load(Ordering::Acquire);
            
            if self.pos < available {
                let to_read = (available - self.pos).min(buf.len() as u64) as usize;
                self.file.seek(SeekFrom::Start(self.pos))?;
                let n = self.file.read(&mut buf[..to_read])?;
                self.pos += n as u64;
                return Ok(n);
            } else if finished {
                return Ok(0); // EOF
            } else {
                // If we reach the end of what's currently downloaded but it's not finished, wait.
                // It might block the decoder thread, which is fine since we are buffering.
                std::thread::sleep(Duration::from_millis(10));
            }
        }
    }
}

impl Seek for StreamingReader {
    fn seek(&mut self, pos: SeekFrom) -> std::io::Result<u64> {
        let new_pos = match pos {
            SeekFrom::Start(p) => p,
            SeekFrom::End(p) => {
                let end = self.file_size.unwrap_or_else(|| self.downloaded_bytes.load(Ordering::Acquire));
                (end as i64 + p).max(0) as u64
            }
            SeekFrom::Current(p) => (self.pos as i64 + p).max(0) as u64,
        };
        self.pos = new_pos;
        Ok(self.pos)
    }
}

fn manage_audio_cache(app: AppHandle, cache_dir: std::path::PathBuf, max_bytes: u64) {
    tauri::async_runtime::spawn_blocking(move || {
        let app_state = app.state::<crate::commands::AppState>();
        
        let mut total_size = 0;
        
        if let Ok(entries) = std::fs::read_dir(&cache_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() { continue; }
                
                if path.extension().and_then(|s| s.to_str()) == Some("tmp") {
                    if let Ok(metadata) = entry.metadata() {
                        if let Ok(modified) = metadata.modified() {
                            if let Ok(age) = modified.elapsed() {
                                if age.as_secs() > 86400 {
                                    let _ = std::fs::remove_file(&path);
                                }
                            }
                        }
                    }
                    continue;
                }
                
                if path.extension().and_then(|s| s.to_str()) == Some("audio") {
                    if let Ok(metadata) = entry.metadata() {
                        total_size += metadata.len();
                    }
                }
            }
        }
        
        if total_size <= max_bytes {
            return;
        }
        
        let mut current_size = total_size;
        let mut db = app_state.db.lock().unwrap();
        
        if let Ok(candidates) = crate::db::music_db::get_audio_cache_eviction_candidates(&db) {
            for (hash, size) in candidates {
                if current_size <= max_bytes {
                    break;
                }
                
                let file_path = cache_dir.join(format!("{}.audio", hash));
                if std::fs::remove_file(&file_path).is_ok() || !file_path.exists() {
                    current_size = current_size.saturating_sub(size);
                    let _ = crate::db::music_db::delete_audio_cache_record(&db, &hash);
                    println!("Evicted cache file: {:?}", file_path);
                }
            }
        }
    });
}

#[tauri::command(rename = "audio-play")]
pub async fn audio_play(app: AppHandle, state: State<'_, AudioState>, url: String) -> Result<(), String> {
    println!("Loading audio from URL: {}", url);
    let mut hasher = Sha256::new();
    hasher.update(url.as_bytes());
    let hash = hex::encode(hasher.finalize());
    
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("audio_cache");
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    
    manage_audio_cache(app.clone(), cache_dir.clone(), 1024 * 1024 * 1024);
    
    let file_path = cache_dir.join(format!("{}.audio", hash));
    let tmp_file_path = cache_dir.join(format!("{}.tmp", hash));
    
    let downloaded_bytes = Arc::new(AtomicU64::new(0));
    let is_finished = Arc::new(AtomicBool::new(false));
    let mut expected_size = None;

    let read_file_path = if file_path.exists() && std::fs::metadata(&file_path).map(|m| m.len()).unwrap_or(0) > 0 {
        let size = std::fs::metadata(&file_path).map(|m| m.len()).unwrap_or(0);
        downloaded_bytes.store(size, Ordering::Release);
        is_finished.store(true, Ordering::Release);
        expected_size = Some(size);
        println!("Playing from local cache: {:?}", file_path);
        file_path.clone()
    } else {
        let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
        expected_size = response.content_length();
        
        let mut file = OpenOptions::new().create(true).write(true).truncate(true).open(&tmp_file_path).map_err(|e| e.to_string())?;
        
        let downloaded_bytes_clone = downloaded_bytes.clone();
        let is_finished_clone = is_finished.clone();
        let final_path = file_path.clone();
        let tmp_path = tmp_file_path.clone();
        
        tauri::async_runtime::spawn(async move {
            let mut stream = response.bytes_stream();
            let mut total = 0;
            let mut success = true;
            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(data) => {
                        if let Ok(_) = file.write_all(&data) {
                            total += data.len() as u64;
                            downloaded_bytes_clone.store(total, Ordering::Release);
                        } else {
                            success = false;
                            break;
                        }
                    }
                    Err(_) => {
                        success = false;
                        break;
                    }
                }
            }
            is_finished_clone.store(true, Ordering::Release);
            if success {
                let _ = std::fs::rename(tmp_path, final_path);
            }
        });
        
        println!("Streaming from network to cache: {:?}", tmp_file_path);
        tokio::time::sleep(Duration::from_millis(200)).await;
        tmp_file_path.clone()
    };
    
    let accessed_at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;
    let size_to_record = expected_size.unwrap_or(0);
    if size_to_record > 0 {
        let app_state = app.state::<crate::commands::AppState>();
        if let Ok(db) = app_state.db.lock() {
            let _ = crate::db::music_db::record_audio_cache_access(&db, &hash, size_to_record, accessed_at);
        }
    }

    let read_file = OpenOptions::new().read(true).open(&read_file_path).map_err(|e| e.to_string())?;
    let reader = StreamingReader {
        file: read_file,
        downloaded_bytes,
        is_finished,
        pos: 0,
        file_size: expected_size,
    };
    
    let source = Decoder::new(reader).map_err(|e| e.to_string())?;
    use rodio::Source;
    let duration = source.total_duration().map(|d| d.as_secs_f32());
    
    let mut player_lock = state.0.lock().unwrap();
    let mut player = AudioPlayer::new()?;
    player.duration = duration;
    
    let (eq_tx, eq_rx) = std::sync::mpsc::channel();
    let eq_source = EqSource::new(source.convert_samples::<f32>(), eq_rx);
    player.eq_tx = Some(eq_tx);
    
    player.sink.append(eq_source);
    player.sink.play();
    
    *player_lock = Some(player);

    crate::smtc::windows_smtc::update_smtc_position(0.0);
    println!("Playback started via Rust Native Engine!");
    Ok(())
}

#[tauri::command(rename = "audio-pause")]
pub fn audio_pause(state: State<'_, AudioState>) -> Result<(), String> {
    if let Some(player) = state.0.lock().unwrap().as_ref() {
        player.sink.pause();
        let pos = player.sink.get_pos().as_secs_f32();
        crate::smtc::windows_smtc::update_smtc_position(pos);
        crate::commands::discord::set_discord_playing_state(false);
    }
    Ok(())
}

#[tauri::command(rename = "audio-resume")]
pub fn audio_resume(state: State<'_, AudioState>) -> Result<(), String> {
    if let Some(player) = state.0.lock().unwrap().as_ref() {
        player.sink.play();
        let pos = player.sink.get_pos().as_secs_f32();
        crate::smtc::windows_smtc::update_smtc_position(pos);
        crate::commands::discord::set_discord_playing_state(true);
    }
    Ok(())
}

#[tauri::command(rename = "audio-stop")]
pub fn audio_stop(state: State<'_, AudioState>) -> Result<(), String> {
    let mut player_lock = state.0.lock().unwrap();
    if let Some(player) = player_lock.as_ref() {
        player.sink.stop();
        let _ = crate::commands::discord::clear_discord_presence();
    }
    *player_lock = None;
    Ok(())
}

#[tauri::command(rename = "audio-set-volume")]
pub fn audio_set_volume(state: State<'_, AudioState>, volume: f32) -> Result<(), String> {
    if let Some(player) = state.0.lock().unwrap().as_ref() {
        player.sink.set_volume(volume);
    }
    Ok(())
}

#[tauri::command(rename = "audio-seek")]
pub fn audio_seek(state: State<'_, AudioState>, time_secs: f32) -> Result<(), String> {
    if let Some(player) = state.0.lock().unwrap().as_ref() {
        let duration = std::time::Duration::from_secs_f32(time_secs.max(0.0));
        let _ = player.sink.try_seek(duration);
        crate::smtc::windows_smtc::update_smtc_position(time_secs);
    }
    Ok(())
}

#[tauri::command(rename = "audio-get-time")]
pub fn audio_get_time(state: State<'_, AudioState>) -> Result<f32, String> {
    if let Some(player) = state.0.lock().unwrap().as_ref() {
        Ok(player.sink.get_pos().as_secs_f32())
    } else {
        Ok(0.0)
    }
}

#[tauri::command(rename = "audio-get-duration")]
pub fn audio_get_duration(state: State<'_, AudioState>) -> Result<Option<f32>, String> {
    if let Some(player) = state.0.lock().unwrap().as_ref() {
        Ok(player.duration)
    } else {
        Ok(None)
    }
}

#[tauri::command(rename = "audio-set-eq-bypass")]
pub fn audio_set_eq_bypass(state: State<'_, AudioState>, bypass: bool) -> Result<(), String> {
    if let Some(player) = state.0.lock().unwrap().as_ref() {
        if let Some(tx) = &player.eq_tx {
            let _ = tx.send(EqCommand::Bypass(bypass));
        }
    }
    println!("Native EQ bypass set to: {}", bypass);
    Ok(())
}

#[tauri::command(rename = "audio-set-eq-band")]
pub fn audio_set_eq_band(state: State<'_, AudioState>, frequency: f32, gain: f32) -> Result<(), String> {
    if let Some(player) = state.0.lock().unwrap().as_ref() {
        if let Some(tx) = &player.eq_tx {
            let _ = tx.send(EqCommand::Band { frequency, gain });
        }
    }
    println!("Native EQ band set: {}Hz to {}dB", frequency, gain);
    Ok(())
}

#[tauri::command(rename = "audio-clear-cache")]
pub fn audio_clear_cache(app: AppHandle) -> Result<(), String> {
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("audio_cache");
    if cache_dir.exists() {
        let _ = std::fs::remove_dir_all(&cache_dir);
        let _ = std::fs::create_dir_all(&cache_dir);
        println!("Audio cache cleared manually");
    }
    Ok(())
}
