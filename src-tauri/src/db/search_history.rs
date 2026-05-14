use rusqlite::{Connection, params};
use crate::error::WaveResult;

/// Saves a query to search_history, deduplicating by query text
/// (replaces existing entry atomically if same query via UNIQUE constraint),
/// then caps the table at 20 rows.
pub fn save_query(conn: &Connection, query: &str) -> WaveResult<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| crate::error::WaveError::Internal("system clock predates Unix epoch".into()))?
        .as_secs() as i64;

    // Upsert: replaces existing row if same query (UNIQUE constraint handles dedup atomically)
    conn.execute(
        "INSERT OR REPLACE INTO search_history (query, searched_at) VALUES (?1, ?2)",
        params![query, now],
    )?;

    // Keep only the 20 most recent
    conn.execute(
        "DELETE FROM search_history WHERE rowid NOT IN (
            SELECT rowid FROM search_history ORDER BY searched_at DESC LIMIT 20
        )",
        [],
    )?;

    Ok(())
}

/// Returns up to 20 recent queries, newest first.
pub fn get_recent(conn: &Connection) -> WaveResult<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT query FROM search_history ORDER BY searched_at DESC LIMIT 20",
    )?;
    let queries = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(queries)
}

/// Deletes all search history.
pub fn clear_history(conn: &Connection) -> WaveResult<()> {
    conn.execute("DELETE FROM search_history", [])?;
    Ok(())
}
