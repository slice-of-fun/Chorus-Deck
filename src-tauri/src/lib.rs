pub mod cache;
pub mod commands;
pub mod db;
pub mod downloads;
pub mod smtc;

use commands::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let handle = app.handle().clone();
            let state = AppState::new(&handle)
                .map_err(|e| format!("failed to initialise application state: {e}"))?;
            app.manage(state);

            smtc::windows_smtc::init_smtc(&handle);

            if let Some(window) = app.get_webview_window("main") {
                let _ = window;
            }

            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Chorus Deck", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .tooltip("Chorus Deck")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            if is_visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "lyric" {
                    if let Some(main) = window.app_handle().get_webview_window("main") {
                        use tauri::Emitter;
                        let _ = main.emit("lyric-window-closed", ());
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::window::minimize_window,
            commands::window::maximize_window,
            commands::window::close_window,
            commands::window::quit_app,
            commands::window::restart,
            commands::window::restore_window,
            commands::window::resize_window,
            commands::window::resize_mini_window,
            commands::window::mini_window,
            commands::window::mini_tray,
            commands::window::get_platform,
            commands::system::drag_start,
            commands::window::open_lyric,
            commands::media::send_lyric,
            commands::media::tray_lyric_update,
            commands::media::cache_lyric,
            commands::media::get_cached_lyric,
            commands::media::clear_lyric_cache,
            commands::media::clear_lyrics_cache,
            commands::media::get_lyrics,
            commands::window::update_current_song,
            commands::window::update_play_state,
            commands::window::set_content_zoom,
            commands::window::get_content_zoom,
            commands::store::get_store_value,
            commands::store::set_store_value,
            commands::store::get_disk_cache_config,
            commands::store::set_disk_cache_config,
            commands::store::get_disk_cache_stats,
            commands::store::clear_disk_cache,
            commands::store::switch_disk_cache_directory,
            commands::db::get_track,
            commands::db::get_liked_tracks,
            commands::db::add_liked_track,
            commands::db::add_disliked_track,
            commands::db::track_played,
            commands::db::store_playlist,
            commands::db::add_track_to_playlist,
            commands::db::remove_track_from_playlist,
            commands::db::get_tracks_in_playlist,
            commands::db::get_all_playlists,
            commands::media::get_downloads_path,
            commands::media::download_get_queue,
            commands::media::download_get_completed,
            commands::media::download_add,
            commands::media::download_add_batch,
            commands::media::download_pause,
            commands::media::download_resume,
            commands::media::download_cancel,
            commands::media::download_cancel_all,
            commands::media::download_clear_completed,
            commands::media::download_delete_completed,
            commands::media::download_provide_url,
            commands::media::download_set_concurrency,
            commands::media::get_embedded_lyrics,
            commands::media::unblock_music,
            commands::media::scan_local_music,
            commands::media::scan_local_music_with_stats,
            commands::media::parse_local_music_metadata,
            commands::media::check_file_exists,
            commands::system::open_directory,
            commands::system::select_directory,
            commands::system::show_notification,
            commands::system::change_language,
            commands::system::get_system_accent_color,
            commands::system::get_system_fonts,
            commands::system::update_discord_presence,
            commands::system::clear_discord_presence,
            commands::system::discord_logout,
            commands::integrations::app_update_get_state,
            commands::integrations::app_update_check,
            commands::integrations::app_update_download,
            commands::integrations::app_update_quit_and_install,
            commands::integrations::app_update_open_release_page,
            commands::integrations::ytm_home,
            commands::integrations::ytm_charts,
            commands::integrations::ytm_search,
            commands::integrations::ytm_suggestions,
            commands::integrations::ytm_moods,
            commands::integrations::ytm_player,
            commands::integrations::ytm_playlist,
            commands::integrations::ytm_artist,
            commands::integrations::ytm_search_keyword,
            commands::integrations::ytm_hot_search,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Chorus Deck");
}
