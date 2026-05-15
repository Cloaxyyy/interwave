use tauri::State;
use serde::{Deserialize, Serialize};
use crate::error::WaveError;
use crate::state::AppState;

static LYRICS_CACHE: std::sync::OnceLock<std::sync::Mutex<std::collections::HashMap<String, LyricsResult>>> = std::sync::OnceLock::new();

fn get_cache() -> &'static std::sync::Mutex<std::collections::HashMap<String, LyricsResult>> {
    LYRICS_CACHE.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricLine {
    pub time_ms: u64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricsResult {
    pub synced: Vec<LyricLine>,
    pub plain: String,
    pub has_synced: bool,
}

fn parse_lrc(lrc: &str) -> Vec<LyricLine> {
    let mut lines = Vec::new();
    for line in lrc.lines() {
        if let Some(rest) = line.strip_prefix('[') {
            if let Some(bracket_end) = rest.find(']') {
                let time_str = &rest[..bracket_end];
                let text = rest[bracket_end + 1..].trim().to_string();
                let parts: Vec<&str> = time_str.splitn(2, ':').collect();
                if parts.len() == 2 {
                    if let (Ok(mins), Ok(secs)) = (
                        parts[0].parse::<u64>(),
                        parts[1].parse::<f64>(),
                    ) {
                        let ms = mins * 60_000 + (secs * 1000.0) as u64;
                        if !text.is_empty() || ms == 0 {
                            lines.push(LyricLine { time_ms: ms, text });
                        }
                    }
                }
            }
        }
    }
    lines.sort_by_key(|l| l.time_ms);
    lines
}

fn clean_title(raw: &str) -> String {
    let bracket_patterns: &[&str] = &[
        "official video", "official music video", "official audio",
        "official lyric video", "official visualizer", "official",
        "lyric video", "lyrics", "lyric", "audio", "visualizer",
        "music video", "mv", "performance video", "live", "live version",
        "acoustic version", "acoustic", "radio edit", "radio version",
        "extended version", "extended", "explicit", "clean",
        "4k", "hd", "hq", "remastered", "remaster",
    ];

    let mut s = raw.trim().to_string();

    for open in &['(', '['] {
        let close = if *open == '(' { ')' } else { ']' };
        loop {
            let start = s.find(*open);
            let end = s.find(close);
            if let (Some(a), Some(b)) = (start, end) {
                if a < b {
                    let inner = s[a + 1..b].trim().to_lowercase();
                    if bracket_patterns.iter().any(|p| inner.starts_with(p)) {
                        s = format!("{}{}", s[..a].trim_end(), &s[b + 1..]);
                        continue;
                    }
                }
            }
            break;
        }
    }

    for marker in &[" (feat.", " [feat.", " feat.", " ft."] {
        if let Some(pos) = s.to_lowercase().find(marker) {
            s = s[..pos].trim_end().to_string();
        }
    }

    if let Some(pos) = s.to_lowercase().find(" - topic") {
        s = s[..pos].trim_end().to_string();
    }

    s.trim().to_string()
}

fn clean_artist(raw: &str) -> String {
    let s = raw.trim();
    let lower = s.to_lowercase();
    if lower.ends_with("vevo") {
        return s[..s.len() - 4].trim().to_string();
    }
    if let Some(pos) = lower.find(" - topic") {
        return s[..pos].trim().to_string();
    }
    s.to_string()
}

async fn try_lrclib(client: &reqwest::Client, url: &str) -> Option<LyricsResult> {
    let resp = client.get(url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body: serde_json::Value = resp.json().await.ok()?;

    if body.is_array() {
        for item in body.as_array()? {
            if let Ok(r) = extract_lyrics(item) {
                if r.has_synced || !r.plain.is_empty() {
                    return Some(r);
                }
            }
        }
        None
    } else {
        extract_lyrics(&body).ok().filter(|r| r.has_synced || !r.plain.is_empty())
    }
}

#[tauri::command]
pub async fn get_lyrics(
    title: String,
    artist: String,
    duration_secs: Option<i64>,
    _state: State<'_, AppState>,
) -> Result<LyricsResult, WaveError> {
    let cache_key = format!("{}::{}", title.trim().to_lowercase(), artist.trim().to_lowercase());
    {
        if let Ok(cache) = get_cache().lock() {
            if let Some(cached) = cache.get(&cache_key) {
                return Ok(cached.clone());
            }
        }
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("Wave/1.0 (https://github.com/interwave)")
        .build()
        .map_err(|e| WaveError::Network(e.to_string()))?;

    let clean_t = clean_title(&title);
    let clean_a = clean_artist(&artist);

    let mut urls: Vec<String> = Vec::new();

    if let Some(dur) = duration_secs {
        urls.push(format!(
            "https://lrclib.net/api/get?track_name={}&artist_name={}&duration={}",
            urlencoding::encode(&clean_t),
            urlencoding::encode(&clean_a),
            dur,
        ));
    }

    urls.push(format!(
        "https://lrclib.net/api/search?track_name={}&artist_name={}",
        urlencoding::encode(&clean_t),
        urlencoding::encode(&clean_a),
    ));

    if clean_t != title.trim() || clean_a != artist.trim() {
        urls.push(format!(
            "https://lrclib.net/api/search?track_name={}&artist_name={}",
            urlencoding::encode(title.trim()),
            urlencoding::encode(artist.trim()),
        ));
    }

    urls.push(format!(
        "https://lrclib.net/api/search?q={}",
        urlencoding::encode(&format!("{} {}", clean_t, clean_a)),
    ));

    urls.push(format!(
        "https://lrclib.net/api/search?q={}",
        urlencoding::encode(&clean_t),
    ));

    for url in &urls {
        if let Some(result) = try_lrclib(&client, url).await {
            if let Ok(mut cache) = get_cache().lock() {
                cache.insert(cache_key, result.clone());
            }
            return Ok(result);
        }
    }

    log::info!("get_lyrics: no results for '{}' by '{}'", clean_t, clean_a);
    Ok(LyricsResult { synced: vec![], plain: String::new(), has_synced: false })
}

fn extract_lyrics(obj: &serde_json::Value) -> Result<LyricsResult, WaveError> {
    let synced_str = obj.get("syncedLyrics").and_then(|v| v.as_str()).unwrap_or("");
    let plain_str  = obj.get("plainLyrics").and_then(|v| v.as_str()).unwrap_or("");

    if !synced_str.is_empty() {
        let synced = parse_lrc(synced_str);
        Ok(LyricsResult {
            has_synced: true,
            plain: plain_str.to_string(),
            synced,
        })
    } else if !plain_str.is_empty() {
        Ok(LyricsResult {
            has_synced: false,
            plain: plain_str.to_string(),
            synced: vec![],
        })
    } else {
        Ok(LyricsResult { synced: vec![], plain: String::new(), has_synced: false })
    }
}
