//! Global hotkey commands. Bindings are persisted to the settings table.

use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

use crate::error::WaveError;
use crate::state::AppState;

/// Action name → bound combo.
pub type HotkeyMap = Mutex<HashMap<String, String>>;

pub fn defaults() -> HashMap<String, String> {
    [
        ("play-pause",  "CommandOrControl+Shift+Space"),
        ("skip-next",   "CommandOrControl+Shift+Right"),
        ("skip-prev",   "CommandOrControl+Shift+Left"),
        ("volume-up",   "CommandOrControl+Shift+Up"),
        ("volume-down", "CommandOrControl+Shift+Down"),
    ]
    .into_iter()
    .map(|(k, v)| (k.to_string(), v.to_string()))
    .collect()
}

fn action_event(action: &str) -> String {
    format!("hotkey://{action}")
}

#[tauri::command]
pub async fn set_global_hotkey(
    action: String,
    combo: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), WaveError> {
    let trimmed = combo.trim().to_string();
    if trimmed.is_empty() {
        return Err(WaveError::Internal("empty combo".into()));
    }

    let prev = {
        let map = state.hotkeys.lock().map_err(|_| WaveError::Internal("hotkey map poisoned".into()))?;
        map.get(&action).cloned()
    };
    if let Some(p) = prev {
        let _ = app.global_shortcut().unregister(p.as_str());
    }

    let event = action_event(&action);
    let app_for_cb = app.clone();
    let res = app.global_shortcut().on_shortcut(trimmed.as_str(), move |_, _, _| {
        let _ = app_for_cb.emit(&event, ());
    });
    if let Err(e) = res {
        return Err(WaveError::Internal(format!(
            "Could not register '{}' — likely claimed by another app. ({})", trimmed, e
        )));
    }

    // Persist + cache
    {
        let mut map = state.hotkeys.lock().map_err(|_| WaveError::Internal("hotkey map poisoned".into()))?;
        map.insert(action.clone(), trimmed.clone());
    }
    let conn = state.db.get().map_err(WaveError::from)?;
    crate::db::settings::set_kv(&conn, &format!("hotkey_{action}"), &trimmed)?;

    log::info!("global hotkey: {action} -> {trimmed}");
    Ok(())
}

#[tauri::command]
pub async fn clear_global_hotkey(
    action: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), WaveError> {
    let prev = {
        let mut map = state.hotkeys.lock().map_err(|_| WaveError::Internal("poisoned".into()))?;
        map.remove(&action)
    };
    if let Some(p) = prev {
        let _ = app.global_shortcut().unregister(p.as_str());
    }
    let conn = state.db.get().map_err(WaveError::from)?;
    crate::db::settings::set_kv(&conn, &format!("hotkey_{action}"), "")?;
    Ok(())
}

#[tauri::command]
pub fn get_global_hotkeys(state: State<'_, AppState>) -> Result<HashMap<String, String>, WaveError> {
    let map = state.hotkeys.lock().map_err(|_| WaveError::Internal("poisoned".into()))?;
    Ok(map.clone())
}

#[tauri::command]
pub async fn reset_global_hotkeys(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<HashMap<String, String>, WaveError> {
    // Unregister everything first
    let prev: Vec<String> = {
        let map = state.hotkeys.lock().map_err(|_| WaveError::Internal("poisoned".into()))?;
        map.values().cloned().collect()
    };
    for p in prev {
        let _ = app.global_shortcut().unregister(p.as_str());
    }
    // Set defaults & register them
    let defaults = defaults();
    {
        let mut map = state.hotkeys.lock().map_err(|_| WaveError::Internal("poisoned".into()))?;
        *map = defaults.clone();
    }
    for (action, combo) in &defaults {
        let event = action_event(action);
        let app_for_cb = app.clone();
        let _ = app.global_shortcut().on_shortcut(combo.as_str(), move |_, _, _| {
            let _ = app_for_cb.emit(&event, ());
        });
        let conn = state.db.get().map_err(WaveError::from)?;
        crate::db::settings::set_kv(&conn, &format!("hotkey_{action}"), combo)?;
    }
    Ok(defaults)
}
