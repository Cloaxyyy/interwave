use serde::Deserialize;
use crate::error::WaveError;

/// A track extracted from either YourLibrary.json or a Playlist file.
#[derive(Debug, Clone)]
pub struct ParsedTrack {
    pub title: String,
    pub artist: String,
    pub album: String,
}

/// A playlist extracted from Playlist*.json.
#[derive(Debug, Clone)]
pub struct ParsedPlaylist {
    pub name: String,
    pub tracks: Vec<ParsedTrack>,
}

// ── Internal serde types for YourLibrary.json ─────────────────────────────────

#[derive(Deserialize)]
struct LibraryFile {
    tracks: Option<Vec<LibraryTrack>>,
}

#[derive(Deserialize)]
struct LibraryTrack {
    track: Option<String>,
    artist: Option<String>,
    album: Option<String>,
}

// ── Internal serde types for Playlist*.json ───────────────────────────────────

#[derive(Deserialize)]
struct PlaylistFile {
    playlists: Option<Vec<PlaylistEntry>>,
}

#[derive(Deserialize)]
struct PlaylistEntry {
    name: Option<String>,
    items: Option<Vec<PlaylistItem>>,
}

#[derive(Deserialize)]
struct PlaylistItem {
    track: Option<PlaylistTrackObj>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlaylistTrackObj {
    track_name: Option<String>,
    artist_name: Option<String>,
    album_name: Option<String>,
}

// ── Public parse functions ────────────────────────────────────────────────────

/// Detects file type and parses either YourLibrary.json or Playlist*.json.
/// Returns (saved_tracks, playlists).
pub fn parse_spotify_export(
    json: &str,
) -> Result<(Vec<ParsedTrack>, Vec<ParsedPlaylist>), WaveError> {
    // Try YourLibrary.json format first
    if let Ok(lib) = serde_json::from_str::<LibraryFile>(json) {
        if let Some(tracks) = lib.tracks {
            let parsed: Vec<ParsedTrack> = tracks
                .into_iter()
                .filter_map(|t| {
                    Some(ParsedTrack {
                        title: t.track.filter(|s| !s.is_empty())?,
                        artist: t.artist.unwrap_or_else(|| "Unknown".into()),
                        album: t.album.unwrap_or_default(),
                    })
                })
                .collect();
            return Ok((parsed, vec![]));
        }
    }

    // Try Playlist*.json format
    if let Ok(pf) = serde_json::from_str::<PlaylistFile>(json) {
        if let Some(playlists) = pf.playlists {
            let parsed: Vec<ParsedPlaylist> = playlists
                .into_iter()
                .filter_map(|p| {
                    let name = p.name.filter(|s| !s.is_empty())?;
                    let tracks = p
                        .items
                        .unwrap_or_default()
                        .into_iter()
                        .filter_map(|item| {
                            let t = item.track?;
                            Some(ParsedTrack {
                                title: t.track_name.filter(|s| !s.is_empty())?,
                                artist: t.artist_name.unwrap_or_else(|| "Unknown".into()),
                                album: t.album_name.unwrap_or_default(),
                            })
                        })
                        .collect();
                    Some(ParsedPlaylist { name, tracks })
                })
                .collect();
            return Ok((vec![], parsed));
        }
    }

    Err(WaveError::Internal(
        "File does not look like a Spotify export (expected YourLibrary.json or Playlist*.json format)".into(),
    ))
}
