use rusqlite::{Connection, params};
use crate::error::WaveResult;

/// Persist a resolved stream URL to SQLite so it survives app restarts.
/// TTL is enforced at load-time; we just store the epoch-second timestamp.
pub fn save_url(conn: &Connection, youtube_id: &str, stream_url: &str) -> WaveResult<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    conn.execute(
        "INSERT OR REPLACE INTO stream_url_cache (youtube_id, stream_url, resolved_at)
         VALUES (?1, ?2, ?3)",
        params![youtube_id, stream_url, now],
    )?;
    Ok(())
}

/// Load all non-expired URL entries from SQLite into an in-memory HashMap.
/// Entries older than `ttl_secs` are skipped and pruned in the same pass.
pub fn load_all(
    conn: &Connection,
    ttl_secs: u64,
) -> WaveResult<std::collections::HashMap<String, (String, std::time::Instant)>> {
    let cutoff = (std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs())
        .saturating_sub(ttl_secs) as i64;

    // Prune stale entries first
    conn.execute(
        "DELETE FROM stream_url_cache WHERE resolved_at < ?1",
        params![cutoff],
    )?;

    let mut stmt = conn.prepare(
        "SELECT youtube_id, stream_url, resolved_at FROM stream_url_cache WHERE resolved_at >= ?1",
    )?;

    let now_epoch = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let mut map = std::collections::HashMap::new();
    for row in stmt.query_map(params![cutoff], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, i64>(2)?,
        ))
    })? {
        let (youtube_id, stream_url, resolved_at) = row?;
        // Convert stored epoch-second back to an Instant approximate.
        // Instant::now() minus how-many-seconds-ago-this-was-resolved.
        let age_secs = now_epoch.saturating_sub(resolved_at as u64);
        let resolved_instant = std::time::Instant::now()
            .checked_sub(std::time::Duration::from_secs(age_secs))
            .unwrap_or_else(std::time::Instant::now);
        map.insert(youtube_id, (stream_url, resolved_instant));
    }
    Ok(map)
}
