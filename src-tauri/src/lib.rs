pub mod cache;
pub mod commands;
pub mod db;
pub mod downloads;
pub mod smtc;
pub mod lyrics;

use commands::audio::AudioState;
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
            app.manage(AudioState {
                player: std::sync::Mutex::new(None),
                eq: std::sync::Mutex::new(commands::audio::EqState::default()),
            });

            let progress_handle = handle.clone();
            std::thread::spawn(move || {
                use tauri::Emitter;
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(200));
                    {
                        let state = progress_handle.state::<AudioState>();
                        if let Ok(guard) = state.player.lock() {
                            if let Some(player) = guard.as_ref() {
                                if !player.sink.is_paused() && !player.sink.empty() {
                                    let pos = player.sink.get_pos().as_secs_f32();
                                    let _ = progress_handle.emit("playback-progress", pos);
                                }
                            }
                        };
                    }
                }
            });

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
            commands::db::get_liked_tracks_full,
            commands::db::get_recently_played_full,
            commands::db::add_liked_track,
            commands::db::add_disliked_track,
            commands::db::track_played,
            commands::db::store_playlist,
            commands::db::add_track_to_playlist,
            commands::db::remove_track_from_playlist,
            commands::db::get_tracks_in_playlist,
            commands::db::get_all_playlists,
            commands::db::save_local_music,
            commands::db::get_all_local_music,
            commands::db::delete_local_music,
            commands::db::clear_local_music,
            commands::db::follow_artist,
            commands::db::unfollow_artist,
            commands::db::get_followed_artists,
            commands::db::get_top_50_tracks,
            commands::db::get_downloaded_tracks_full,
            commands::db::export_user_data,
            commands::db::import_playlist,
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
            commands::system::select_file,
            commands::system::save_file,
            commands::system::show_notification,
            commands::system::change_language,
            commands::system::get_system_accent_color,
            commands::system::get_system_fonts,
            commands::integrations::app_update_get_state,
            commands::integrations::app_update_check,
            commands::integrations::app_update_download,
            commands::integrations::app_update_quit_and_install,
            commands::integrations::app_update_open_release_page,
            commands::integrations::ytm_request,
            commands::integrations::ytm_validate_stream,
            commands::integrations::spotify_login,
            commands::integrations::spotify_exchange_token,
            commands::integrations::spotify_fetch_playlists,
            commands::integrations::spotify_fetch_playlist_tracks,
            commands::integrations::parse_playlist_url,
            commands::discord::update_discord_presence,
            commands::discord::clear_discord_presence,
            commands::discord::discord_logout,
            commands::discord::discord_webview_login,
            commands::audio::audio_play,
            commands::audio::audio_pause,
            commands::audio::audio_resume,
            commands::audio::audio_stop,
            commands::audio::audio_set_volume,
            commands::audio::audio_seek,
            commands::audio::audio_get_time,
            commands::audio::audio_get_duration,
            commands::audio::audio_set_eq_bypass,
            commands::audio::audio_set_eq_band,
            commands::audio::audio_set_playback_rate,
            commands::audio::audio_clear_cache,
            commands::lyrics::fetch_best_lyrics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Chorus Deck");
}
