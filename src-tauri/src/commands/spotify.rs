use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, State};
use tauri::Emitter;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;
use uuid::Uuid;

use crate::db::{tracks as db_tracks, playlists as db_playlists};
use crate::error::WaveError;
use crate::spotify::parse;
use crate::state::AppState;

#[derive(Clone, Serialize)]
pub struct ImportProgressEvent {
    pub current: usize,
    pub total: usize,
    pub track_name: String,
    pub status: String,
}

#[derive(Clone, Serialize)]
pub struct ImportCompleteEvent {
    pub imported: usize,
    pub failed: usize,
    #[serde(default)]
    pub truncated: bool,
    #[serde(default)]
    pub spotify_total: usize,
    #[serde(default)]
    pub already_present: usize,
}

struct YoutubeMatch {
    video_id: String,
    thumbnail_url: Option<String>,
    duration_seconds: Option<i64>,
}

async fn search_youtube_one(title: &str, artist: &str) -> Option<YoutubeMatch> {
    let query = format!("{} {} audio", title, artist);

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .ok()?;

    let body = serde_json::json!({
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20231121.08.00",
                "hl": "en",
                "gl": "US"
            }
        },
        "query": query
    });

    let resp = client
        .post("https://www.youtube.com/youtubei/v1/search?prettyPrint=false")
        .header("Content-Type", "application/json")
        .header("X-YouTube-Client-Name", "1")
        .header("X-YouTube-Client-Version", "2.20231121.08.00")
        .json(&body)
        .send()
        .await
        .ok()?;

    let data: serde_json::Value = resp.json().await.ok()?;

    let items = find_video_items(&data);
    items.into_iter().find_map(|v| {
        let video_id = v["videoId"].as_str()?.to_string();

        let thumbnail_url = v["thumbnail"]["thumbnails"]
            .as_array()
            .and_then(|thumbs| {
                thumbs.iter()
                    .filter_map(|t| t["url"].as_str())
                    .find(|u| u.contains("mqdefault") || u.contains("hqdefault"))
                    .or_else(|| thumbs.last().and_then(|t| t["url"].as_str()))
            })
            .map(|u| {
                u.split('?').next().unwrap_or(u).to_string()
            });

        let duration_seconds = v["lengthText"]["simpleText"]
            .as_str()
            .and_then(|s| parse_duration_text(s));

        Some(YoutubeMatch { video_id, thumbnail_url, duration_seconds })
    })
}

fn parse_duration_text(s: &str) -> Option<i64> {
    let parts: Vec<i64> = s.split(':')
        .filter_map(|p| p.parse().ok())
        .collect();
    match parts.as_slice() {
        [m, s] => Some(m * 60 + s),
        [h, m, s] => Some(h * 3600 + m * 60 + s),
        _ => None,
    }
}

fn find_video_items(data: &serde_json::Value) -> Vec<serde_json::Value> {
    let primary = data
        .pointer("/contents/twoColumnSearchResultsRenderer/primaryContents/sectionListRenderer/contents")
        .and_then(|v| v.as_array());

    if let Some(sections) = primary {
        let mut items = Vec::new();
        for section in sections {
            if let Some(contents) = section
                .pointer("/itemSectionRenderer/contents")
                .and_then(|v| v.as_array())
            {
                for item in contents {
                    if let Some(video) = item.get("videoRenderer") {
                        items.push(video.clone());
                    }
                }
            }
        }
        if !items.is_empty() { return items; }
    }
    Vec::new()
}

async fn import_tracks_parallel(
    tracks: Vec<parse::ParsedTrack>,
    playlist_id: Option<String>,
    mark_liked: bool,
    db_pool: crate::state::DbPool,
    app: AppHandle,
) {
    let total = tracks.len();
    let sem = Arc::new(Semaphore::new(8));
    let mut set: JoinSet<(usize, String, Option<YoutubeMatch>)> = JoinSet::new();

    for (i, parsed) in tracks.iter().enumerate() {
        let title = parsed.title.clone();
        let artist = parsed.artist.clone();
        let sem = sem.clone();

        let _ = app.emit("import://progress", ImportProgressEvent {
            current: i + 1,
            total,
            track_name: title.clone(),
            status: "matching".into(),
        });

        set.spawn(async move {
            let _permit = sem.acquire_owned().await.unwrap();
            let yt_match = search_youtube_one(&title, &artist).await;
            (i, title, yt_match)
        });
    }

    let mut imported = 0usize;
    let mut failed = 0usize;
    let mut completed = 0usize;

    while let Some(result) = set.join_next().await {
        completed += 1;
        let (i, track_name, yt_match) = match result {
            Ok(r) => r,
            Err(_) => {
                failed += 1;
                continue;
            }
        };

        let parsed = &tracks[i];

        match yt_match {
            None => {
                failed += 1;
                let _ = app.emit("import://progress", ImportProgressEvent {
                    current: completed,
                    total,
                    track_name,
                    status: "failed".into(),
                });
            }
            Some(yt) => {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64;

                let save_ok = (|| {
                    let conn = db_pool.get().ok()?;

                    let existing_id = db_tracks::get_track_by_youtube_id(&conn, &yt.video_id)
                        .ok()
                        .flatten()
                        .map(|t| t.id);

                    let track = db_tracks::Track {
                        id: existing_id.unwrap_or_else(|| Uuid::new_v4().to_string()),
                        youtube_id: yt.video_id,
                        title: parsed.title.clone(),
                        artist: parsed.artist.clone(),
                        album: Some(parsed.album.clone()),
                        duration_seconds: yt.duration_seconds,
                        thumbnail_url: yt.thumbnail_url,
                        play_count: 0,
                        last_played_at: None,
                        liked: mark_liked,
                        created_at: now,
                        local_path: None,
                    };

                    db_tracks::upsert_track(&conn, &track).ok()?;
                    if let Some(ref pid) = playlist_id {
                        db_playlists::add_track_to_playlist(&conn, pid, &track.id).ok()?;
                    }
                    Some(())
                })().is_some();

                if save_ok {
                    imported += 1;
                    let _ = app.emit("import://progress", ImportProgressEvent {
                        current: completed,
                        total,
                        track_name,
                        status: "imported".into(),
                    });
                } else {
                    failed += 1;
                    let _ = app.emit("import://progress", ImportProgressEvent {
                        current: completed,
                        total,
                        track_name,
                        status: "failed".into(),
                    });
                }
            }
        }
    }

    let _ = app.emit("import://complete", ImportCompleteEvent {
        imported, failed,
        truncated: false, spotify_total: 0, already_present: 0,
    });
}

fn extract_spotify_playlist_id(url: &str) -> Option<String> {
    if url.starts_with("spotify:playlist:") {
        return Some(url.trim_start_matches("spotify:playlist:").split('?').next()?.to_string());
    }
    let path = url.split("open.spotify.com/playlist/").nth(1)?;
    Some(path.split(['?', '#']).next()?.to_string())
}

#[tauri::command]
pub async fn import_spotify_url(
    url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), WaveError> {
    let playlist_id = extract_spotify_playlist_id(&url)
        .ok_or_else(|| WaveError::Internal("Not a valid Spotify playlist URL".into()))?;

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| WaveError::Network(format!("HTTP client error: {e}")))?;

    let embed_url = format!("https://open.spotify.com/embed/playlist/{playlist_id}");
    let html = client
        .get(&embed_url)
        .header("Accept", "text/html,application/xhtml+xml")
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .await
        .map_err(|e| WaveError::Network(format!("Could not reach Spotify embed: {e}")))?;

    let status = html.status().as_u16();
    if status == 404 {
        return Err(WaveError::Internal(
            "Playlist not found. Make sure the URL is correct and the playlist is public.".into()
        ));
    }
    if status >= 400 {
        return Err(WaveError::Internal(format!(
            "Spotify returned HTTP {status} for the embed page. The playlist may be private \
             or Spotify is blocking the request from your IP."
        )));
    }

    let body = html.text().await
        .map_err(|e| WaveError::Network(format!("Reading embed page failed: {e}")))?;

    let json_str = {
        let needle = r#"<script id="__NEXT_DATA__" type="application/json">"#;
        let start = body.find(needle).ok_or_else(|| WaveError::Internal(
            "Could not find playlist data in Spotify embed page (Spotify may have changed their HTML).".into()
        ))?;
        let after = &body[start + needle.len()..];
        let end = after.find("</script>").ok_or_else(|| WaveError::Internal(
            "Could not find end of __NEXT_DATA__ block.".into()
        ))?;
        &after[..end]
    };

    let data: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| WaveError::Internal(format!("Embed JSON parse error: {e}")))?;

    let entity = data.pointer("/props/pageProps/state/data/entity")
        .or_else(|| data.pointer("/props/pageProps/entity"))
        .ok_or_else(|| WaveError::Internal(
            "Embed page didn't contain an entity payload (Spotify schema change?).".into()
        ))?;

    let playlist_name = entity["name"]
        .as_str()
        .unwrap_or("Imported Playlist")
        .to_string();

    let track_list = entity["trackList"].as_array()
        .or_else(|| entity.pointer("/tracks/items").and_then(|v| v.as_array()))
        .ok_or_else(|| WaveError::Internal("Playlist had no tracks in the embed payload.".into()))?;

    let mut parsed_tracks: Vec<(String, String)> = Vec::new();
    for item in track_list {
        let title = item["title"]
            .as_str()
            .or_else(|| item.pointer("/track/name").and_then(|v| v.as_str()))
            .unwrap_or("").trim().to_string();
        let artist = item["subtitle"]
            .as_str()
            .or_else(|| item.pointer("/track/artists/0/name").and_then(|v| v.as_str()))
            .unwrap_or("").trim().to_string();
        if !title.is_empty() {
            parsed_tracks.push((title, artist));
        }
    }

    let spotify_total = entity.pointer("/totalLength").and_then(|v| v.as_u64())
        .or_else(|| entity.pointer("/duration/totalCount").and_then(|v| v.as_u64()))
        .or_else(|| entity.pointer("/tracks/totalCount").and_then(|v| v.as_u64()))
        .or_else(|| entity.pointer("/relatedEntityUri").and(None))
        .unwrap_or(parsed_tracks.len() as u64) as usize;

    let api_token = data.pointer("/props/pageProps/state/accessToken")
        .or_else(|| data.pointer("/props/pageProps/accessToken"))
        .or_else(|| data.pointer("/props/accessToken"))
        .and_then(|v| v.as_str())
        .map(String::from);

    let mut truncated = false;
    if parsed_tracks.len() < spotify_total {
        if let Some(token) = api_token {
            let mut offset = parsed_tracks.len() as u32;
            const LIMIT: u32 = 100;
            'pages: loop {
                let url = format!(
                    "https://api.spotify.com/v1/playlists/{playlist_id}/tracks\
                     ?fields=items(track(name,artists(name))),next\
                     &limit={LIMIT}&offset={offset}"
                );
                let resp = client.get(&url).bearer_auth(&token).send().await;
                let page: serde_json::Value = match resp {
                    Ok(r) if r.status().is_success() => match r.json().await {
                        Ok(v) => v,
                        Err(_) => { truncated = true; break 'pages; }
                    },
                    _ => { truncated = true; break 'pages; }
                };
                let items = match page["items"].as_array() {
                    Some(a) if !a.is_empty() => a,
                    _ => break 'pages,
                };
                for item in items {
                    let t = &item["track"];
                    let name = t["name"].as_str().unwrap_or("").trim().to_string();
                    let artist = t["artists"][0]["name"].as_str().unwrap_or("").trim().to_string();
                    if !name.is_empty() { parsed_tracks.push((name, artist)); }
                }
                if page["next"].is_null() || items.len() < LIMIT as usize { break; }
                offset += items.len() as u32;
            }
        } else {
            truncated = true;
        }
    }

    if parsed_tracks.is_empty() {
        return Err(WaveError::Internal(
            "No tracks found in the Spotify playlist. It may be empty or private.".into()
        ));
    }

    let playlist_id_local = {
        let conn = state.db.get().map_err(WaveError::from)?;
        let existing = db_playlists::get_all_playlists(&conn)?;
        match existing.into_iter().find(|p| p.name == playlist_name) {
            Some(p) => p.id,
            None => {
                let new_id = Uuid::new_v4().to_string();
                db_playlists::create_playlist_with_id(&conn, &new_id, &playlist_name)?;
                new_id
            }
        }
    };

    let total = parsed_tracks.len();
    let db_pool = state.db.clone();

    tokio::spawn(async move {
        let sem = Arc::new(Semaphore::new(6));
        let mut set: JoinSet<(usize, String, String, Option<YoutubeMatch>)> = JoinSet::new();

        for (idx, (title, artist)) in parsed_tracks.into_iter().enumerate() {
            let sem = sem.clone();
            let app_clone = app.clone();
            set.spawn(async move {
                let _permit = sem.acquire_owned().await.ok();
                let _ = app_clone.emit("import://progress", ImportProgressEvent {
                    current: idx + 1, total,
                    track_name: format!("{} — {}", title, artist),
                    status: "matching".into(),
                });
                let yt = search_youtube_one(&title, &artist).await;
                drop(_permit);
                (idx, title, artist, yt)
            });
        }

        let mut by_idx: Vec<Option<(String, String, YoutubeMatch)>> =
            (0..total).map(|_| None).collect();
        while let Some(res) = set.join_next().await {
            if let Ok((idx, title, artist, Some(yt))) = res {
                if idx < total { by_idx[idx] = Some((title, artist, yt)); }
            }
        }

        let mut imported = 0usize;
        let mut already_present = 0usize;
        let mut failed = 0usize;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs()).unwrap_or(0) as i64;

        for (idx, slot) in by_idx.into_iter().enumerate() {
            match slot {
                None => {
                    failed += 1;
                    let _ = app.emit("import://progress", ImportProgressEvent {
                        current: idx + 1, total,
                        track_name: String::new(),
                        status: "failed".into(),
                    });
                }
                Some((title, artist, yt)) => {
                    let outcome: Option<bool> = (|| -> Option<bool> {
                        let conn = db_pool.get().ok()?;
                        let track_id = match db_tracks::get_track_by_youtube_id(&conn, &yt.video_id).ok()? {
                            Some(e) => e.id,
                            None => {
                                let t = db_tracks::Track {
                                    id: Uuid::new_v4().to_string(),
                                    youtube_id: yt.video_id.clone(),
                                    title: title.clone(),
                                    artist: artist.clone(),
                                    album: None,
                                    duration_seconds: yt.duration_seconds,
                                    thumbnail_url: yt.thumbnail_url.clone(),
                                    play_count: 0,
                                    last_played_at: None,
                                    liked: false,
                                    created_at: now,
                                    local_path: None,
                                };
                                db_tracks::upsert_track(&conn, &t).ok()?;
                                t.id
                            }
                        };
                        let was_added = db_playlists::add_track_to_playlist(
                            &conn, &playlist_id_local, &track_id
                        ).ok()?;
                        Some(was_added)
                    })();
                    match outcome {
                        Some(true)  => {
                            imported += 1;
                            let _ = app.emit("import://progress", ImportProgressEvent {
                                current: idx + 1, total,
                                track_name: format!("{} — {}", title, artist),
                                status: "imported".into(),
                            });
                        }
                        Some(false) => {
                            already_present += 1;
                        }
                        None => {
                            failed += 1;
                        }
                    }
                }
            }
        }

        let _ = app.emit("import://complete", ImportCompleteEvent {
            imported, failed,
            truncated, spotify_total,
            already_present,
        });
    });

    Ok(())
}

#[tauri::command]
pub async fn spotify_import_file(
    file_path: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), WaveError> {
    let json = std::fs::read_to_string(&file_path)
        .map_err(|e| WaveError::Internal(format!("Cannot read file: {e}")))?;

    let (saved_tracks, playlists) = parse::parse_spotify_export(&json)?;

    let db_pool = state.db.clone();

    tokio::spawn(async move {
        if !saved_tracks.is_empty() {
            import_tracks_parallel(saved_tracks, None, true, db_pool, app).await;
        } else {
            let total_playlists = playlists.len();
            for (pi, playlist) in playlists.into_iter().enumerate() {
                if playlist.tracks.is_empty() { continue; }

                let playlist_id = {
                    let conn = match db_pool.get() {
                        Err(_) => continue,
                        Ok(c) => c,
                    };
                    let new_id = Uuid::new_v4().to_string();
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs() as i64;
                    let _ = conn.execute(
                        "INSERT OR IGNORE INTO playlists (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
                        rusqlite::params![new_id, playlist.name, now],
                    );
                    conn.query_row(
                        "SELECT id FROM playlists WHERE name = ?1 ORDER BY created_at ASC LIMIT 1",
                        rusqlite::params![playlist.name],
                        |row| row.get::<_, String>(0),
                    ).unwrap_or(new_id)
                };

                log::info!(
                    "Importing playlist {}/{}: {} ({} tracks)",
                    pi + 1, total_playlists, playlist.name, playlist.tracks.len()
                );

                import_tracks_parallel(
                    playlist.tracks,
                    Some(playlist_id),
                    false,
                    db_pool.clone(),
                    app.clone(),
                ).await;
            }
        }
    });

    Ok(())
}
