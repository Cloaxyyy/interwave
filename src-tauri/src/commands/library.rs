use tauri::State;
use uuid::Uuid;

use crate::db::{playlists, settings, stats, tracks};
use crate::error::WaveError;
use crate::state::AppState;

#[tauri::command]
pub fn get_library(state: State<'_, AppState>) -> Result<Vec<tracks::Track>, WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(tracks::get_all_tracks(&conn)?)
}

#[tauri::command]
pub fn like_track(track_id: String, state: State<'_, AppState>) -> Result<(), WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(tracks::set_liked(&conn, &track_id, true)?)
}

#[tauri::command]
pub fn unlike_track(track_id: String, state: State<'_, AppState>) -> Result<(), WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(tracks::set_liked(&conn, &track_id, false)?)
}

#[tauri::command]
pub fn get_all_playlists(
    state: State<'_, AppState>,
) -> Result<Vec<playlists::Playlist>, WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(playlists::get_all_playlists(&conn)?)
}

#[tauri::command]
pub fn create_playlist(
    name: String,
    state: State<'_, AppState>,
) -> Result<playlists::Playlist, WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(playlists::create_playlist(&conn, &Uuid::new_v4().to_string(), &name)?)
}

#[tauri::command]
pub fn get_playlist(
    id: String,
    state: State<'_, AppState>,
) -> Result<Vec<tracks::Track>, WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(playlists::get_playlist_tracks(&conn, &id)?)
}

#[tauri::command]
pub fn add_track_to_playlist(
    playlist_id: String,
    track: tracks::Track,
    state: State<'_, AppState>,
) -> Result<(), WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    let target_id = match tracks::get_track_by_youtube_id(&conn, &track.youtube_id)? {
        Some(existing) => existing.id,
        None => {
            tracks::upsert_track(&conn, &track)?;
            track.id.clone()
        }
    };
    playlists::add_track_to_playlist(&conn, &playlist_id, &target_id)?;
    Ok(())
}

#[tauri::command]
pub fn remove_track_from_playlist(
    playlist_id: String,
    track_id: String,
    state: State<'_, AppState>,
) -> Result<(), WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(playlists::remove_track_from_playlist(&conn, &playlist_id, &track_id)?)
}

#[tauri::command]
pub fn delete_playlist(playlist_id: String, state: State<'_, AppState>) -> Result<(), WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(playlists::delete_playlist(&conn, &playlist_id)?)
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<settings::Settings, WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(settings::get_settings(&conn)?)
}

#[tauri::command]
pub fn update_settings(
    settings_val: settings::Settings,
    state: State<'_, AppState>,
) -> Result<(), WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(settings::save_settings(&conn, &settings_val)?)
}

#[tauri::command]
pub fn rename_playlist(
    playlist_id: String,
    name: String,
    state: State<'_, AppState>,
) -> Result<(), WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(playlists::rename_playlist(&conn, &playlist_id, &name)?)
}

#[tauri::command]
pub fn get_liked_tracks(state: State<'_, AppState>) -> Result<Vec<tracks::Track>, WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(tracks::get_liked_tracks(&conn)?)
}

#[tauri::command]
pub fn get_recently_added(state: State<'_, AppState>) -> Result<Vec<tracks::Track>, WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(tracks::get_recently_added(&conn, 12)?)
}

#[tauri::command]
pub fn get_most_played(state: State<'_, AppState>) -> Result<Vec<tracks::Track>, WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(tracks::get_most_played(&conn, 12)?)
}

#[tauri::command]
pub fn get_forgotten_favorites(state: State<'_, AppState>) -> Result<Vec<tracks::Track>, WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(tracks::get_forgotten_favorites(&conn, 12)?)
}

#[tauri::command]
pub fn delete_track(track_id: String, state: State<'_, AppState>) -> Result<(), WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(tracks::delete_track(&conn, &track_id)?)
}

#[tauri::command]
pub fn save_track_from_search(
    youtube_id: String,
    title: String,
    artist: String,
    duration_seconds: Option<i64>,
    thumbnail_url: Option<String>,
    state: State<'_, AppState>,
) -> Result<tracks::Track, WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;

    if let Some(existing) = tracks::get_track_by_youtube_id(&conn, &youtube_id)? {
        return Ok(existing);
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let track = tracks::Track {
        id: Uuid::new_v4().to_string(),
        youtube_id,
        title,
        artist,
        album: None,
        duration_seconds,
        thumbnail_url,
        play_count: 0,
        last_played_at: None,
        liked: false,
        created_at: now,
        local_path: None,
    };
    tracks::upsert_track(&conn, &track)?;
    Ok(track)
}

#[tauri::command]
pub fn import_cloud_tracks(
    cloud_tracks: Vec<tracks::Track>,
    state: State<'_, AppState>,
) -> Result<usize, WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    let mut imported = 0usize;
    for track in &cloud_tracks {
        if tracks::get_track_by_youtube_id(&conn, &track.youtube_id)?.is_none() {
            tracks::upsert_track(&conn, track)?;
            imported += 1;
        }
    }
    Ok(imported)
}

#[tauri::command]
pub fn import_cloud_playlists(
    cloud_playlists: Vec<playlists::Playlist>,
    state: State<'_, AppState>,
) -> Result<usize, WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    let existing = playlists::get_all_playlists(&conn)?;
    let existing_ids: std::collections::HashSet<String> =
        existing.iter().map(|p| p.id.clone()).collect();
    let mut imported = 0usize;
    for pl in &cloud_playlists {
        if !existing_ids.contains(&pl.id) {
            playlists::create_playlist_with_id(&conn, &pl.id, &pl.name)?;
            imported += 1;
        }
    }
    Ok(imported)
}

#[tauri::command]
pub fn import_cloud_playlist_track(
    playlist_id: String,
    track_id: String,
    state: State<'_, AppState>,
) -> Result<(), WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    let _ = playlists::add_track_to_playlist(&conn, &playlist_id, &track_id);
    Ok(())
}

#[tauri::command]
pub fn get_stats(state: State<'_, AppState>) -> Result<stats::ListeningStats, WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(stats::get_stats(&conn)?)
}

#[tauri::command]
pub fn get_top_artists(state: State<'_, AppState>) -> Result<Vec<stats::TopArtist>, WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(stats::get_top_artists(&conn, 10)?)
}

#[tauri::command]
pub fn get_recently_played(state: State<'_, AppState>) -> Result<Vec<stats::RecentTrack>, WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(stats::get_recently_played(&conn, 20)?)
}
