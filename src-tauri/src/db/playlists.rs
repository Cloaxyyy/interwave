use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use crate::error::WaveResult;
use super::tracks::Track;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub spotify_id: Option<String>,
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

/// Create a playlist with a specific ID (used when importing from cloud).
/// INSERT OR IGNORE so it's idempotent.
pub fn create_playlist_with_id(conn: &Connection, id: &str, name: &str) -> WaveResult<Playlist> {
    let now = now_secs();
    conn.execute(
        "INSERT OR IGNORE INTO playlists (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
        params![id, name, now],
    )?;
    Ok(Playlist {
        id: id.to_string(),
        name: name.to_string(),
        created_at: now,
        updated_at: now,
        spotify_id: None,
    })
}

pub fn create_playlist(conn: &Connection, id: &str, name: &str) -> WaveResult<Playlist> {
    let now = now_secs();
    conn.execute(
        "INSERT INTO playlists (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
        params![id, name, now],
    )?;
    Ok(Playlist {
        id: id.to_string(),
        name: name.to_string(),
        created_at: now,
        updated_at: now,
        spotify_id: None,
    })
}

pub fn get_all_playlists(conn: &Connection) -> WaveResult<Vec<Playlist>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, created_at, updated_at, spotify_id FROM playlists ORDER BY name ASC",
    )?;
    let playlists = stmt
        .query_map([], |row| {
            Ok(Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                spotify_id: row.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(playlists)
}

pub fn get_playlist_tracks(conn: &Connection, playlist_id: &str) -> WaveResult<Vec<Track>> {
    let track_cols = "t.id, t.youtube_id, t.title, t.artist, t.album, t.duration_seconds, \
                      t.thumbnail_url, t.play_count, t.last_played_at, t.liked, t.created_at, \
                      t.local_path";
    let mut stmt = conn.prepare(&format!(
        "SELECT {track_cols} FROM tracks t
         JOIN playlist_tracks pt ON t.id = pt.track_id
         WHERE pt.playlist_id = ?1
         ORDER BY pt.position ASC"
    ))?;
    let tracks = stmt
        .query_map(params![playlist_id], |row| {
            Ok(Track {
                id: row.get(0)?,
                youtube_id: row.get(1)?,
                title: row.get(2)?,
                artist: row.get(3)?,
                album: row.get(4)?,
                duration_seconds: row.get(5)?,
                thumbnail_url: row.get(6)?,
                play_count: row.get(7)?,
                last_played_at: row.get(8)?,
                liked: row.get::<_, i64>(9)? != 0,
                created_at: row.get(10)?,
                local_path: row.get(11)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(tracks)
}

/// Returns `true` if the track was newly added, `false` if it was already in
/// the playlist (INSERT OR IGNORE swallowed the conflict). Lets callers
/// surface "added X new, skipped Y already-present" messaging to the user.
pub fn add_track_to_playlist(
    conn: &Connection,
    playlist_id: &str,
    track_id: &str,
) -> WaveResult<bool> {
    let position: i64 = conn.query_row(
        "SELECT COALESCE(MAX(position), 0) + 1 FROM playlist_tracks WHERE playlist_id = ?1",
        params![playlist_id],
        |row| row.get(0),
    )?;
    let rows = conn.execute(
        "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?1, ?2, ?3)",
        params![playlist_id, track_id, position],
    )?;
    if rows > 0 {
        conn.execute(
            "UPDATE playlists SET updated_at = ?1 WHERE id = ?2",
            params![now_secs(), playlist_id],
        )?;
    }
    Ok(rows > 0)
}

pub fn remove_track_from_playlist(
    conn: &Connection,
    playlist_id: &str,
    track_id: &str,
) -> WaveResult<()> {
    conn.execute(
        "DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2",
        params![playlist_id, track_id],
    )?;
    Ok(())
}

pub fn rename_playlist(conn: &Connection, playlist_id: &str, name: &str) -> WaveResult<()> {
    conn.execute(
        "UPDATE playlists SET name = ?1, updated_at = ?2 WHERE id = ?3",
        params![name, now_secs(), playlist_id],
    )?;
    Ok(())
}

pub fn delete_playlist(conn: &Connection, playlist_id: &str) -> WaveResult<()> {
    conn.execute("DELETE FROM playlists WHERE id = ?1", params![playlist_id])?;
    Ok(())
}
