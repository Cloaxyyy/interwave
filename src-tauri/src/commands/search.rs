use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::search_history;
use crate::error::WaveError;
use crate::state::AppState;

/// A single YouTube search result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub youtube_id: String,
    pub title: String,
    pub artist: String,
    pub duration_seconds: Option<i64>,
    pub thumbnail_url: Option<String>,
}

/// Searches YouTube via the innertube API — no subprocess, ~200 ms vs 3–8 s with yt-dlp.
#[tauri::command]
pub async fn search_youtube(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<SearchResult>, WaveError> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    let body = serde_json::json!({
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20240726.00.00",
                "hl": "en",
                "gl": "US"
            }
        },
        "query": query.trim()
    });

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| WaveError::Network(e.to_string()))?;

    let resp = client
        .post("https://www.youtube.com/youtubei/v1/search")
        .header("Content-Type", "application/json")
        .header("X-YouTube-Client-Name", "1")
        .header("X-YouTube-Client-Version", "2.20240726.00.00")
        .header("Origin", "https://www.youtube.com")
        .header("Referer", "https://www.youtube.com/")
        .json(&body)
        .send()
        .await
        .map_err(|e| WaveError::Network(format!("YouTube search request failed: {e}")))?;

    if !resp.status().is_success() {
        return Err(WaveError::Network(format!(
            "YouTube API returned HTTP {}",
            resp.status()
        )));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| WaveError::Network(format!("Failed to parse YouTube response: {e}")))?;

    let mut results: Vec<SearchResult> = Vec::new();

    // Walk the innertube response tree to find itemSectionRenderer contents
    let items = find_video_items(&data);

    for video in items {
        let youtube_id = match video["videoId"].as_str() {
            Some(id) if !id.is_empty() => id.to_string(),
            _ => continue,
        };

        let title = video
            .pointer("/title/runs/0/text")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown")
            .to_string();

        // Filter out YouTube Shorts by title
        let title_lower = title.to_lowercase();
        if title_lower.contains("#shorts") {
            continue;
        }
        // Filter "shorts" as a word (space before it, or starts with it)
        if title_lower.contains(" shorts") || title_lower.starts_with("shorts") {
            continue;
        }

        let artist = video
            .pointer("/ownerText/runs/0/text")
            .and_then(|v| v.as_str())
            .or_else(|| video.pointer("/shortBylineText/runs/0/text").and_then(|v| v.as_str()))
            .unwrap_or("Unknown")
            .to_string();

        // Duration comes as "3:45" or "1:23:45"
        let duration_seconds = video
            .pointer("/lengthText/simpleText")
            .and_then(|v| v.as_str())
            .or_else(|| {
                video
                    .pointer("/lengthText/accessibility/accessibilityData/label")
                    .and_then(|v| v.as_str())
            })
            .map(parse_duration_str);

        // Filter out shorts by duration (< 60 seconds)
        if let Some(d) = duration_seconds {
            if d < 60 {
                continue;
            }
        }

        // Use the highest-resolution thumbnail available
        let thumbnail_url = video
            .pointer("/thumbnail/thumbnails")
            .and_then(|v| v.as_array())
            .and_then(|ts| ts.last())
            .and_then(|t| t["url"].as_str())
            .map(|s| s.to_string());

        results.push(SearchResult {
            youtube_id,
            title,
            artist,
            duration_seconds,
            thumbnail_url,
        });

        if results.len() >= 15 {
            break;
        }
    }

    // Save query to history (non-critical)
    if !results.is_empty() {
        if let Ok(conn) = state.db.get() {
            let _ = search_history::save_query(&conn, &query);
        }
    }

    Ok(results)
}

/// Recursively hunts for videoRenderer objects inside the innertube JSON.
/// The response structure shifts between YouTube versions so we walk it generically.
fn find_video_items(data: &serde_json::Value) -> Vec<serde_json::Value> {
    // Primary path: standard web search response
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
        if !items.is_empty() {
            return items;
        }
    }

    // Fallback: walk entire JSON tree looking for videoRenderer keys
    collect_video_renderers(data)
}

fn collect_video_renderers(val: &serde_json::Value) -> Vec<serde_json::Value> {
    let mut out = Vec::new();
    match val {
        serde_json::Value::Object(map) => {
            if map.contains_key("videoId") && map.contains_key("title") {
                out.push(val.clone());
                return out; // don't recurse into the renderer itself
            }
            for v in map.values() {
                out.extend(collect_video_renderers(v));
                if out.len() >= 15 {
                    break;
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for v in arr {
                out.extend(collect_video_renderers(v));
                if out.len() >= 15 {
                    break;
                }
            }
        }
        _ => {}
    }
    out
}

/// Parses "3:45" or "1:23:45" into total seconds.
fn parse_duration_str(s: &str) -> i64 {
    let parts: Vec<i64> = s
        .split(':')
        .filter_map(|p| p.trim().parse().ok())
        .collect();
    match parts.as_slice() {
        [s] => *s,
        [m, s] => m * 60 + s,
        [h, m, s] => h * 3600 + m * 60 + s,
        _ => 0,
    }
}

/// Get YouTube recommended/related videos for a given video ID using InnerTube.
#[tauri::command]
pub async fn get_recommendations(
    youtube_id: String,
    _state: State<'_, AppState>,
) -> Result<Vec<SearchResult>, WaveError> {
    use reqwest::header;

    let body = serde_json::json!({
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20241126.01.00",
                "hl": "en"
            }
        },
        "videoId": youtube_id
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| WaveError::Network(e.to_string()))?;

    let resp = client
        .post("https://www.youtube.com/youtubei/v1/next?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8")
        .header(header::CONTENT_TYPE, "application/json")
        .header("X-YouTube-Client-Name", "1")
        .header("X-YouTube-Client-Version", "2.20241126.01.00")
        .json(&body)
        .send()
        .await
        .map_err(|e| WaveError::Network(e.to_string()))?;

    if !resp.status().is_success() {
        return Ok(vec![]);
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| WaveError::Network(e.to_string()))?;

    let mut results = Vec::new();

    // Try to find compactVideoRenderer items in the watch next results
    if let Some(contents) = json
        .pointer("/contents/twoColumnWatchNextResults/secondaryResults/secondaryResults/results")
        .and_then(|v| v.as_array())
    {
        for item in contents {
            if let Some(renderer) = item.get("compactVideoRenderer") {
                if let Some(result) = parse_compact_video(renderer) {
                    results.push(result);
                    if results.len() >= 10 { break; }
                }
            }
        }
    }

    Ok(results)
}

fn parse_compact_video(r: &serde_json::Value) -> Option<SearchResult> {
    let video_id = r.get("videoId")?.as_str()?.to_string();

    let title = r.pointer("/title/simpleText")
        .or_else(|| r.pointer("/title/runs/0/text"))
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();

    let artist = r.pointer("/shortBylineText/runs/0/text")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();

    let thumbnail_url = r
        .pointer("/thumbnail/thumbnails")
        .and_then(|t| t.as_array())
        .and_then(|arr| arr.last())
        .and_then(|t| t.get("url"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let duration_seconds = r
        .pointer("/lengthText/simpleText")
        .and_then(|v| v.as_str())
        .and_then(parse_duration_text);

    Some(SearchResult {
        youtube_id: video_id,
        title,
        artist,
        duration_seconds,
        thumbnail_url,
    })
}

fn parse_duration_text(s: &str) -> Option<i64> {
    let parts: Vec<&str> = s.split(':').collect();
    match parts.len() {
        2 => {
            let m: i64 = parts[0].parse().ok()?;
            let s: i64 = parts[1].parse().ok()?;
            Some(m * 60 + s)
        }
        3 => {
            let h: i64 = parts[0].parse().ok()?;
            let m: i64 = parts[1].parse().ok()?;
            let s: i64 = parts[2].parse().ok()?;
            Some(h * 3600 + m * 60 + s)
        }
        _ => None,
    }
}

/// Returns the 20 most recent search queries, newest first.
#[tauri::command]
pub fn get_search_history(state: State<'_, AppState>) -> Result<Vec<String>, WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(search_history::get_recent(&conn)?)
}

/// Clears all search history.
#[tauri::command]
pub fn clear_search_history(state: State<'_, AppState>) -> Result<(), WaveError> {
    let conn = state.db.get().map_err(WaveError::from)?;
    Ok(search_history::clear_history(&conn)?)
}
