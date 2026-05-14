use tauri::{AppHandle, Manager};
use crate::error::WaveError;

#[tauri::command]
pub async fn set_mini_player(enabled: bool, app: AppHandle) -> Result<(), WaveError> {
    let window = app.get_webview_window("main")
        .ok_or_else(|| WaveError::Internal("Main window not found".into()))?;

    if enabled {
        window.set_resizable(false)
            .map_err(|e| WaveError::Internal(e.to_string()))?;
        window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: 340, height: 96 }))
            .map_err(|e| WaveError::Internal(e.to_string()))?;
        window.set_always_on_top(true)
            .map_err(|e| WaveError::Internal(e.to_string()))?;
    } else {
        window.set_always_on_top(false)
            .map_err(|e| WaveError::Internal(e.to_string()))?;
        window.set_resizable(true)
            .map_err(|e| WaveError::Internal(e.to_string()))?;
        window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: 1280, height: 800 }))
            .map_err(|e| WaveError::Internal(e.to_string()))?;
    }
    Ok(())
}
