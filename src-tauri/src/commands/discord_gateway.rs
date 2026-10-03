use std::sync::Mutex;
use serde_json::json;
use reqwest::Client;
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use lazy_static::lazy_static;

use crate::commands::discord::{DiscordPresence, resolve_source_text, to_discord_text, resolve_image_url};

const APP_ICON_URL: &str = "https://raw.githubusercontent.com/slice-of-fun/Chorus-Music/main/assets/Chorus-new.png";
const PAUSE_IMAGE_URL: &str = "https://raw.githubusercontent.com/slice-of-fun/Chorus-Music/main/assets/paused.png";

pub enum GatewayCmd {
    UpdatePresence {
        presence: DiscordPresence,
        token: String,
    },
    ClearPresence,
    Close,
}

lazy_static! {
    static ref GATEWAY_TX: Mutex<Option<UnboundedSender<GatewayCmd>>> = Mutex::new(None);
}

pub fn update_presence(presence: DiscordPresence, token: String) {
    send_cmd(GatewayCmd::UpdatePresence { presence, token });
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
        tauri::async_runtime::spawn(gateway_actor(rx));
        *tx_lock = Some(tx);
    }
    if let Some(tx) = tx_lock.as_ref() {
        let _ = tx.send(cmd);
    }
}

async fn register_external_asset(client: &Client, token: &str, url: &str) -> Option<String> {
    if !url.starts_with("http") {
        return Some(url.to_string());
    }
    if url.starts_with("mp:") {
        return Some(url.to_string());
    }

    let auth = if token.contains('.') { token.to_string() } else { format!("Bearer {}", token) };
    let body = json!({ "urls": [url] });
    
    let res = client.post("https://discord.com/api/v10/applications/1554131750899163186/external-assets")
        .header("Authorization", auth)
        .json(&body)
        .send()
        .await
        .ok()?;
        
    let txt = res.text().await.ok()?;
    let arr: serde_json::Value = serde_json::from_str(&txt).ok()?;
    
    if let Some(arr) = arr.as_array() {
        if let Some(first) = arr.get(0) {
            if let Some(path) = first.get("external_asset_path").and_then(|v| v.as_str()) {
                return Some(format!("mp:{}", path));
            }
        }
    }
    None
}

async fn gateway_actor(mut rx: tokio::sync::mpsc::UnboundedReceiver<GatewayCmd>) {
    let mut ws_stream: Option<tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>> = None;
    let mut active_token: Option<String> = None;
    let client = reqwest::Client::new();
    
    let mut heartbeat_interval = tokio::time::interval(tokio::time::Duration::from_secs(41));
    heartbeat_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    let mut heartbeat_active = false;
    let mut seq: Option<i64> = None;

    loop {
        tokio::select! {
            cmd = rx.recv() => {
                match cmd {
                    Some(GatewayCmd::UpdatePresence { presence, token }) => {
                        if active_token.as_deref() != Some(&token) || ws_stream.is_none() {
                            if let Some(mut ws) = ws_stream.take() {
                                let _ = ws.close(None).await;
                            }
                            
                            if let Ok((mut ws, _)) = connect_async("wss://gateway.discord.gg/?v=10&encoding=json").await {
                                active_token = Some(token.clone());
                                
                                if let Some(Ok(Message::Text(msg))) = ws.next().await {
                                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&msg) {
                                        if json["op"].as_i64() == Some(10) {
                                            let hb_interval = json["d"]["heartbeat_interval"].as_u64().unwrap_or(41250);
                                            heartbeat_interval = tokio::time::interval(tokio::time::Duration::from_millis(hb_interval));
                                            heartbeat_interval.tick().await; 
                                            heartbeat_active = true;
                                            
                                            let identify = json!({
                                                "op": 2,
                                                "d": {
                                                    "token": token,
                                                    "capabilities": 16381,
                                                    "intents": 0,
                                                    "properties": {
                                                        "os": "Android",
                                                        "browser": "Chorus Music",
                                                        "device": "Android",
                                                        "browser_user_agent": "Chorus Music",
                                                        "browser_version": "1.0",
                                                        "client_version": "1.0",
                                                        "client_build_number": 1,
                                                        "native_build_number": 1,
                                                        "release_channel": "unknown"
                                                    }
                                                }
                                            });
                                            let _ = ws.send(Message::Text(identify.to_string().into())).await;
                                        }
                                    }
                                }
                                ws_stream = Some(ws);
                            } else {
                                continue;
                            }
                        }
                        
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
                            
                            let mut activity_json = json!({
                                "name": presence.activity_name.as_deref().unwrap_or("Chorus Music"),
                                "type": 2,
                                "application_id": "1554131750899163186",
                                "platform": "android"
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
                            
                            let _ = ws.send(Message::Text(update_payload.to_string().into())).await;
                        }
                    },
                    Some(GatewayCmd::ClearPresence) | Some(GatewayCmd::Close) => {
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
                            active_token = None;
                        }
                    },
                    None => break,
                }
            },
            
            _ = heartbeat_interval.tick(), if heartbeat_active && ws_stream.is_some() => {
                if let Some(ws) = ws_stream.as_mut() {
                    let d = if let Some(s) = seq { json!(s) } else { serde_json::Value::Null };
                    let heartbeat = json!({
                        "op": 1,
                        "d": d
                    });
                    if ws.send(Message::Text(heartbeat.to_string().into())).await.is_err() {
                        ws_stream = None;
                        heartbeat_active = false;
                    }
                }
            },
            
            Some(msg) = async { 
                if let Some(ws) = ws_stream.as_mut() { ws.next().await } else { futures_util::future::pending().await } 
            } => {
                match msg {
                    Ok(Message::Text(txt)) => {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&txt) {
                            if let Some(s) = json["s"].as_i64() {
                                seq = Some(s);
                            }
                            if json["op"].as_i64() == Some(7) || json["op"].as_i64() == Some(9) {
                                ws_stream = None;
                                heartbeat_active = false;
                            }
                        }
                    },
                    Ok(Message::Close(_)) | Err(_) => {
                        ws_stream = None;
                        heartbeat_active = false;
                    }
                    _ => {}
                }
            }
        }
    }
}
