use crate::commands::stream_decoder::StreamDecoder;
use futures_util::StreamExt;
use rodio::{Decoder, OutputStream, Sink, Source};
use std::collections::VecDeque;
use std::io::{Read, Seek, SeekFrom};
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use tauri::{AppHandle, Manager, State};

use crate::commands::eq::{EqCommand, EqSource, FREQUENCIES};
use std::sync::mpsc::Sender;

pub struct AudioPlayer {
    pub sink: Sink,
    pub duration: Option<f32>,
    pub eq_tx: Option<Sender<EqCommand>>,
    stream: Option<Arc<StreamShared>>,
}

pub struct EqState {
    pub bypass: bool,
    pub gains: [f32; 10],
    pub playback_rate: f32,
}

impl Default for EqState {
    fn default() -> Self {
        Self {
            bypass: false,
            gains: [0.0; 10],
            playback_rate: 1.0,
        }
    }
}

impl AudioPlayer {
    pub fn new() -> Result<Self, String> {
        let (tx, rx) = std::sync::mpsc::channel();
        thread::spawn(move || match OutputStream::try_default() {
            Ok((_stream, handle)) => match Sink::try_new(&handle) {
                Ok(sink) => {
                    let _ = tx.send(Ok(sink));
                    loop {
                        thread::park();
                    }
                }
                Err(e) => {
                    let _ = tx.send(Err(format!("Sink error: {}", e)));
                }
            },
            Err(e) => {
                let _ = tx.send(Err(format!("OutputStream error: {}", e)));
            }
        });

        let sink = rx.recv().map_err(|e| e.to_string())??;
        Ok(Self {
            sink,
            duration: None,
            eq_tx: None,
            stream: None,
        })
    }
}

pub struct AudioState {
    pub player: Mutex<Option<AudioPlayer>>,
    pub eq: Mutex<EqState>,
}

const STREAM_BUFFER_LIMIT: usize = 4 * 1024 * 1024;

struct StreamState {
    buf: VecDeque<u8>,
    buf_start: u64,
    eof: bool,
    error: Option<String>,
    total: Option<u64>,
    generation: u64,
    alive: bool,
}

struct StreamShared {
    state: Mutex<StreamState>,
    cond: Condvar,
    url: String,
    cookie: Option<String>,
    user_agent: Option<String>,
}

const DEFAULT_STREAM_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

fn abort_stream(shared: &StreamShared) {
    let mut s = shared.state.lock().unwrap();
    s.alive = false;
    s.generation += 1;
    drop(s);
    shared.cond.notify_all();
}
fn stream_length(shared: &StreamShared) -> Option<u64> {
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(15);
    let mut s = shared.state.lock().unwrap();

    while s.total.is_none() && !s.eof && s.error.is_none() && s.alive {
        let remaining = deadline.saturating_duration_since(std::time::Instant::now());
        if remaining.is_zero() {
            break;
        }
        let (guard, _) = shared.cond.wait_timeout(s, remaining).unwrap();
        s = guard;
    }

    s.total
}

fn spawn_producer(shared: Arc<StreamShared>, generation: u64) {
    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::new();

        let (start, total) = {
            let s = shared.state.lock().unwrap();
            if !s.alive || s.generation != generation {
                return;
            }
            (s.buf_start + s.buf.len() as u64, s.total)
        };

        if total.map(|total| start >= total).unwrap_or(false) {
            let mut s = shared.state.lock().unwrap();
            if s.alive && s.generation == generation {
                s.eof = true;
            }
            drop(s);
            shared.cond.notify_all();
            return;
        }

        let mut req = client.get(&shared.url);
        if let Some(c) = &shared.cookie {
            req = req.header(reqwest::header::COOKIE, c);
        }
        if let Some(ua) = &shared.user_agent {
            req = req.header(reqwest::header::USER_AGENT, ua);
        }
        req = req.header(reqwest::header::RANGE, format!("bytes={}-", start));

        let response = match req.send().await {
            Ok(r) => r,
            Err(e) => {
                let mut s = shared.state.lock().unwrap();
                if s.alive && s.generation == generation {
                    s.error = Some(format!("Request failed: {}", e));
                }
                drop(s);
                shared.cond.notify_all();
                return;
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            let mut s = shared.state.lock().unwrap();
            if s.alive && s.generation == generation {
                s.error = Some(format!(
                    "Stream request failed with status {} (URL expired or rate limited)",
                    status
                ));
            }
            drop(s);
            shared.cond.notify_all();
            return;
        }

        let total = response
            .headers()
            .get(reqwest::header::CONTENT_RANGE)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.rsplit('/').next())
            .and_then(|v| v.trim().parse::<u64>().ok())
            .or_else(|| response.content_length().map(|len| len + start));

        {
            let mut s = shared.state.lock().unwrap();
            if s.alive && s.generation == generation && s.total.is_none() {
                s.total = total;
            }
        }
        shared.cond.notify_all();

        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = match chunk {
                Ok(c) => c,
                Err(e) => {
                    let mut s = shared.state.lock().unwrap();
                    if s.alive && s.generation == generation {
                        s.error = Some(format!("Stream read failed: {}", e));
                    }
                    drop(s);
                    shared.cond.notify_all();
                    return;
                }
            };

            let mut s = shared.state.lock().unwrap();
            while s.buf.len() >= STREAM_BUFFER_LIMIT && s.alive && s.generation == generation {
                s = shared.cond.wait(s).unwrap();
            }

            if !s.alive || s.generation != generation {
                return;
            }

            s.buf.extend(chunk);
            drop(s);
            shared.cond.notify_all();
        }

        let mut s = shared.state.lock().unwrap();
        if s.alive && s.generation == generation {
            s.eof = true;
        }
        drop(s);
        shared.cond.notify_all();
    });
}
struct HttpStreamSource {
    shared: Arc<StreamShared>,
    pos: u64,
}

impl HttpStreamSource {
    fn start(url: String, cookie: Option<String>, user_agent: Option<String>) -> Self {
        let shared = Arc::new(StreamShared {
            state: Mutex::new(StreamState {
                buf: VecDeque::new(),
                buf_start: 0,
                eof: false,
                error: None,
                total: None,
                generation: 0,
                alive: true,
            }),
            cond: Condvar::new(),
            url,
            cookie,
            user_agent: Some(
                user_agent
                    .filter(|ua| !ua.trim().is_empty())
                    .unwrap_or_else(|| DEFAULT_STREAM_USER_AGENT.to_string()),
            ),
        });

        spawn_producer(shared.clone(), 0);

        Self { shared, pos: 0 }
    }

    fn rebase(&self, target: u64) -> u64 {
        let mut s = self.shared.state.lock().unwrap();
        s.buf.clear();
        s.buf_start = target;
        s.eof = false;
        s.error = None;
        s.generation += 1;
        s.generation
    }
}

impl Read for HttpStreamSource {
    fn read(&mut self, out: &mut [u8]) -> std::io::Result<usize> {
        if out.is_empty() {
            return Ok(0);
        }

        let mut s = self.shared.state.lock().unwrap();

        loop {
            if !s.alive {
                return Ok(0);
            }

            let end = s.buf_start + s.buf.len() as u64;

            if self.pos < end {
                let offset = (self.pos - s.buf_start) as usize;
                let n = ((end - self.pos) as usize).min(out.len());
                let buf = s.buf.make_contiguous();
                out[..n].copy_from_slice(&buf[offset..offset + n]);
                self.pos += n as u64;

                if self.pos > s.buf_start {
                    let drop_n = (self.pos - s.buf_start) as usize;
                    s.buf.drain(..drop_n);
                    s.buf_start = self.pos;
                }
                drop(s);
                self.shared.cond.notify_all();

                return Ok(n);
            }

            if let Some(err) = s.error.clone() {
                return Err(std::io::Error::new(std::io::ErrorKind::Other, err));
            }

            if s.eof {
                if s.total.is_none() {
                    s.total = Some(self.pos);
                }
                return Ok(0);
            }

            s = self.shared.cond.wait(s).unwrap();
        }
    }
}

impl Seek for HttpStreamSource {
    fn seek(&mut self, to: SeekFrom) -> std::io::Result<u64> {
        let target = {
            let mut s = self.shared.state.lock().unwrap();

            if matches!(to, SeekFrom::End(_)) && s.total.is_none() {
                let deadline = std::time::Instant::now() + std::time::Duration::from_secs(15);
                while s.total.is_none() && !s.eof && s.error.is_none() && s.alive {
                    let remaining = deadline.saturating_duration_since(std::time::Instant::now());
                    if remaining.is_zero() {
                        break;
                    }
                    let (guard, _) = self.shared.cond.wait_timeout(s, remaining).unwrap();
                    s = guard;
                }
            }

            match to {
                SeekFrom::Start(p) => p,
                SeekFrom::End(p) => {
                    let end = s.total.ok_or_else(|| {
                        std::io::Error::new(
                            std::io::ErrorKind::Unsupported,
                            "stream length is not known until the first response headers arrive",
                        )
                    })?;
                    (end as i64 + p).max(0) as u64
                }
                SeekFrom::Current(p) => (self.pos as i64 + p).max(0) as u64,
            }
        };

        {
            let mut s = self.shared.state.lock().unwrap();
            let end = s.buf_start + s.buf.len() as u64;
            if target >= s.buf_start && target <= end {
                self.pos = target;
                return Ok(target);
            }

            if s.total.map(|total| target >= total).unwrap_or(false) {
                s.buf.clear();
                s.buf_start = target;
                s.eof = true;
                s.error = None;
                s.generation += 1;
                self.pos = target;
                drop(s);
                self.shared.cond.notify_all();
                return Ok(target);
            }
        }

        let generation = self.rebase(target);

        self.pos = target;
        self.shared.cond.notify_all();
        spawn_producer(self.shared.clone(), generation);

        Ok(target)
    }
}

enum ContainerPlan {
    Mp4,
    Sniff,
}
fn container_plan(hint: Option<&str>) -> Result<ContainerPlan, String> {
    let normalized = hint.map(|c| {
        let subtype = c.split(';').next().unwrap_or(c).trim();
        subtype
            .rsplit('/')
            .next()
            .unwrap_or(subtype)
            .trim()
            .to_ascii_lowercase()
    });

    match normalized.as_deref() {
        None => Ok(ContainerPlan::Mp4),
        Some("m4a") | Some("mp4") | Some("m4v") | Some("aac") | Some("mp4a") => {
            Ok(ContainerPlan::Mp4)
        }
        Some("webm") | Some("opus") | Some("ogg") => {
            Err("audio/webm (Opus) is not supported by the decoder".to_string())
        }
        Some(_) => Ok(ContainerPlan::Sniff),
    }
}

#[tauri::command(rename = "audio-play")]
pub async fn audio_play(
    state: State<'_, AudioState>,
    url: String,
    cookie: Option<String>,
    duration_ms: Option<f64>,
    container: Option<String>,
    user_agent: Option<String>,
) -> Result<(), String> {
    println!("Streaming audio from URL: {}", url);

    {
        let mut player_lock = state.player.lock().unwrap();
        if let Some(prev) = player_lock.as_ref() {
            if let Some(shared) = &prev.stream {
                abort_stream(shared);
            }
        }
        *player_lock = None;
    }

    let hint_container = container.map(|c| c.to_ascii_lowercase());

    let (source, shared) = tauri::async_runtime::spawn_blocking(move || {
        let reader = HttpStreamSource::start(url, cookie, user_agent);
        let shared = reader.shared.clone();

        let plan = match container_plan(hint_container.as_deref()) {
            Ok(plan) => plan,
            Err(msg) => {
                let mut s = shared.state.lock().unwrap();
                s.error = Some(msg.clone());
                drop(s);
                shared.cond.notify_all();
                return Err(msg);
            }
        };

        let is_mp4 = matches!(plan, ContainerPlan::Mp4);

        let built: Result<Box<dyn Source<Item = i16> + Send>, String> = if is_mp4 {
            let for_length = shared.clone();
            StreamDecoder::new(reader, "m4a", move || stream_length(&for_length))
                .map(|d| Box::new(d) as Box<dyn Source<Item = i16> + Send>)
                .map_err(|e| format!("Decode error: {}", e))
        } else {
            Decoder::new(reader)
                .map(|d| Box::new(d) as Box<dyn Source<Item = i16> + Send>)
                .map_err(|e| format!("Decode error: {}", e))
        };

        match built {
            Ok(source) => Ok((source, shared)),
            Err(e) => {
                abort_stream(&shared);
                Err(e)
            }
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    let duration = match duration_ms {
        Some(ms) if ms > 0.0 => Some((ms / 1000.0) as f32),
        _ => source.total_duration().map(|d| d.as_secs_f32()),
    };

    let mut player_lock = state.player.lock().unwrap();
    let mut player = AudioPlayer::new()?;
    player.duration = duration;
    player.stream = Some(shared);

    let (eq_tx, eq_rx) = std::sync::mpsc::channel();
    let eq_source = EqSource::new(source.convert_samples::<f32>(), eq_rx);
    player.eq_tx = Some(eq_tx.clone());

    player.sink.append(eq_source);
    player.sink.play();

    {
        let eq_state = state.eq.lock().unwrap();
        let _ = eq_tx.send(EqCommand::Bypass(eq_state.bypass));
        for (i, &freq) in FREQUENCIES.iter().enumerate() {
            let gain = eq_state.gains[i];
            if gain.abs() > 0.001 {
                let _ = eq_tx.send(EqCommand::Band {
                    frequency: freq,
                    gain,
                });
            }
        }
        player.sink.set_speed(eq_state.playback_rate);
    }

    *player_lock = Some(player);

    crate::smtc::windows_smtc::update_smtc_position(0.0);
    println!("Playback started via Rust Native Engine (streaming, no disk cache)");
    Ok(())
}

#[tauri::command(rename = "audio-pause")]
pub fn audio_pause(state: State<'_, AudioState>) -> Result<(), String> {
    if let Some(player) = state.player.lock().unwrap().as_ref() {
        player.sink.pause();
        let pos = player.sink.get_pos().as_secs_f32();
        crate::smtc::windows_smtc::update_smtc_position(pos);
        crate::commands::discord::set_discord_playing_state(false);
    }
    Ok(())
}

#[tauri::command(rename = "audio-resume")]
pub fn audio_resume(state: State<'_, AudioState>) -> Result<(), String> {
    if let Some(player) = state.player.lock().unwrap().as_ref() {
        player.sink.play();
        let pos = player.sink.get_pos().as_secs_f32();
        crate::smtc::windows_smtc::update_smtc_position(pos);
        crate::commands::discord::set_discord_playing_state(true);
    }
    Ok(())
}

#[tauri::command(rename = "audio-stop")]
pub fn audio_stop(state: State<'_, AudioState>) -> Result<(), String> {
    let mut player_lock = state.player.lock().unwrap();
    if let Some(player) = player_lock.as_ref() {
        player.sink.stop();
        if let Some(shared) = &player.stream {
            abort_stream(shared);
        }
        let _ = crate::commands::discord::clear_discord_presence();
    }
    *player_lock = None;
    Ok(())
}

#[tauri::command(rename = "audio-set-volume")]
pub fn audio_set_volume(state: State<'_, AudioState>, volume: f32) -> Result<(), String> {
    if let Some(player) = state.player.lock().unwrap().as_ref() {
        player.sink.set_volume(volume);
    }
    Ok(())
}

#[tauri::command(rename = "audio-seek")]
pub fn audio_seek(state: State<'_, AudioState>, time_secs: f32) -> Result<(), String> {
    if let Some(player) = state.player.lock().unwrap().as_ref() {
        let duration = std::time::Duration::from_secs_f32(time_secs.max(0.0));
        let _ = player.sink.try_seek(duration);
        crate::smtc::windows_smtc::update_smtc_position(time_secs);
    }
    Ok(())
}

#[tauri::command(rename = "audio-get-time")]
pub fn audio_get_time(state: State<'_, AudioState>) -> Result<f32, String> {
    if let Some(player) = state.player.lock().unwrap().as_ref() {
        Ok(player.sink.get_pos().as_secs_f32())
    } else {
        Ok(0.0)
    }
}

#[tauri::command(rename = "audio-get-duration")]
pub fn audio_get_duration(state: State<'_, AudioState>) -> Result<Option<f32>, String> {
    if let Some(player) = state.player.lock().unwrap().as_ref() {
        Ok(player.duration)
    } else {
        Ok(None)
    }
}

#[tauri::command(rename = "audio-set-eq-bypass")]
pub fn audio_set_eq_bypass(state: State<'_, AudioState>, bypass: bool) -> Result<(), String> {
    state.eq.lock().unwrap().bypass = bypass;
    if let Some(player) = state.player.lock().unwrap().as_ref() {
        if let Some(tx) = &player.eq_tx {
            let _ = tx.send(EqCommand::Bypass(bypass));
        }
    }
    println!("Native EQ bypass set to: {}", bypass);
    Ok(())
}

#[tauri::command(rename = "audio-set-eq-band")]
pub fn audio_set_eq_band(
    state: State<'_, AudioState>,
    frequency: f32,
    gain: f32,
) -> Result<(), String> {
    {
        let mut eq = state.eq.lock().unwrap();
        if let Some(idx) = FREQUENCIES
            .iter()
            .position(|&f| (f - frequency).abs() < 1.0)
        {
            eq.gains[idx] = gain;
        }
    }
    if let Some(player) = state.player.lock().unwrap().as_ref() {
        if let Some(tx) = &player.eq_tx {
            let _ = tx.send(EqCommand::Band { frequency, gain });
        }
    }
    println!("Native EQ band set: {}Hz to {}dB", frequency, gain);
    Ok(())
}

#[tauri::command(rename = "audio-set-playback-rate")]
pub fn audio_set_playback_rate(state: State<'_, AudioState>, rate: f32) -> Result<(), String> {
    let clamped = rate.clamp(0.25, 4.0);
    state.eq.lock().unwrap().playback_rate = clamped;
    if let Some(player) = state.player.lock().unwrap().as_ref() {
        player.sink.set_speed(clamped);
    }
    println!("Native playback rate set to: {}x", clamped);
    Ok(())
}

#[tauri::command(rename = "audio-clear-cache")]
pub fn audio_clear_cache(app: AppHandle) -> Result<(), String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("audio_cache");
    if cache_dir.exists() {
        let _ = std::fs::remove_dir_all(&cache_dir);
        let _ = std::fs::create_dir_all(&cache_dir);
        println!("Audio cache cleared manually");
    }
    Ok(())
}

