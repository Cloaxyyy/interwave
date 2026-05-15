use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use crate::error::WaveResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListeningStats {
    pub total_tracks: i64,
    pub total_liked: i64,
    pub total_playlists: i64,
    pub hours_this_month: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopArtist {
    pub name: String,
    pub play_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentTrack {
    pub track_id: String,
    pub youtube_id: String,
    pub title: String,
    pub artist: String,
    pub thumbnail_url: Option<String>,
    pub played_at: i64,
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

pub fn record_session(
    conn: &Connection,
    track_id: &str,
    youtube_id: &str,
    title: &str,
    artist: &str,
    thumbnail_url: Option<&str>,
    duration_seconds: Option<i64>,
) -> WaveResult<()> {
    conn.execute(
        "INSERT INTO listening_sessions \
         (track_id, youtube_id, title, artist, thumbnail_url, duration_seconds, played_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![track_id, youtube_id, title, artist, thumbnail_url, duration_seconds, now_secs()],
    )?;
    Ok(())
}

pub fn get_stats(conn: &Connection) -> WaveResult<ListeningStats> {
    let total_tracks: i64 = conn
        .query_row("SELECT COUNT(*) FROM tracks", [], |r| r.get(0))
        .unwrap_or(0);

    let total_liked: i64 = conn
        .query_row("SELECT COUNT(*) FROM tracks WHERE liked = 1", [], |r| r.get(0))
        .unwrap_or(0);

    let total_playlists: i64 = conn
        .query_row("SELECT COUNT(*) FROM playlists", [], |r| r.get(0))
        .unwrap_or(0);

    let month_ago = now_secs() - 30 * 24 * 3600;
    let seconds_this_month: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0) FROM listening_sessions WHERE played_at >= ?1",
            params![month_ago],
            |r| r.get(0),
        )
        .unwrap_or(0);

    Ok(ListeningStats {
        total_tracks,
        total_liked,
        total_playlists,
        hours_this_month: seconds_this_month as f64 / 3600.0,
    })
}

pub fn get_top_artists(conn: &Connection, limit: i64) -> WaveResult<Vec<TopArtist>> {
    let mut stmt = conn.prepare(
        "SELECT artist, COUNT(*) as play_count \
         FROM listening_sessions \
         GROUP BY artist \
         ORDER BY play_count DESC \
         LIMIT ?1",
    )?;
    let artists = stmt
        .query_map(params![limit], |row| {
            Ok(TopArtist {
                name: row.get(0)?,
                play_count: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(artists)
}

pub fn get_recently_played(conn: &Connection, limit: i64) -> WaveResult<Vec<RecentTrack>> {
    let mut stmt = conn.prepare(
        "SELECT track_id, youtube_id, title, artist, thumbnail_url, MAX(played_at) as played_at \
         FROM listening_sessions \
         GROUP BY track_id, youtube_id, title, artist, thumbnail_url \
         ORDER BY MAX(played_at) DESC \
         LIMIT ?1",
    )?;
    let tracks = stmt
        .query_map(params![limit], |row| {
            Ok(RecentTrack {
                track_id: row.get(0)?,
                youtube_id: row.get(1)?,
                title: row.get(2)?,
                artist: row.get(3)?,
                thumbnail_url: row.get(4)?,
                played_at: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(tracks)
}
