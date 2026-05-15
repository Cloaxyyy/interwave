use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use crate::error::WaveResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub volume: f32,
    pub crossfade_seconds: u8,
    pub performance_mode: bool,
    pub global_hotkeys: bool,
    pub crossfade_enabled: bool,
    pub gapless: bool,
    pub normalize: bool,
    pub hires_cellular: bool,
    pub analytics: bool,
    pub presence: bool,
    pub recommendations: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            volume: 0.8,
            crossfade_seconds: 3,
            performance_mode: false,
            global_hotkeys: true,
            crossfade_enabled: true,
            gapless: true,
            normalize: false,
            hires_cellular: true,
            analytics: false,
            presence: false,
            recommendations: true,
        }
    }
}

pub fn get_settings(conn: &Connection) -> WaveResult<Settings> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    let mut map = std::collections::HashMap::new();
    for row in stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))? {
        let (k, v) = row?;
        map.insert(k, v);
    }
    Ok(Settings {
        volume: map.get("volume").and_then(|v| v.parse().ok()).unwrap_or(0.8),
        crossfade_seconds: map
            .get("crossfade_seconds")
            .and_then(|v| v.parse().ok())
            .unwrap_or(3),
        performance_mode: map
            .get("performance_mode")
            .map(|v| v == "true")
            .unwrap_or(false),
        global_hotkeys: map
            .get("global_hotkeys")
            .map(|v| v == "true")
            .unwrap_or(true),
        crossfade_enabled: map.get("crossfade_enabled").map(|v| v == "true").unwrap_or(true),
        gapless: map.get("gapless").map(|v| v == "true").unwrap_or(true),
        normalize: map.get("normalize").map(|v| v == "true").unwrap_or(false),
        hires_cellular: map.get("hires_cellular").map(|v| v == "true").unwrap_or(true),
        analytics: map.get("analytics").map(|v| v == "true").unwrap_or(false),
        presence: map.get("presence").map(|v| v == "true").unwrap_or(false),
        recommendations: map.get("recommendations").map(|v| v == "true").unwrap_or(true),
    })
}

pub fn save_settings(conn: &Connection, s: &Settings) -> WaveResult<()> {
    let pairs = [
        ("volume", s.volume.to_string()),
        ("crossfade_seconds", s.crossfade_seconds.to_string()),
        ("performance_mode", s.performance_mode.to_string()),
        ("global_hotkeys", s.global_hotkeys.to_string()),
        ("crossfade_enabled", s.crossfade_enabled.to_string()),
        ("gapless", s.gapless.to_string()),
        ("normalize", s.normalize.to_string()),
        ("hires_cellular", s.hires_cellular.to_string()),
        ("analytics", s.analytics.to_string()),
        ("presence", s.presence.to_string()),
        ("recommendations", s.recommendations.to_string()),
    ];
    for (key, value) in &pairs {
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
    }
    Ok(())
}

pub fn set_kv(conn: &Connection, key: &str, value: &str) -> WaveResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}

pub fn get_kv(conn: &Connection, key: &str) -> WaveResult<Option<String>> {
    let row: rusqlite::Result<String> = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |r| r.get(0),
    );
    match row {
        Ok(s) if !s.is_empty() => Ok(Some(s)),
        _ => Ok(None),
    }
}

pub fn list_prefix(conn: &Connection, prefix: &str) -> WaveResult<Vec<(String, String)>> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings WHERE key LIKE ?1")?;
    let pat = format!("{prefix}%");
    let rows = stmt.query_map(params![pat], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
    let mut out = Vec::new();
    for r in rows { out.push(r?); }
    Ok(out)
}
