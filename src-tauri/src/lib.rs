mod audio;
mod commands;
mod db;
mod discord;
mod error;
mod spotify;
mod state;

use r2d2_sqlite::SqliteConnectionManager;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Determine app data directory
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");
            std::fs::create_dir_all(&app_dir)
                .expect("Failed to create app data directory");

            // ── Crash log: every panic is appended to interwave-crash.log ──
            // The user can find this file at  %AppData%\app.interwave.player\
            // and send it back so we can see what actually died.
            {
                let crash_log_path = app_dir.join("interwave-crash.log");
                let path_for_log = crash_log_path.clone();
                std::panic::set_hook(Box::new(move |info| {
                    let ts = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_secs())
                        .unwrap_or(0);
                    let location = info.location()
                        .map(|l| format!("{}:{}", l.file(), l.line()))
                        .unwrap_or_else(|| "unknown".into());
                    let msg = if let Some(s) = info.payload().downcast_ref::<&str>() { *s }
                              else if let Some(s) = info.payload().downcast_ref::<String>() { s.as_str() }
                              else { "<non-string panic>" };
                    let line = format!("[{ts}] PANIC at {location}: {msg}\n");
                    eprintln!("{line}");
                    use std::io::Write;
                    if let Ok(mut f) = std::fs::OpenOptions::new()
                        .create(true).append(true).open(&path_for_log)
                    {
                        let _ = f.write_all(line.as_bytes());
                    }
                }));
                log::info!("Crash log: {}", crash_log_path.display());
            }

            // Initialize SQLite connection pool
            let db_path = app_dir.join("wave.db");
            let manager = SqliteConnectionManager::file(&db_path);
            let pool = r2d2::Pool::new(manager)
                .expect("Failed to create DB connection pool");

            // Run schema migrations on first launch
            {
                let conn = pool.get().expect("Failed to get DB connection for schema init");
                db::schema::initialize(&conn).expect("Failed to initialize DB schema");

                // One-time migration: clear URL cache entries that may have been
                // resolved via InnerTube (throttled n-param URLs).  Setting
                // url_cache_v=2 acts as a run-once flag.
                let cache_v: Option<String> = conn
                    .query_row(
                        "SELECT value FROM settings WHERE key='url_cache_v'",
                        [],
                        |r| r.get(0),
                    )
                    .ok();
                if cache_v.as_deref() != Some("2") {
                    conn.execute("DELETE FROM stream_url_cache", [])
                        .ok();
                    conn.execute(
                        "INSERT OR REPLACE INTO settings(key, value) VALUES ('url_cache_v', '2')",
                        [],
                    )
                    .ok();
                    log::info!("Cleared URL cache (migration: remove throttled InnerTube URLs)");
                }
            }

            // Initialize 5-band EQ settings (gains stored here; DSP wiring is a follow-up)
            let eq = audio::eq::EqSettings::new();

            // Spawn the dedicated audio thread
            let audio = audio::thread::spawn_audio_thread();

            // Spawn the Discord Rich Presence thread
            let discord = discord::spawn();

            // Pre-warm the in-memory URL cache from SQLite (4-hour TTL).
            // This means tracks played in a previous session start instantly.
            let url_cache = {
                let conn = pool.get().expect("DB connection for url_cache load");
                let persisted = db::url_cache::load_all(&conn, state::URL_CACHE_TTL_SECS)
                    .unwrap_or_default();
                log::info!("Loaded {} cached stream URLs from SQLite", persisted.len());
                std::sync::Arc::new(std::sync::Mutex::new(persisted))
            };

            // Load any persisted hotkey overrides from settings (key prefix "hotkey_")
            // into the in-memory map. Defaults fill in any missing actions.
            let hotkey_map = {
                let mut map = commands::hotkeys::defaults();
                if let Ok(conn) = pool.get() {
                    if let Ok(rows) = db::settings::list_prefix(&conn, "hotkey_") {
                        for (key, value) in rows {
                            let action = key.trim_start_matches("hotkey_").to_string();
                            if value.is_empty() { map.remove(&action); }
                            else { map.insert(action, value); }
                        }
                    }
                }
                std::sync::Mutex::new(map)
            };

            app.manage(state::AppState {
                db: pool,
                audio,
                poll_generation: std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0)),
                url_cache,
                prefetch_cache: std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
                discord,
                eq,
                hotkeys: hotkey_map,
            });

            // ── Global hotkeys ─────────────────────────────────────────────
            //
            // Two registration passes:
            //   1. Hardware media keys — fire-and-forget, no conflict risk.
            //   2. Whatever's currently in the AppState hotkeys map (loaded
            //      from settings above; defaults fill in anything missing).
            //
            // The map is the source of truth. Remapping at runtime via the
            // commands::hotkeys::set_global_hotkey command unregisters and
            // re-registers in place.
            {
                let h_pp = app.handle().clone();
                let _ = app.handle().global_shortcut().on_shortcut("MediaPlayPause", move |_, _, _| {
                    let _ = h_pp.emit("hotkey://play-pause", ());
                });
                let h_nx = app.handle().clone();
                let _ = app.handle().global_shortcut().on_shortcut("MediaTrackNext", move |_, _, _| {
                    let _ = h_nx.emit("hotkey://skip-next", ());
                });
                let h_pv = app.handle().clone();
                let _ = app.handle().global_shortcut().on_shortcut("MediaTrackPrevious", move |_, _, _| {
                    let _ = h_pv.emit("hotkey://skip-prev", ());
                });

                // Pull the live map and register everything currently in it.
                use tauri::Manager;
                let state = app.handle().state::<state::AppState>();
                let bindings: Vec<(String, String)> = state.hotkeys.lock()
                    .map(|m| m.iter().map(|(a, c)| (a.clone(), c.clone())).collect())
                    .unwrap_or_default();
                for (action, combo) in bindings {
                    let h = app.handle().clone();
                    let event = format!("hotkey://{action}");
                    let combo_disp = combo.clone();
                    let res = app.handle().global_shortcut().on_shortcut(combo.as_str(), move |_, _, _| {
                        let _ = h.emit(&event, ());
                    });
                    if let Err(e) = res {
                        log::warn!("Global shortcut '{}' for '{}' failed to register: {} (probably claimed by another app)",
                                   combo_disp, action, e);
                    } else {
                        log::info!("Global hotkey: {} -> {}", action, combo_disp);
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Playback
            commands::playback::play_track,
            commands::playback::skip_next,
            commands::playback::skip_prev,
            commands::playback::pause,
            commands::playback::resume,
            commands::playback::set_volume,
            commands::playback::get_queue,
            commands::playback::add_to_queue,
            commands::playback::clear_queue,
            commands::playback::seek,
            commands::playback::set_shuffle,
            commands::playback::set_repeat,
            commands::playback::set_queue,
            commands::playback::set_speed,
            commands::playback::download_track,
            commands::playback::set_eq_band,
            commands::playback::get_eq_bands,
            commands::playback::set_crossfade,
            commands::playback::get_crossfade,
            // Hotkeys
            commands::hotkeys::set_global_hotkey,
            commands::hotkeys::clear_global_hotkey,
            commands::hotkeys::get_global_hotkeys,
            commands::hotkeys::reset_global_hotkeys,
            // Library
            commands::library::get_library,
            commands::library::like_track,
            commands::library::unlike_track,
            commands::library::get_all_playlists,
            commands::library::create_playlist,
            commands::library::get_playlist,
            commands::library::add_track_to_playlist,
            commands::library::remove_track_from_playlist,
            commands::library::delete_playlist,
            commands::library::get_settings,
            commands::library::update_settings,
            commands::library::rename_playlist,
            commands::library::get_liked_tracks,
            commands::library::delete_track,
            commands::library::get_stats,
            commands::library::get_top_artists,
            commands::library::get_recently_played,
            commands::library::save_track_from_search,
            commands::library::import_cloud_tracks,
            commands::library::import_cloud_playlists,
            commands::library::import_cloud_playlist_track,
            // Search
            commands::search::search_youtube,
            commands::search::get_search_history,
            commands::search::clear_search_history,
            commands::search::get_recommendations,
            // Lyrics
            commands::lyrics::get_lyrics,
            // Spotify file import + URL import
            commands::spotify::spotify_import_file,
            commands::spotify::import_spotify_url,
            // Window management
            commands::window::set_mini_player,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
