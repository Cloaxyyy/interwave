use rusqlite::Connection;
use crate::error::WaveResult;

pub fn initialize(conn: &Connection) -> WaveResult<()> {
    conn.execute_batch(r#"
        PRAGMA journal_mode=WAL;
        PRAGMA foreign_keys=ON;

        CREATE TABLE IF NOT EXISTS tracks (
            id TEXT PRIMARY KEY,
            youtube_id TEXT NOT NULL,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            album TEXT,
            duration_seconds INTEGER,
            thumbnail_url TEXT,
            play_count INTEGER DEFAULT 0,
            last_played_at INTEGER,
            liked INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS playlists (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            spotify_id TEXT
        );

        CREATE TABLE IF NOT EXISTS playlist_tracks (
            playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
            track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
            position INTEGER NOT NULL,
            PRIMARY KEY (playlist_id, track_id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS search_history (
            query TEXT NOT NULL,
            searched_at INTEGER NOT NULL,
            UNIQUE(query)
        );

        CREATE TABLE IF NOT EXISTS listening_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            track_id TEXT NOT NULL,
            youtube_id TEXT NOT NULL,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            thumbnail_url TEXT,
            duration_seconds INTEGER,
            played_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS stream_url_cache (
            youtube_id TEXT PRIMARY KEY,
            stream_url TEXT NOT NULL,
            resolved_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_tracks_youtube_id ON tracks(youtube_id);
        CREATE INDEX IF NOT EXISTS idx_tracks_liked ON tracks(liked);
        CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_played_at ON listening_sessions(played_at DESC);
        CREATE INDEX IF NOT EXISTS idx_sessions_artist ON listening_sessions(artist);
    "#)?;

    // Add local_path column if it doesn't exist (migration-safe)
    let _ = conn.execute_batch(
        "ALTER TABLE tracks ADD COLUMN local_path TEXT;"
    );
    // ^ intentionally ignoring error — SQLite returns error if column already exists

    conn.execute_batch(r#"
        INSERT OR IGNORE INTO settings(key, value) VALUES ('volume', '0.8');
        INSERT OR IGNORE INTO settings(key, value) VALUES ('crossfade_seconds', '3');
        INSERT OR IGNORE INTO settings(key, value) VALUES ('performance_mode', 'false');
        INSERT OR IGNORE INTO settings(key, value) VALUES ('global_hotkeys', 'true');
        INSERT OR IGNORE INTO settings(key, value) VALUES ('spotify_client_id', '');
    "#)?;

    Ok(())
}
