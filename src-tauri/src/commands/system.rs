use serde_json::Value;
use tauri::AppHandle;

/// Open a file or directory with the OS default handler.
#[tauri::command(rename = "open-directory")]
pub fn open_directory(app: AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Prompt for a directory. Resolves to `None` when the user cancels.
#[tauri::command(rename = "select-directory")]
pub fn select_directory(app: AppHandle, title: String) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    app.dialog().file().set_title(&title).pick_folder(move |picked| {
        let _ = tx.send(picked);
    });

    match rx.recv_timeout(std::time::Duration::from_secs(300)) {
        Ok(Some(path)) => Ok(Some(path.to_string())),
        Ok(None) => Ok(None),
        Err(_) => Err("directory selection timed out".to_string()),
    }
}

#[tauri::command(rename = "show-notification")]
pub fn show_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}

#[tauri::command(rename = "drag-start")]
pub fn drag_start(window: tauri::WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command(rename = "change-language")]
pub fn change_language(app: AppHandle, locale: String) -> Result<(), String> {
    use tauri::Emitter;
    let _ = app.emit("language-changed", &locale);
    Ok(())
}

// --------------------------------------------------------------- system info

/// System accent colour as `#RRGGBB`.
///
/// Read from the DWM `ColorizationColor` value, which Windows writes whenever
/// the accent colour changes. Stored as `AABBGGRR`.
#[tauri::command(rename = "get-system-accent-color")]
pub fn get_system_accent_color() -> Result<String, String> {
    #[cfg(windows)]
    {
        use windows::core::PCWSTR;
        use windows::Win32::System::Registry::{
            RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_CURRENT_USER, KEY_READ,
        };

        unsafe {
            let subkey: Vec<u16> = "Software\\Microsoft\\Windows\\DWM\0"
                .encode_utf16()
                .collect();
            let value_name: Vec<u16> = "ColorizationColor\0".encode_utf16().collect();

            let mut key = HKEY::default();
            let status = RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(subkey.as_ptr()),
                0,
                KEY_READ,
                &mut key,
            );
            if status.is_err() {
                return Err(format!("cannot open DWM registry key: {status:?}"));
            }

            let mut data: u32 = 0;
            let mut size: u32 = std::mem::size_of::<u32>() as u32;
            let status = RegQueryValueExW(
                key,
                PCWSTR(value_name.as_ptr()),
                None,
                None,
                Some(&mut data as *mut u32 as *mut u8),
                Some(&mut size),
            );
            if status.is_err() {
                return Err(format!("cannot read ColorizationColor: {status:?}"));
            }

            // Stored as 0xAABBGGRR.
            let r = data & 0xFF;
            let g = (data >> 8) & 0xFF;
            let b = (data >> 16) & 0xFF;
            return Ok(format!("#{r:02X}{g:02X}{b:02X}"));
        }
    }

    #[cfg(not(windows))]
    {
        Err("system accent colour is only available on Windows".to_string())
    }
}

/// Installed font family names.
#[tauri::command(rename = "get-system-fonts")]
pub fn get_system_fonts() -> Result<Vec<String>, String> {
    #[cfg(windows)]
    {
        use windows::core::{PCWSTR, PWSTR};
        use windows::Win32::System::Registry::{
            RegCloseKey, RegEnumValueW, RegOpenKeyExW, HKEY, HKEY_LOCAL_MACHINE, KEY_READ,
        };

        unsafe {
            let subkey: Vec<u16> = "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts\0"
                .encode_utf16()
                .collect();
            let mut key = HKEY::default();
            let status = RegOpenKeyExW(
                HKEY_LOCAL_MACHINE,
                PCWSTR(subkey.as_ptr()),
                0,
                KEY_READ,
                &mut key,
            );
            if status.is_err() {
                return Err(format!("cannot open fonts registry key: {status:?}"));
            }

            let mut fonts = Vec::new();
            let mut index = 0u32;
            loop {
                let mut name_buf = [0u16; 256];
                let mut name_len: u32 = name_buf.len() as u32;
                let mut data_buf = [0u16; 512];
                let mut data_len: u32 = (data_buf.len() * 2) as u32;
                let mut kind: u32 = 0;

                let status = RegEnumValueW(
                    key,
                    index,
                    PWSTR(name_buf.as_mut_ptr()),
                    &mut name_len,
                    None,
                    Some(&mut kind),
                    Some(data_buf.as_mut_ptr() as *mut u8),
                    Some(&mut data_len),
                );
                if status.is_err() {
                    break;
                }
                index += 1;

                // REG_SZ == 1
                if kind == 1 {
                    let end = name_buf
                        .iter()
                        .position(|c| *c == 0)
                        .unwrap_or(name_buf.len());
                    if let Ok(name) = String::from_utf16(&name_buf[..end]) {
                        fonts.push(name);
                    }
                }
            }

            let _ = RegCloseKey(key);
            fonts.sort();
            fonts.dedup();
            Ok(fonts)
        }
    }

    #[cfg(not(windows))]
    {
        Err("system font enumeration is only implemented on Windows".to_string())
    }
}

/// Search suggestions, currently sourced from the renderer.
///
/// TODO: port the suggestion source into Rust once the YTM backend lands.
#[tauri::command(rename = "get-search-suggestions")]
pub fn get_search_suggestions(_keyword: String) -> Result<Vec<String>, String> {
    Err("get-search-suggestions is served by the renderer-side YTM client".to_string())
}

/// Placeholder for the lx-music script bridge.
#[tauri::command(rename = "lx-music-http-request")]
pub fn lx_music_http_request(_request: Value) -> Result<Value, String> {
    Err("lx-music-http-request is not implemented in the Tauri backend".to_string())
}

#[tauri::command(rename = "lx-music-http-cancel")]
pub fn lx_music_http_cancel(_request_id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command(rename = "import-lx-music-script")]
pub fn import_lx_music_script(_app: AppHandle) -> Result<Value, String> {
    Err("import-lx-music-script is not implemented in the Tauri backend".to_string())
}

#[tauri::command(rename = "import-custom-api-plugin")]
pub fn import_custom_api_plugin() -> Result<Value, String> {
    Err("import-custom-api-plugin is not implemented in the Tauri backend".to_string())
}

#[tauri::command(rename = "update-discord-presence")]
pub fn update_discord_presence(_presence: Value) -> Result<(), String> {
    Err(
        "Discord Rich Presence is not implemented in the Tauri backend; it requires a \
         discord-rpc client in Rust"
            .to_string(),
    )
}

#[tauri::command(rename = "clear-discord-presence")]
pub fn clear_discord_presence() -> Result<(), String> {
    Ok(())
}

#[tauri::command(rename = "discord-logout")]
pub fn discord_logout() -> Result<(), String> {
    Ok(())
}

#[tauri::command(rename = "discord-webview-login")]
pub fn discord_webview_login(_app: AppHandle) -> Result<(), String> {
    Err("discord-webview-login is not implemented in the Tauri backend".to_string())
}
