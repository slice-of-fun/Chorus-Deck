use std::sync::Mutex;
use std::time::SystemTime;
use serde::Serialize;
use serde_json::json;
use reqwest::Client;
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use tokio::sync::oneshot;
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use lazy_static::lazy_static;
use tokio::runtime::Runtime;

use crate::commands::discord::{
    resolve_image_url, resolve_source_text, to_discord_text, DiscordPresence, APP_ICON_URL,
};

const PAUSE_IMAGE_URL: &str = "https://raw.githubusercontent.com/slice-of-fun/Chorus-Deck/main/resources/paused.png";

type WsStream = tokio_tungstenite::WebSocketStream<
    tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
>;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayStatus {
    pub connected: bool,
    pub last_error: Option<String>,
    pub last_change_at: Option<i64>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

lazy_static! {
    static ref GATEWAY_STATUS: Mutex<GatewayStatus> = Mutex::new(GatewayStatus {
        connected: false,
        last_error: None,
        last_change_at: None,
    });
    /// url -> registered mp: path, so artwork is uploaded to Discord only once.
    static ref ASSET_CACHE: Mutex<std::collections::HashMap<String, String>> =
        Mutex::new(std::collections::HashMap::new());
}

fn set_status(connected: bool, error: Option<&str>) {
    if let Ok(mut status) = GATEWAY_STATUS.lock() {
        let changed = status.connected != connected || status.last_error.as_deref() != error;
        status.connected = connected;
        status.last_error = error.map(|e| e.to_string());
        if changed {
            status.last_change_at = Some(now_ms());
        }
    }
}

#[tauri::command(rename = "discord-gateway-status")]
pub fn discord_gateway_status() -> GatewayStatus {
    GATEWAY_STATUS.lock().map(|s| s.clone()).unwrap_or(GatewayStatus {
        connected: false,
        last_error: None,
        last_change_at: None,
    })
}

pub enum GatewayCmd {
    UpdatePresence {
        presence: DiscordPresence,
        token: String,
        reply: Option<oneshot::Sender<Result<(), String>>>,
    },
    ClearPresence,
    Close,
}

lazy_static! {
    static ref GATEWAY_TX: Mutex<Option<UnboundedSender<GatewayCmd>>> = Mutex::new(None);
    static ref RT: Runtime = Runtime::new().unwrap();
}

pub fn update_presence(presence: DiscordPresence, token: String) {
    send_cmd(GatewayCmd::UpdatePresence { presence, token, reply: None });
}
pub async fn update_presence_acked(
    presence: DiscordPresence,
    token: String,
) -> Result<(), String> {
    let (tx, rx) = oneshot::channel();
    send_cmd(GatewayCmd::UpdatePresence {
        presence,
        token,
        reply: Some(tx),
    });
    match tokio::time::timeout(std::time::Duration::from_secs(20), rx).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => Err("Discord gateway worker dropped the update".to_string()),
        Err(_) => Err("Timed out waiting for the Discord gateway update".to_string()),
    }
}

pub fn clear_presence() {
    send_cmd(GatewayCmd::ClearPresence);
}

pub fn disconnect() {
    send_cmd(GatewayCmd::Close);
}

fn send_cmd(cmd: GatewayCmd) {
    let mut tx_lock = GATEWAY_TX.lock().unwrap();
    if tx_lock.is_none() {
        let (tx, rx) = unbounded_channel();
        RT.spawn(gateway_actor(rx));
        *tx_lock = Some(tx);
    }
    if let Some(tx) = tx_lock.as_ref() {
        let _ = tx.send(cmd);
    }
}

fn recover_last_presence(last: &mut Option<(DiscordPresence, String)>, streak: &mut u32) {
    if *streak >= 3 {
        return;
    }
    *streak += 1;
    if let Some((presence, token)) = last.take() {
        send_cmd(GatewayCmd::UpdatePresence {
            presence,
            token,
            reply: None,
        });
    }
}

async fn register_external_asset(client: &Client, token: &str, url: &str) -> Option<String> {
    if !url.starts_with("http") {
        return Some(url.to_string());
    }
    if url.starts_with("mp:") {
        return Some(url.to_string());
    }

    if let Ok(cache) = ASSET_CACHE.lock() {
        if let Some(cached) = cache.get(url) {
            return Some(cached.clone());
        }
    }

    let auth = if token.contains('.') { token.to_string() } else { format!("Bearer {}", token) };
    let body = json!({ "urls": [url] });

    let res = client.post("https://discord.com/api/v10/applications/1554131750899163186/external-assets")
        .header("Authorization", auth)
        .timeout(std::time::Duration::from_secs(5))
        .json(&body)
        .send()
        .await
        .ok()?;

    let txt = res.text().await.ok()?;
    let arr: serde_json::Value = serde_json::from_str(&txt).ok()?;

    if let Some(arr) = arr.as_array() {
        if let Some(first) = arr.get(0) {
            if let Some(path) = first.get("external_asset_path").and_then(|v| v.as_str()) {
                let asset = format!("mp:{}", path);
                if let Ok(mut cache) = ASSET_CACHE.lock() {
                    cache.insert(url.to_string(), asset.clone());
                }
                return Some(asset);
            }
        }
    }
    None
}

async fn connect_and_identify(
    token: &str,
    heartbeat_interval: &mut tokio::time::Interval,
) -> Result<WsStream, String> {
    let (mut ws, _) = connect_async("wss://gateway.discord.gg/?v=9&encoding=json")
        .await
        .map_err(|e| format!("Failed to connect to Discord gateway: {}", e))?;

    let hello = tokio::time::timeout(std::time::Duration::from_secs(10), ws.next())
        .await
        .map_err(|_| "Timed out waiting for the gateway HELLO".to_string())?;

    let msg = match hello {
        Some(Ok(Message::Text(txt))) => txt,
        _ => return Err("Did not receive the gateway HELLO".to_string()),
    };

    let json: serde_json::Value =
        serde_json::from_str(&msg).map_err(|_| "Invalid gateway HELLO payload".to_string())?;
    if json["op"].as_i64() != Some(10) {
        return Err("Unexpected first gateway payload (expected HELLO)".to_string());
    }

    let hb_interval = json["d"]["heartbeat_interval"].as_u64().unwrap_or(41250);
    *heartbeat_interval = tokio::time::interval(tokio::time::Duration::from_millis(hb_interval));
    heartbeat_interval.tick().await;

    let identify = json!({
        "op": 2,
        "d": {
            "token": token,
            "capabilities": (1 << 4) | (1 << 5) | (1 << 12) | (1 << 16),
            "intents": (1 << 12) | (1 << 18) | (1 << 19) | (1 << 22) | (1 << 23)
                | (1 << 27) | (1 << 28) | (1 << 29),
            "properties": {
                "os": "Windows",
                "browser": "Chorus Deck",
                "device": "PC",
                "browser_user_agent": "Chorus Deck",
                "browser_version": "1.0",
                "client_version": "1.0",
                "client_build_number": 1,
                "native_build_number": 1,
                "release_channel": "unknown"
            }
        }
    });
    ws.send(Message::Text(identify.to_string().into()))
        .await
        .map_err(|e| format!("Failed to send gateway IDENTIFY: {}", e))?;

    Ok(ws)
}

async fn wait_ready(ws: &mut WsStream, seq: &mut Option<i64>) -> Result<(), String> {
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(12);

    loop {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            return Err("Timed out waiting for the Discord gateway READY event".to_string());
        }

        let frame = tokio::time::timeout(remaining, ws.next()).await;
        match frame {
            Ok(Some(Ok(Message::Text(txt)))) => {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&txt) {
                    if let Some(s) = json["s"].as_i64() {
                        *seq = Some(s);
                    }
                    let op = json["op"].as_i64();
                    let event = json["t"].as_str().unwrap_or("");
                    if event == "READY" || event == "RESUMED" {
                        return Ok(());
                    }
                    if op == Some(9) {
                        return Err(
                            "Discord rejected the gateway session (invalid or expired token)"
                                .to_string(),
                        );
                    }
                }
                continue;
            }

            Ok(Some(Ok(Message::Close(frame)))) => {
                return Err(format!(
                    "Discord closed the session before READY: {}",
                    frame
                        .map(|f| format!("{:?}", f))
                        .unwrap_or_else(|| "no close frame".to_string())
                ));
            }
            Ok(Some(Ok(_))) => continue,
            Ok(Some(Err(e))) => return Err(format!("Gateway error before READY: {}", e)),
            Ok(None) => {
                return Err(
                    "Discord closed the connection before READY (no close frame)".to_string(),
                )
            }
            Err(_) => {
                return Err("Timed out waiting for the Discord gateway READY event".to_string())
            }
        }
    }
}

async fn gateway_actor(mut rx: tokio::sync::mpsc::UnboundedReceiver<GatewayCmd>) {
    let mut ws_stream: Option<WsStream> = None;
    let mut active_token: Option<String> = None;
    let client = reqwest::Client::new();

    let mut heartbeat_interval = tokio::time::interval(tokio::time::Duration::from_secs(41));
    heartbeat_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    let mut heartbeat_active = false;
    let mut seq: Option<i64> = None;
    let mut awaiting_ack = false;
    let mut last_presence: Option<(DiscordPresence, String)> = None;
    let mut recovery_streak: u32 = 0;
    let mut last_identify_at: Option<std::time::Instant> = None;

    loop {
        tokio::select! {
            cmd = rx.recv() => {
                match cmd {
                    Some(GatewayCmd::UpdatePresence { presence, token, reply }) => {

                        last_presence = Some((presence.clone(), token.clone()));

                        let mut outcome: Result<(), String> = Ok(());
                        let mut fresh_session = false;
                        if active_token.as_deref() != Some(token.as_str()) {
                            if let Some(mut old) = ws_stream.take() {
                                let _ = old.close(None).await;
                            }
                            heartbeat_active = false;
                            awaiting_ack = false;
                            seq = None;
                            active_token = None;
                        }

                        if ws_stream.is_none() {
                            heartbeat_active = false;
                            awaiting_ack = false;
                            if let Some(prev) = last_identify_at {
                                let gap = std::time::Duration::from_secs(2);
                                let elapsed = prev.elapsed();
                                if elapsed < gap {
                                    tokio::time::sleep(gap - elapsed).await;
                                }
                            }
                            last_identify_at = Some(std::time::Instant::now());
                            match connect_and_identify(&token, &mut heartbeat_interval).await {
                                Ok(ws) => {
                                    ws_stream = Some(ws);
                                    active_token = Some(token.clone());
                                    heartbeat_active = true;
                                    fresh_session = true;
                                }
                                Err(e) => {
                                    active_token = None;
                                    set_status(false, Some(&e));
                                    outcome = Err(e);
                                }
                            }
                        }

                        if outcome.is_ok() && fresh_session {
                            let ready_result = match ws_stream.as_mut() {
                                Some(ws) => wait_ready(ws, &mut seq).await,
                                None => Err("Not connected to the Discord gateway".to_string()),
                            };
                            if let Err(e) = ready_result {
                                ws_stream = None;
                                heartbeat_active = false;
                                awaiting_ack = false;
                                active_token = None;
                                set_status(false, Some(&e));
                                outcome = Err(e);
                            }
                        }

                        if let Err(e) = outcome {
                            if let Some(tx) = reply {
                                let _ = tx.send(Err(e));
                            }
                            continue;
                        }

                        let mut send_err: Option<String> = None;

                        if let Some(ws) = ws_stream.as_mut() {
                            let large_image_type = presence.large_image_type.as_deref().unwrap_or("thumbnail");
                            let large_url = resolve_image_url(large_image_type, presence.large_image_custom_url.as_deref(), &presence);
                            let large_image = if let Some(url) = large_url {
                                register_external_asset(&client, &token, &url).await
                            } else {
                                register_external_asset(&client, &token, APP_ICON_URL).await
                            };
                            
                            let is_playing = presence.is_playing.unwrap_or(false);
                            let small_image_type = presence.small_image_type.as_deref().unwrap_or("artist");
                            let small_url = if !is_playing {
                                Some(PAUSE_IMAGE_URL.to_string())
                            } else {
                                resolve_image_url(small_image_type, presence.small_image_custom_url.as_deref(), &presence)
                            };
                            
                            let small_image = if let Some(url) = small_url {
                                register_external_asset(&client, &token, &url).await
                            } else {
                                None
                            };
                            
                            let type_int = match presence.activity_type.as_deref().unwrap_or("LISTENING").to_uppercase().as_str() {
                                "PLAYING" => 0,
                                "STREAMING" => 1,
                                "LISTENING" => 2,
                                "WATCHING" => 3,
                                "COMPETING" => 5,
                                _ => 2,
                            };
                            
                            let activity_name_pref = presence.activity_name.as_deref().unwrap_or("APP");
                            let resolved_name = resolve_source_text(activity_name_pref, &presence).unwrap_or_else(|| "Chorus Deck".to_string());
                            let mut activity_json = json!({
                                "name": resolved_name,
                                "type": type_int,
                                "application_id": "1554131750899163186",
                                "platform": "desktop"
                            });
                            
                            let details_pref = presence.activity_details.as_deref().unwrap_or("ARTIST");
                            let state_pref = presence.activity_state.as_deref().unwrap_or("ALBUM");
                            
                            let details_txt = to_discord_text(resolve_source_text(details_pref, &presence), 128, presence.title.as_deref());
                            let state_txt = to_discord_text(resolve_source_text(state_pref, &presence), 128, None);
                            
                            if let Some(d) = details_txt { activity_json["details"] = d.into(); }
                            if let Some(s) = state_txt { activity_json["state"] = s.into(); }
                            
                            let mut assets = json!({});
                            if let Some(li) = large_image { assets["large_image"] = li.into(); }
                            let mut large_text_str = presence.album.clone();
                            if large_text_str.is_none() || large_text_str.as_ref().unwrap().is_empty() {
                                large_text_str = presence.title.clone();
                            }
                            if let Some(lt) = to_discord_text(large_text_str, 128, None) {
                                assets["large_text"] = lt.into();
                            }
                            
                            if let Some(si) = small_image { assets["small_image"] = si.into(); }
                            let small_text = if is_playing {
                                let base_text = resolve_source_text(small_image_type, &presence).or_else(|| presence.title.clone()).unwrap_or_else(|| "Music".to_string());
                                Some(format!("Playing {} on Chorus Deck", base_text).chars().take(128).collect::<String>())
                            } else {
                                Some("Paused".to_string())
                            };
                            if let Some(st) = small_text { assets["small_text"] = st.into(); }
                            activity_json["assets"] = assets;
                            
                            if is_playing {
                                if let Some(start) = presence.start_timestamp {
                                    let mut timestamps = json!({ "start": start });
                                    if let Some(duration_ms) = presence.duration {
                                        if duration_ms > 0.0 {
                                            timestamps["end"] = ((start as f64 + duration_ms) as i64).into();
                                        }
                                    }
                                    activity_json["timestamps"] = timestamps;
                                }
                            }
                            
                            let mut buttons = Vec::new();
                            let mut button_urls = Vec::new();
                            
                            if presence.button1_enabled.unwrap_or(true) {
                                if let (Some(label), Some(url)) = (&presence.button1_label, &presence.button1_url) {
                                    if !label.is_empty() && !url.is_empty() && url.starts_with("http") {
                                        buttons.push(label.chars().take(32).collect::<String>());
                                        button_urls.push(url.clone());
                                    }
                                }
                            }
                            
                            if presence.button2_enabled.unwrap_or(false) && buttons.len() < 2 {
                                if let (Some(label), Some(url)) = (&presence.button2_label, &presence.button2_url) {
                                    if !label.is_empty() && !url.is_empty() && url.starts_with("http") {
                                        buttons.push(label.chars().take(32).collect::<String>());
                                        button_urls.push(url.clone());
                                    }
                                }
                            }
                            
                            if !buttons.is_empty() {
                                activity_json["buttons"] = buttons.into();
                                activity_json["metadata"] = json!({ "button_urls": button_urls });
                            }
                            
                            let update_payload = json!({
                                "op": 3,
                                "d": {
                                    "activities": [activity_json],
                                    "afk": false,
                                    "since": serde_json::Value::Null,
                                    "status": "online"
                                }
                            });
                            
                            if ws.send(Message::Text(update_payload.to_string().into())).await.is_err() {
                                send_err = Some("Failed to send the presence update".to_string());
                            }
                        } else {
                            send_err = Some("Not connected to the Discord gateway".to_string());
                        }

                        if let Some(e) = send_err {
                            ws_stream = None;
                            heartbeat_active = false;
                            awaiting_ack = false;
                            active_token = None;
                            set_status(false, Some(&e));
                            recover_last_presence(&mut last_presence, &mut recovery_streak);
                            if let Some(tx) = reply {
                                let _ = tx.send(Err(e));
                            }
                        } else {
                            recovery_streak = 0;
                            set_status(true, None);
                            if let Some(tx) = reply {
                                let _ = tx.send(Ok(()));
                            }
                        }
                    },
                    Some(GatewayCmd::ClearPresence) | Some(GatewayCmd::Close) => {
                        last_presence = None;
                        if matches!(cmd, Some(GatewayCmd::ClearPresence)) {
                            if let Some(mut ws) = ws_stream.take() {
                                let clear = json!({
                                    "op": 3,
                                    "d": {
                                        "activities": [],
                                        "afk": false,
                                        "since": serde_json::Value::Null,
                                        "status": "online"
                                    }
                                });
                                let _ = ws.send(Message::Text(clear.to_string().into())).await;
                                ws_stream = Some(ws);
                            }
                        } else {
                            if let Some(mut ws) = ws_stream.take() {
                                let _ = ws.close(None).await;
                            }
                            heartbeat_active = false;
                            awaiting_ack = false;
                            active_token = None;
                            set_status(false, None);
                        }
                    },
                    None => break,
                }
            },
            
            _ = heartbeat_interval.tick(), if heartbeat_active && ws_stream.is_some() => {
                if awaiting_ack {
                    ws_stream = None;
                    heartbeat_active = false;
                    awaiting_ack = false;
                    active_token = None;
                    set_status(false, Some("Discord did not acknowledge the heartbeat"));
                    recover_last_presence(&mut last_presence, &mut recovery_streak);
                    continue;
                }

                if let Some(ws) = ws_stream.as_mut() {
                    let d = if let Some(s) = seq { json!(s) } else { serde_json::Value::Null };
                    let heartbeat = json!({
                        "op": 1,
                        "d": d
                    });
                    if ws.send(Message::Text(heartbeat.to_string().into())).await.is_err() {
                        ws_stream = None;
                        heartbeat_active = false;
                        active_token = None;
                        set_status(false, Some("Failed to send a gateway heartbeat"));
                        recover_last_presence(&mut last_presence, &mut recovery_streak);
                    } else {
                        awaiting_ack = true;
                    }
                }
            },
            
            Some(msg) = async { 
                if let Some(ws) = ws_stream.as_mut() { ws.next().await.or(Some(Ok(Message::Close(None)))) } else { futures_util::future::pending().await }
            } => {
                match msg {
                    Ok(Message::Text(txt)) => {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&txt) {
                            if let Some(s) = json["s"].as_i64() {
                                seq = Some(s);
                            }
                            match json["op"].as_i64() {
                                Some(11) => awaiting_ack = false,
                                Some(7) | Some(9) => {
                                    ws_stream = None;
                                    heartbeat_active = false;
                                    awaiting_ack = false;
                                    active_token = None;
                                    set_status(false, Some("Discord requested a session reconnect"));
                                    recover_last_presence(&mut last_presence, &mut recovery_streak);
                                }
                                _ => {}
                            }
                        }
                    },
                    Ok(Message::Close(frame)) => {
                        ws_stream = None;
                        heartbeat_active = false;
                        awaiting_ack = false;
                        active_token = None;
                        let detail = frame
                            .map(|f| format!("{:?}", f))
                            .unwrap_or_else(|| "no close frame".to_string());
                        set_status(
                            false,
                            Some(&format!("Discord gateway closed the session: {}", detail)),
                        );
                        recover_last_presence(&mut last_presence, &mut recovery_streak);
                    }
                    Err(_) => {
                        ws_stream = None;
                        heartbeat_active = false;
                        awaiting_ack = false;
                        active_token = None;
                        set_status(false, Some("Discord gateway connection error"));
                        recover_last_presence(&mut last_presence, &mut recovery_streak);
                    }
                    _ => {}
                }
            }
        }
    }
}
