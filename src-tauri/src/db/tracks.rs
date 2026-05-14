use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use crate::error::WaveResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: String,
    pub youtube_id: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_seconds: Option<i64>,
    pub thumbnail_url: Option<String>,
    pub play_count: i64,
    pub last_played_at: Option<i64>,
    pub liked: bool,
    pub created_at: i64,
    pub local_path: Option<String>,
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

fn row_to_track(row: &rusqlite::Row) -> rusqlite::Result<Track> {
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
}

const TRACK_COLS: &str =
    "id, youtube_id, title, artist, album, duration_seconds, thumbnail_url, \
     play_count, last_played_at, liked, created_at, local_path";

pub fn upsert_track(conn: &Connection, track: &Track) -> WaveResult<()> {
    conn.execute(
        &format!(
            "INSERT INTO tracks ({TRACK_COLS}) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
             ON CONFLICT(id) DO UPDATE SET
               title=excluded.title, artist=excluded.artist, album=excluded.album,
               duration_seconds=excluded.duration_seconds,
               thumbnail_url=excluded.thumbnail_url"
        ),
        params![
            track.id, track.youtube_id, track.title, track.artist, track.album,
            track.duration_seconds, track.thumbnail_url, track.play_count,
            track.last_played_at, track.liked as i64, track.created_at, track.local_path
        ],
    )?;
    Ok(())
}

pub fn get_all_tracks(conn: &Connection) -> WaveResult<Vec<Track>> {
    let mut stmt = conn.prepare(
        &format!("SELECT {TRACK_COLS} FROM tracks ORDER BY created_at DESC"),
    )?;
    let tracks = stmt
        .query_map([], row_to_track)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(tracks)
}

pub fn get_track_by_youtube_id(conn: &Connection, youtube_id: &str) -> WaveResult<Option<Track>> {
    let mut stmt = conn.prepare(
        &format!("SELECT {TRACK_COLS} FROM tracks WHERE youtube_id = ?1"),
    )?;
    let result = stmt
        .query_map(params![youtube_id], row_to_track)?
        .next()
        .transpose()?;
    Ok(result)
}

pub fn increment_play_count(conn: &Connection, id: &str) -> WaveResult<()> {
    conn.execute(
        "UPDATE tracks SET play_count = play_count + 1, last_played_at = ?1 WHERE id = ?2",
        params![now_secs(), id],
    )?;
    Ok(())
}

pub fn set_liked(conn: &Connection, id: &str, liked: bool) -> WaveResult<()> {
    conn.execute(
        "UPDATE tracks SET liked = ?1 WHERE id = ?2",
        params![liked as i64, id],
    )?;
    Ok(())
}

pub fn get_liked_tracks(conn: &Connection) -> WaveResult<Vec<Track>> {
    let mut stmt = conn.prepare(
        &format!(
            "SELECT {TRACK_COLS} FROM tracks WHERE liked = 1 ORDER BY last_played_at DESC"
        ),
    )?;
    let tracks = stmt
        .query_map([], row_to_track)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(tracks)
}

pub fn delete_track(conn: &Connection, id: &str) -> WaveResult<()> {
    conn.execute("DELETE FROM tracks WHERE id = ?1", params![id])?;
    Ok(())
}
